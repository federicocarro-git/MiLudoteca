-- Tests de cierre de partidas, notas y fotos (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- A (anfitrión), B y C juegan; D es un extraño; G un invitado anónimo.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@ejemplo.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'beto@ejemplo.com'),
  ('cccccccc-0000-0000-0000-000000000003', 'caro@ejemplo.com'),
  ('dddddddd-0000-0000-0000-000000000004', 'dani@ejemplo.com');
insert into auth.users (id, is_anonymous) values
  ('99999999-0000-0000-0000-000000000009', true);
insert into public.juegos (id, nombre, origen, creado_por) values
  ('22222222-0000-0000-0000-000000000002', 'Manual de A', 'manual', 'aaaaaaaa-0000-0000-0000-000000000001');

create function pg_temp.como(usuario uuid, anonimo boolean default false) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated', 'is_anonymous', anonimo)::text,
    true
  );
  set local role authenticated;
$$;

-- Dos partidas armadas a mano (como servidor): una competitiva y una cooperativa.
insert into public.partidas (id, codigo, juego_id, juego_nombre, anfitrion_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'AAAAAA', '22222222-0000-0000-0000-000000000002', 'Manual de A', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'BBBBBB', '22222222-0000-0000-0000-000000000002', 'Manual de A', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.partida_jugadores (partida_id, user_id, nombre, puntos) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'x', 10),
  ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'x', 15),
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 'x', 15),
  ('eeeeeeee-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000009', 'Gabi', 3),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'x', 0),
  ('eeeeeeee-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'x', 0);

-- ===========================================================================
-- Terminar
-- ===========================================================================
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select throws_ok(
  $$select public.terminar_partida('eeeeeeee-0000-0000-0000-000000000001', 'mas_puntos')$$,
  '42501', null,
  'Un jugador que no es anfitrión no termina la partida'
);
select throws_ok(
  $$update public.partidas set estado = 'terminada' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '42501', null,
  'Nadie cambia el estado a mano'
);

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok(
  $$select public.terminar_partida('eeeeeeee-0000-0000-0000-000000000001', 'cualquiera')$$,
  '22023', null,
  'El modo tiene que ser válido'
);
select throws_ok(
  $$select public.terminar_partida('eeeeeeee-0000-0000-0000-000000000002', 'cooperativo')$$,
  '22023', null,
  'En un cooperativo hay que decir si ganaron'
);
select lives_ok(
  $$select public.terminar_partida('eeeeeeee-0000-0000-0000-000000000001', 'mas_puntos')$$,
  'El anfitrión termina la partida'
);
select results_eq(
  $$select user_id::text, posicion::integer, gano from public.partida_jugadores
    where partida_id = 'eeeeeeee-0000-0000-0000-000000000001' order by posicion, user_id$$,
  $$values
    ('bbbbbbbb-0000-0000-0000-000000000002', 1, true),
    ('cccccccc-0000-0000-0000-000000000003', 1, true),
    ('aaaaaaaa-0000-0000-0000-000000000001', 2, false),
    ('99999999-0000-0000-0000-000000000009', 3, false)$$,
  'Gana el puntaje más alto; los empatados comparten posición'
);
select results_eq(
  $$select estado, modo_resultado, terminada_en is not null from public.partidas
    where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  $$values ('terminada'::text, 'mas_puntos'::text, true)$$,
  'La partida queda terminada con su modo'
);
select throws_ok(
  $$select public.terminar_partida('eeeeeeee-0000-0000-0000-000000000001', 'menos_puntos')$$,
  '42501', null,
  'Una partida terminada no se vuelve a terminar'
);
with u as (
  update public.partida_jugadores set puntos = 99
  where partida_id = 'eeeeeeee-0000-0000-0000-000000000001' returning 1
)
select is(count(*), 0::bigint, 'Terminada, nadie cambia los puntos') from u;
with d as (
  delete from public.partida_jugadores
  where partida_id = 'eeeeeeee-0000-0000-0000-000000000001'
    and user_id = 'bbbbbbbb-0000-0000-0000-000000000002' returning 1
)
select is(count(*), 0::bigint, 'Terminada, no se saca a nadie') from d;

select lives_ok(
  $$select public.terminar_partida('eeeeeeee-0000-0000-0000-000000000002', 'cooperativo', null, true)$$,
  'Cooperativo: ganaron todos'
);
select results_eq(
  $$select bool_and(gano), count(posicion) from public.partida_jugadores
    where partida_id = 'eeeeeeee-0000-0000-0000-000000000002'$$,
  $$values (true, 0::bigint)$$,
  'En un cooperativo ganan todos y no hay posiciones'
);
select is(
  (select cooperativo_ganado from public.partidas where id = 'eeeeeeee-0000-0000-0000-000000000002'),
  true,
  'Se guarda que ganaron'
);

-- Menos puntos y elegidos a mano, sobre partidas nuevas (armadas como servidor).
reset role;
insert into public.partidas (id, codigo, juego_nombre, anfitrion_id) values
  ('eeeeeeee-0000-0000-0000-000000000003', 'CCCCCC', 'Golf', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'DDDDDD', 'Dixit', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.partida_jugadores (partida_id, user_id, nombre, puntos) values
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'x', 30),
  ('eeeeeeee-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'x', 12),
  ('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'x', 1),
  ('eeeeeeee-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 'x', 9);
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');

select public.terminar_partida('eeeeeeee-0000-0000-0000-000000000003', 'menos_puntos');
select is(
  (select gano from public.partida_jugadores
   where partida_id = 'eeeeeeee-0000-0000-0000-000000000003' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  true,
  'Con "menos puntos", gana el más bajo'
);

select public.terminar_partida(
  'eeeeeeee-0000-0000-0000-000000000004', 'manual',
  array[(select id from public.partida_jugadores
         where partida_id = 'eeeeeeee-0000-0000-0000-000000000004'
           and user_id = 'aaaaaaaa-0000-0000-0000-000000000001')]
);
select results_eq(
  $$select user_id::text, gano from public.partida_jugadores
    where partida_id = 'eeeeeeee-0000-0000-0000-000000000004' order by user_id$$,
  $$values ('aaaaaaaa-0000-0000-0000-000000000001', true), ('bbbbbbbb-0000-0000-0000-000000000002', false)$$,
  'A mano, ganan los elegidos aunque tengan menos puntos'
);

-- ===========================================================================
-- Notas
-- ===========================================================================
select lives_ok(
  $$update public.partidas set notas = 'Revancha el sábado' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  'El anfitrión escribe las notas'
);
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
with u as (
  update public.partidas set notas = 'hackeado' where id = 'eeeeeeee-0000-0000-0000-000000000001' returning 1
)
select is(count(*), 0::bigint, 'Un jugador no cambia las notas') from u;
select is(
  (select notas from public.partidas where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'Revancha el sábado',
  'Los jugadores ven las notas'
);

-- ===========================================================================
-- Fotos
-- ===========================================================================
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('fotos-partidas', 'eeeeeeee-0000-0000-0000-000000000001/b.webp', 'bbbbbbbb-0000-0000-0000-000000000002')$$,
  'Un jugador sube una foto de la partida'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'fotos-partidas'),
  1::bigint,
  'Los jugadores ven las fotos'
);

select pg_temp.como('dddddddd-0000-0000-0000-000000000004');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('fotos-partidas', 'eeeeeeee-0000-0000-0000-000000000001/d.webp', 'dddddddd-0000-0000-0000-000000000004')$$,
  '42501', null,
  'Alguien que no jugó no sube fotos'
);
select is((select count(*) from storage.objects where bucket_id = 'fotos-partidas'), 0::bigint,
  'Alguien que no jugó no ve las fotos');
select is((select count(*) from public.partidas), 0::bigint, 'Ni las partidas');

select pg_temp.como('99999999-0000-0000-0000-000000000009', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('fotos-partidas', 'eeeeeeee-0000-0000-0000-000000000001/g.webp', '99999999-0000-0000-0000-000000000009')$$,
  '42501', null,
  'Un invitado no sube fotos'
);
select is((select count(*) from storage.objects where bucket_id = 'fotos-partidas'), 1::bigint,
  'Un invitado sí ve las fotos de su partida');

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('fotos-partidas', 'no-es-una-partida/a.webp', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', null,
  'Las fotos van en la carpeta de una partida'
);

-- ===========================================================================
-- Borrar partidas terminadas
-- ===========================================================================
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
with d as (delete from public.partidas where id = 'eeeeeeee-0000-0000-0000-000000000002' returning 1)
select is(count(*), 0::bigint, 'Un jugador no borra la partida') from d;

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$delete from public.partidas where id = 'eeeeeeee-0000-0000-0000-000000000002'$$,
  'El anfitrión borra una partida terminada'
);

select * from finish();
rollback;
