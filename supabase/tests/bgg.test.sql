-- Tests de la cuenta de BGG vinculada y de las expansiones (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@ejemplo.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'beto@ejemplo.com');

-- Catan (base) y Navegantes (expansión de Catan), como filas de BGG.
insert into public.juegos (id, nombre, origen, creado_por, bgg_id, es_expansion, expande) values
  ('a1111111-0000-0000-0000-000000000013', 'Catan', 'bgg', null, 13, false, '{}'),
  ('a1111111-0000-0000-0000-000000000325', 'Catan: Navegantes', 'bgg', null, 325, true, '{13}');
insert into public.catalogo_usuario (user_id, juego_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000013'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000325');
insert into public.partidas (id, codigo, juego_nombre, anfitrion_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'AAAAAA', 'Catan', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.partida_jugadores (partida_id, user_id, nombre) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'x');

create function pg_temp.como(usuario uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
$$;

-- ===========================================================================
-- Usuario de BGG
-- ===========================================================================
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$update public.perfiles set bgg_usuario = 'ana_juega', bgg_importado_en = now()
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'Cada uno vincula su usuario de BGG'
);
select is(
  (select bgg_usuario from public.perfiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'ana_juega',
  'Y queda guardado'
);
select throws_ok(
  $$update public.perfiles set bgg_usuario = 'ana@mail.com'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', null,
  'Un email no es un usuario de BGG'
);
select throws_ok(
  $$update public.perfiles set codigo_amigo = 'ZZZZZZ'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501', null,
  'Sigue sin poder cambiarse el código de amigo'
);

select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
with u as (
  update public.perfiles set bgg_usuario = 'otro'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1
)
select is(count(*), 0::bigint, 'Nadie cambia el usuario de BGG de otro') from u;

-- ===========================================================================
-- Expansiones
-- ===========================================================================
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select results_eq(
  $$select nombre, es_expansion, expande from public.mi_catalogo order by nombre$$,
  $$values ('Catan', false, '{}'::integer[]), ('Catan: Navegantes', true, '{13}'::integer[])$$,
  'mi_catalogo dice qué es expansión y de qué juego'
);
select results_eq(
  $$select nombre from public.juegos_de_la_mesa('eeeeeeee-0000-0000-0000-000000000001')$$,
  $$values ('Catan')$$,
  'La mesa no ofrece expansiones (no se juegan solas)'
);
with u as (
  update public.juegos set es_expansion = false where bgg_id = 325 returning 1
)
select is(count(*), 0::bigint, 'Las filas de BGG no se tocan desde la app') from u;
select throws_ok(
  $$insert into public.juegos (nombre, origen, expande)
    values ('Mucho', 'manual', (select array_agg(g) from generate_series(1, 51) g))$$,
  '23514', null,
  'Una expansión expande hasta 50 juegos'
);

select * from finish();
rollback;
