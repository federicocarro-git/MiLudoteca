-- Tests de salas (partidas y jugadores) e invitados anónimos (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- A (anfitrión) y B son amigos; C es un extraño con cuenta; G es un invitado
-- anónimo.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@ejemplo.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'beto@ejemplo.com'),
  ('cccccccc-0000-0000-0000-000000000003', 'caro@ejemplo.com');
insert into auth.users (id, is_anonymous) values
  ('99999999-0000-0000-0000-000000000009', true);
insert into public.amistades (solicitante_id, destinatario_id, estado) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'aceptada');

insert into public.juegos (id, bgg_id, nombre, origen, bgg_sincronizado_en) values
  ('11111111-0000-0000-0000-000000000001', 900001, 'Juego de BGG', 'bgg', now());
insert into public.juegos (id, nombre, origen, creado_por) values
  ('22222222-0000-0000-0000-000000000002', 'Manual de A', 'manual', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000003', 'Manual de C', 'manual', 'cccccccc-0000-0000-0000-000000000003');

create function pg_temp.como(usuario uuid, anonimo boolean default false) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated', 'is_anonymous', anonimo)::text,
    true
  );
  set local role authenticated;
$$;

create temp table ids (nombre text primary key, id uuid, codigo text);
grant all on ids to authenticated;

-- ===========================================================================
-- Crear
-- ===========================================================================
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok(
  $$insert into ids select 'manual', id, codigo from public.crear_partida('22222222-0000-0000-0000-000000000002')$$,
  'A crea una sala con su juego manual'
);
select matches((select codigo from ids where nombre = 'manual'), '^[A-HJ-NP-Z2-9]{6}$', 'La sala tiene un código de 6');
select results_eq(
  $$select nombre, invitado from public.partida_jugadores where partida_id = (select id from ids where nombre = 'manual')$$,
  $$values ('ana'::text, false)$$,
  'A queda como primer jugador, con el nombre de su perfil'
);
select throws_ok(
  $$select public.crear_partida('33333333-0000-0000-0000-000000000003')$$,
  'P0002', null,
  'A no puede crear una sala con el juego manual de C'
);
select throws_ok(
  $$insert into public.partidas (codigo, juego_nombre, anfitrion_id) values ('ZZZZZZ', 'x', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', null,
  'Las salas no se crean a mano'
);

-- ===========================================================================
-- Ver por código y unirse
-- ===========================================================================
select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
select is((select count(*) from public.partidas), 0::bigint, 'C no ve la sala antes de entrar');
select results_eq(
  $$select juego_nombre, anfitrion, jugadores, ya_estoy from public.ver_sala((select lower(codigo) from ids where nombre = 'manual'))$$,
  $$values ('Manual de A'::text, 'ana'::text, 1, false)$$,
  'Con el código, C ve el juego, el anfitrión y cuántos son'
);
select is(public.unirse_a_partida('ZZZZZZ'), null, 'Un código que no existe no une a nadie');
select is(
  public.unirse_a_partida((select codigo from ids where nombre = 'manual'), 'Nombre inventado'),
  (select id from ids where nombre = 'manual'),
  'C se une con el código'
);
select results_eq(
  $$select nombre from public.partida_jugadores order by nombre$$,
  array['ana', 'caro'],
  'C entra con el nombre de su perfil (no el que mandó) y ve a los demás'
);
select is((select juego_nombre from public.partidas), 'Manual de A', 'C ve la sala con el juego copiado');
select is((select count(*) from public.juegos where id = '22222222-0000-0000-0000-000000000002'), 0::bigint,
  'C sigue sin ver el juego manual de A');
select lives_ok(
  $$select public.unirse_a_partida((select codigo from ids where nombre = 'manual'))$$,
  'Unirse dos veces no duplica'
);

-- Invitado anónimo.
select pg_temp.como('99999999-0000-0000-0000-000000000009', true);
select throws_ok(
  $$select public.unirse_a_partida((select codigo from ids where nombre = 'manual'))$$,
  '22023', null,
  'Un invitado tiene que poner un nombre'
);
select lives_ok(
  $$select public.unirse_a_partida((select codigo from ids where nombre = 'manual'), '  Gabi  ')$$,
  'El invitado se une con un nombre'
);
select results_eq(
  $$select nombre, invitado from public.partida_jugadores where user_id = '99999999-0000-0000-0000-000000000009'$$,
  $$values ('Gabi'::text, true)$$,
  'Queda como invitado, con su nombre'
);
select throws_ok(
  $$select public.crear_partida('11111111-0000-0000-0000-000000000001')$$,
  '42501', null,
  'Un invitado no puede crear salas'
);
select is((select count(*) from public.juegos), 0::bigint, 'Un invitado no ve juegos');
select is((select count(*) from public.perfiles), 0::bigint, 'Un invitado no ve perfiles');
select throws_ok(
  $$insert into public.catalogo_usuario (user_id, juego_id) values ('99999999-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000001')$$,
  '42501', null,
  'Un invitado no puede tener catálogo'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('imagenes-juegos', '99999999-0000-0000-0000-000000000009/x.webp', '99999999-0000-0000-0000-000000000009')$$,
  '42501', null,
  'Un invitado no puede subir fotos'
);

-- ===========================================================================
-- Puntos
-- ===========================================================================
select lives_ok(
  $$update public.partida_jugadores set puntos = 7 where user_id = '99999999-0000-0000-0000-000000000009'$$,
  'El invitado carga sus puntos'
);
with u as (
  update public.partida_jugadores set puntos = 99
  where user_id = 'cccccccc-0000-0000-0000-000000000003' returning 1
)
select is(count(*), 0::bigint, 'Un jugador no cambia los puntos de otro') from u;
select throws_ok(
  $$update public.partida_jugadores set nombre = 'otro' where user_id = '99999999-0000-0000-0000-000000000009'$$,
  '42501', null,
  'Solo se pueden cambiar los puntos'
);

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$update public.partida_jugadores set puntos = 12 where user_id = 'cccccccc-0000-0000-0000-000000000003'$$,
  'El anfitrión corrige los puntos de otro'
);

-- ===========================================================================
-- Agregar y sacar jugadores
-- ===========================================================================
select lives_ok(
  $$insert into public.partida_jugadores (partida_id, user_id, nombre)
    values ((select id from ids where nombre = 'manual'), 'bbbbbbbb-0000-0000-0000-000000000002', 'falso')$$,
  'El anfitrión agrega a un amigo'
);
select is(
  (select nombre from public.partida_jugadores where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'beto',
  'El amigo aparece con el nombre de su perfil'
);
select lives_ok(
  $$insert into public.partida_jugadores (partida_id, nombre)
    values ((select id from ids where nombre = 'manual'), 'Abuela')$$,
  'El anfitrión agrega a alguien sin celular'
);

select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
select throws_ok(
  $$insert into public.partida_jugadores (partida_id, nombre)
    values ((select id from ids where nombre = 'manual'), 'Colado')$$,
  '42501', null,
  'Un jugador que no es anfitrión no agrega a otros'
);
with d as (
  delete from public.partida_jugadores where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1
)
select is(count(*), 0::bigint, 'Un jugador no saca a otro') from d;
select lives_ok(
  $$delete from public.partida_jugadores where user_id = 'cccccccc-0000-0000-0000-000000000003'$$,
  'Un jugador se va de la sala'
);
select is((select count(*) from public.partidas), 0::bigint, 'Al irse, deja de ver la sala');

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
with d as (
  delete from public.partida_jugadores where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1
)
select is(count(*), 0::bigint, 'El anfitrión no se va de su propia sala (la cancela)') from d;
select lives_ok(
  $$delete from public.partidas where id = (select id from ids where nombre = 'manual')$$,
  'El anfitrión cancela la sala'
);

select * from finish();
rollback;
