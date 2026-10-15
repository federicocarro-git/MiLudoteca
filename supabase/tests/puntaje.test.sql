-- Tests de puntuación por rondas, categorías y hojas guardadas (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- A es anfitrión; B juega; G es invitado anónimo; D no está en la sala.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@ejemplo.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'beto@ejemplo.com'),
  ('dddddddd-0000-0000-0000-000000000004', 'dani@ejemplo.com');
insert into auth.users (id, is_anonymous) values
  ('99999999-0000-0000-0000-000000000009', true);
insert into public.juegos (id, nombre, origen, creado_por) values
  ('a1111111-0000-0000-0000-000000000001', 'Manual de A', 'manual', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d4444444-0000-0000-0000-000000000004', 'Manual de D', 'manual', 'dddddddd-0000-0000-0000-000000000004');

insert into public.partidas (id, codigo, juego_id, juego_nombre, anfitrion_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'AAAAAA', 'a1111111-0000-0000-0000-000000000001', 'Manual de A', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.partida_jugadores (id, partida_id, user_id, nombre) values
  ('11111111-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'x'),
  ('11111111-0000-0000-0000-00000000000b', 'eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'x'),
  ('11111111-0000-0000-0000-000000000009', 'eeeeeeee-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000009', 'Gabi'),
  ('11111111-0000-0000-0000-0000000000ab', 'eeeeeeee-0000-0000-0000-000000000001', null, 'Abuela');

create function pg_temp.como(usuario uuid, anonimo boolean default false) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated', 'is_anonymous', anonimo)::text,
    true
  );
  set local role authenticated;
$$;

-- ===========================================================================
-- Configurar
-- ===========================================================================
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select throws_ok(
  $$select public.configurar_puntaje('eeeeeeee-0000-0000-0000-000000000001', 'rondas')$$,
  '42501', null,
  'Solo el anfitrión elige cómo se anota'
);
select throws_ok(
  $$select public.anotar_puntos('11111111-0000-0000-0000-00000000000b', 0, 5)$$,
  '22023', null,
  'En una sala de total no se anotan casilleros'
);

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok(
  $$select public.configurar_puntaje('eeeeeeee-0000-0000-0000-000000000001', 'categorias', array['  ', ''])$$,
  '22023', null,
  'Una hoja necesita al menos una categoría'
);
select lives_ok(
  $$select public.configurar_puntaje('eeeeeeee-0000-0000-0000-000000000001', 'categorias', array[' Militar ', '', 'Ciencia'])$$,
  'El anfitrión elige una hoja con categorías'
);
select is(
  (select categorias from public.partidas where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  array['Militar', 'Ciencia'],
  'Las categorías quedan limpias y en orden'
);
select lives_ok(
  $$select public.configurar_puntaje('eeeeeeee-0000-0000-0000-000000000001', 'rondas')$$,
  'Sin puntos todavía, se puede cambiar a rondas'
);

-- ===========================================================================
-- Anotar
-- ===========================================================================
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select lives_ok(
  $$select public.anotar_puntos('11111111-0000-0000-0000-00000000000b', 0, 5)$$,
  'B anota su ronda 1'
);
select throws_ok(
  $$select public.anotar_puntos('11111111-0000-0000-0000-00000000000b', 1, 5)$$,
  '22023', null,
  'No hay ronda 2 hasta que alguien la agrega'
);
select lives_ok(
  $$select public.agregar_ronda('eeeeeeee-0000-0000-0000-000000000001')$$,
  'Cualquiera de la sala agrega una ronda'
);
select lives_ok(
  $$select public.anotar_puntos('11111111-0000-0000-0000-00000000000b', 1, 7)$$,
  'B anota la ronda 2'
);
select is(
  (select puntos from public.partida_jugadores where id = '11111111-0000-0000-0000-00000000000b'),
  12,
  'El total es la suma de las rondas'
);
select throws_ok(
  $$select public.anotar_puntos('11111111-0000-0000-0000-00000000000a', 0, 99)$$,
  '42501', null,
  'B no anota en la columna de A'
);
with u as (
  update public.partida_jugadores set puntos = 100
  where id = '11111111-0000-0000-0000-00000000000b' returning 1
)
select is(count(*), 0::bigint, 'Con rondas, el total no se escribe a mano') from u;
select throws_ok(
  $$insert into public.partida_anotaciones (jugador_id, partida_id, columna, puntos)
    values ('11111111-0000-0000-0000-00000000000b', 'eeeeeeee-0000-0000-0000-000000000001', 0, 1)$$,
  '42501', null,
  'Los casilleros no se escriben directo en la tabla'
);
select lives_ok(
  $$select public.anotar_puntos('11111111-0000-0000-0000-00000000000b', 1, null)$$,
  'B borra un casillero'
);
select is(
  (select puntos from public.partida_jugadores where id = '11111111-0000-0000-0000-00000000000b'),
  5,
  'Y el total se recalcula'
);

select pg_temp.como('99999999-0000-0000-0000-000000000009', true);
select lives_ok(
  $$select public.anotar_puntos('11111111-0000-0000-0000-000000000009', 0, 3)$$,
  'Un invitado anota los suyos'
);
select is(
  (select count(*) from public.partida_anotaciones),
  2::bigint,
  'Y ve los casilleros de la sala'
);

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$select public.anotar_puntos('11111111-0000-0000-0000-0000000000ab', 0, 8)$$,
  'El anfitrión anota por quien juega sin celular'
);
select throws_ok(
  $$select public.configurar_puntaje('eeeeeeee-0000-0000-0000-000000000001', 'total')$$,
  'P0001', null,
  'Con puntos cargados ya no se cambia la forma de anotar'
);

select pg_temp.como('dddddddd-0000-0000-0000-000000000004');
select is((select count(*) from public.partida_anotaciones), 0::bigint,
  'Alguien que no está en la sala no ve los casilleros');
select throws_ok(
  $$select public.agregar_ronda('eeeeeeee-0000-0000-0000-000000000001')$$,
  '42501', null,
  'Ni agrega rondas'
);

-- ===========================================================================
-- Hojas guardadas
-- ===========================================================================
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$insert into public.hojas_de_puntuacion (juego_id, categorias)
    values ('a1111111-0000-0000-0000-000000000001', array['Militar', 'Ciencia'])$$,
  'A guarda una hoja para su juego'
);
select throws_ok(
  $$insert into public.hojas_de_puntuacion (juego_id, categorias)
    values ('d4444444-0000-0000-0000-000000000004', array['x'])$$,
  '42501', null,
  'A no guarda hojas para un juego que no puede ver'
);

select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*) from public.hojas_de_puntuacion), 0::bigint, 'B no ve la hoja de A');

select pg_temp.como('99999999-0000-0000-0000-000000000009', true);
select throws_ok(
  $$insert into public.hojas_de_puntuacion (juego_id, categorias)
    values ('a1111111-0000-0000-0000-000000000001', array['x'])$$,
  '42501', null,
  'Un invitado no guarda hojas'
);

select * from finish();
rollback;
