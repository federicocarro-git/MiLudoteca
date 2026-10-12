-- Tests de Row Level Security (pgTAP). Correr con: npm run test:db
-- Todo corre en una transacción que se descarta al final (rollback).
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ---------------------------------------------------------------------------
-- Datos: dos usuarios (A y B), un juego de BGG y un juego manual de cada uno.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@ejemplo.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@ejemplo.com');

insert into public.juegos (id, bgg_id, nombre, origen, bgg_sincronizado_en) values
  ('11111111-0000-0000-0000-000000000001', 900001, 'Juego de BGG', 'bgg', now());
insert into public.juegos (id, nombre, origen, creado_por) values
  ('22222222-0000-0000-0000-000000000002', 'Manual de A', 'manual', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000003', 'Manual de B', 'manual', 'bbbbbbbb-0000-0000-0000-000000000002');

-- Actuar como un usuario autenticado (como lo hace PostgREST con el JWT).
create function pg_temp.como(usuario uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- ===========================================================================
-- juegos
-- ===========================================================================
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');

select results_eq(
  'select nombre from public.juegos order by nombre',
  array['Juego de BGG', 'Manual de A'],
  'A ve los juegos de BGG y sus manuales, no los de B'
);

select lives_ok(
  $$insert into public.juegos (nombre, origen) values ('Otro de A', 'manual')$$,
  'A puede crear un juego manual (creado_por = auth.uid() por defecto)'
);

select throws_ok(
  $$insert into public.juegos (bgg_id, nombre, origen) values (900002, 'Falso BGG', 'bgg')$$,
  '42501', null,
  'A no puede crear filas de BGG (las escribe solo el servidor)'
);

select throws_ok(
  $$insert into public.juegos (nombre, origen, creado_por) values ('Suplantado', 'manual', 'bbbbbbbb-0000-0000-0000-000000000002')$$,
  '42501', null,
  'A no puede crear juegos a nombre de B'
);

with u as (update public.juegos set nombre = 'hackeado' where id = '11111111-0000-0000-0000-000000000001' returning 1)
select is(count(*), 0::bigint, 'A no puede editar un juego de BGG') from u;

with u as (update public.juegos set nombre = 'hackeado' where id = '33333333-0000-0000-0000-000000000003' returning 1)
select is(count(*), 0::bigint, 'A no puede editar el juego manual de B') from u;

select lives_ok(
  $$update public.juegos set nombre = 'Manual de A (editado)' where id = '22222222-0000-0000-0000-000000000002'$$,
  'A puede editar su juego manual'
);

select throws_ok(
  $$update public.juegos set origen = 'bgg', bgg_id = 900003 where id = '22222222-0000-0000-0000-000000000002'$$,
  '42501', null,
  'A no puede convertir su juego manual en uno de BGG'
);

with d as (delete from public.juegos where id = '11111111-0000-0000-0000-000000000001' returning 1)
select is(count(*), 0::bigint, 'A no puede borrar un juego de BGG') from d;

with d as (delete from public.juegos where id = '33333333-0000-0000-0000-000000000003' returning 1)
select is(count(*), 0::bigint, 'A no puede borrar el juego manual de B') from d;

-- ===========================================================================
-- catalogo_usuario
-- ===========================================================================
select lives_ok(
  $$insert into public.catalogo_usuario (juego_id, puntuacion) values
    ('11111111-0000-0000-0000-000000000001', 8),
    ('22222222-0000-0000-0000-000000000002', null)$$,
  'A agrega a su catálogo un juego de BGG y uno propio'
);

select throws_ok(
  $$insert into public.catalogo_usuario (juego_id) values ('33333333-0000-0000-0000-000000000003')$$,
  '42501', null,
  'A no puede agregar a su catálogo el juego manual de B'
);

select throws_ok(
  $$insert into public.catalogo_usuario (user_id, juego_id) values ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001')$$,
  '42501', null,
  'A no puede escribir en el catálogo de B'
);

select results_eq(
  'select nombre from public.mi_catalogo order by nombre',
  array['Juego de BGG', 'Manual de A (editado)'],
  'mi_catalogo de A muestra sus juegos'
);

-- ===========================================================================
-- resumenes
-- ===========================================================================
select lives_ok(
  $$insert into public.resumenes (juego_id, como_se_juega) values ('11111111-0000-0000-0000-000000000001', '## Resumen de A')$$,
  'A escribe un resumen de un juego visible'
);

select throws_ok(
  $$insert into public.resumenes (juego_id) values ('33333333-0000-0000-0000-000000000003')$$,
  '42501', null,
  'A no puede escribir un resumen del juego manual de B'
);

select throws_ok(
  $$insert into public.resumenes (juego_id, autor_id) values ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002')$$,
  '42501', null,
  'A no puede escribir un resumen a nombre de B'
);

select throws_ok(
  $$insert into public.resumenes (juego_id, como_se_juega) values ('11111111-0000-0000-0000-000000000001', 'otro')$$,
  '23505', null,
  'un solo resumen por juego y autor'
);

-- ===========================================================================
-- Storage: imagenes-juegos
-- ===========================================================================
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('imagenes-juegos', 'aaaaaaaa-0000-0000-0000-000000000001/foto.webp')$$,
  'A sube una imagen a su carpeta'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('imagenes-juegos', 'bbbbbbbb-0000-0000-0000-000000000002/foto.webp')$$,
  '42501', null,
  'A no puede subir a la carpeta de B'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('imagenes-juegos', 'foto-suelta.webp')$$,
  '42501', null,
  'A no puede subir fuera de una carpeta propia'
);

-- ===========================================================================
-- Lo mismo visto por B
-- ===========================================================================
reset role;
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');

select results_eq(
  'select nombre from public.juegos order by nombre',
  array['Juego de BGG', 'Manual de B'],
  'B no ve los juegos manuales de A'
);

select is((select count(*) from public.catalogo_usuario), 0::bigint, 'B no ve el catálogo de A');
select is((select count(*) from public.mi_catalogo), 0::bigint, 'mi_catalogo de B está vacío');
select is((select count(*) from public.resumenes), 0::bigint, 'B no ve los resúmenes de A');

with u as (update public.catalogo_usuario set puntuacion = 1 returning 1)
select is(count(*), 0::bigint, 'B no puede editar el catálogo de A') from u;

with d as (delete from public.resumenes returning 1)
select is(count(*), 0::bigint, 'B no puede borrar los resúmenes de A') from d;

-- Supabase bloquea los DELETE directos en storage.objects (hay que usar la
-- API de Storage); el borrado de imágenes ajenas se prueba en los e2e.
select is(
  (select count(*) from storage.objects where bucket_id = 'imagenes-juegos'),
  0::bigint,
  'B no ve las imágenes de A (la API de Storage las filtra con esta política)'
);

-- ===========================================================================
-- Sin sesión
-- ===========================================================================
reset role;
set local role anon;

select throws_ok('select * from public.juegos', '42501', null, 'anon no puede leer juegos');
select throws_ok('select * from public.mi_catalogo', '42501', null, 'anon no puede leer mi_catalogo');

-- ===========================================================================
-- Restricciones de la tabla (como el servidor, sin RLS)
-- ===========================================================================
reset role;

select throws_ok(
  $$insert into public.juegos (bgg_id, nombre, origen, bgg_sincronizado_en) values (900001, 'Duplicado', 'bgg', now())$$,
  '23505', null,
  'no puede haber dos filas de BGG con el mismo bgg_id'
);

select lives_ok(
  $$insert into public.juegos (bgg_id, nombre, origen, creado_por) values (900001, 'Mi versión', 'manual', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  'un juego manual puede tener el mismo bgg_id como referencia'
);

select * from finish();
rollback;
