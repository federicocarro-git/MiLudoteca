-- Tests de catálogos de amigos y de la mesa (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- A es amigo de B y de D (D oculta su catálogo). C no es amigo de nadie.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@ejemplo.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'beto@ejemplo.com'),
  ('cccccccc-0000-0000-0000-000000000003', 'caro@ejemplo.com'),
  ('dddddddd-0000-0000-0000-000000000004', 'dani@ejemplo.com');
update public.perfiles set catalogo_visible = false where id = 'dddddddd-0000-0000-0000-000000000004';
insert into public.amistades (solicitante_id, destinatario_id, estado) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'aceptada'),
  ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'aceptada');

insert into public.juegos (id, nombre, origen, creado_por) values
  ('a1111111-0000-0000-0000-000000000001', 'Manual de A', 'manual', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('b2222222-0000-0000-0000-000000000002', 'Manual de B', 'manual', 'bbbbbbbb-0000-0000-0000-000000000002'),
  ('c3333333-0000-0000-0000-000000000003', 'Manual de C', 'manual', 'cccccccc-0000-0000-0000-000000000003'),
  ('d4444444-0000-0000-0000-000000000004', 'Manual de D', 'manual', 'dddddddd-0000-0000-0000-000000000004');
insert into public.catalogo_usuario (user_id, juego_id, notas, puntuacion) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 'secreto de A', 9),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b2222222-0000-0000-0000-000000000002', 'secreto de B', 3),
  ('cccccccc-0000-0000-0000-000000000003', 'c3333333-0000-0000-0000-000000000003', null, null),
  ('dddddddd-0000-0000-0000-000000000004', 'd4444444-0000-0000-0000-000000000004', null, null);

-- Una sala de A con C y D.
insert into public.partidas (id, codigo, juego_id, juego_nombre, anfitrion_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'AAAAAA', 'a1111111-0000-0000-0000-000000000001', 'Manual de A', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.partida_jugadores (partida_id, user_id, nombre) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'x'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 'x'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000004', 'x');

create function pg_temp.como(usuario uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- ===========================================================================
-- ¿Quién lo tiene?
-- ===========================================================================
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select results_eq(
  'select dueno_nombre, nombre from public.catalogo_de_amigos()',
  $$values ('beto'::text, 'Manual de B'::text)$$,
  'A ve los juegos de sus amigos que muestran el catálogo (B sí, D no, C no es amigo)'
);
select is(
  (select count(*) from public.juegos where id = 'b2222222-0000-0000-0000-000000000002'),
  0::bigint,
  'El juego manual de B sigue privado por RLS'
);
select is(
  (select count(*) from public.catalogo_usuario where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  0::bigint,
  'Y el catálogo de B (con sus notas) también'
);
select lives_ok(
  $$update public.perfiles set catalogo_visible = false where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'A puede ocultar su catálogo'
);
with u as (
  update public.perfiles set catalogo_visible = true
  where id = 'dddddddd-0000-0000-0000-000000000004' returning 1
)
select is(count(*), 0::bigint, 'A no cambia la opción de D') from u;

select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*) from public.catalogo_de_amigos()), 0::bigint,
  'Con A oculto, B no ve nada');

select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
select is((select count(*) from public.catalogo_de_amigos()), 0::bigint, 'Sin amigos, nada');

-- ===========================================================================
-- Juegos de la mesa
-- ===========================================================================
select results_eq(
  $$select nombre from public.juegos_de_la_mesa('eeeeeeee-0000-0000-0000-000000000001') order by nombre$$,
  array['Manual de C'],
  'En la sala, C ve su catálogo; A está oculto y D también'
);

select pg_temp.como('dddddddd-0000-0000-0000-000000000004');
select results_eq(
  $$select nombre from public.juegos_de_la_mesa('eeeeeeee-0000-0000-0000-000000000001') order by nombre$$,
  array['Manual de C', 'Manual de D'],
  'Aunque esté oculto, cada uno ve su propio catálogo en la mesa'
);

select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (select count(*) from public.juegos_de_la_mesa('eeeeeeee-0000-0000-0000-000000000001')),
  0::bigint,
  'Alguien que no está en la sala no ve los juegos de la mesa'
);

-- ===========================================================================
-- Cambiar el juego de la sala
-- ===========================================================================
select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
select throws_ok(
  $$select public.cambiar_juego_de_sala('eeeeeeee-0000-0000-0000-000000000001', 'c3333333-0000-0000-0000-000000000003')$$,
  '42501', null,
  'Un jugador que no es anfitrión no cambia el juego'
);

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$select public.cambiar_juego_de_sala('eeeeeeee-0000-0000-0000-000000000001', 'c3333333-0000-0000-0000-000000000003')$$,
  'El anfitrión cambia el juego por uno de la mesa (de C)'
);
select results_eq(
  $$select juego_id::text, juego_nombre from public.partidas where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  $$values ('c3333333-0000-0000-0000-000000000003', 'Manual de C'::text)$$,
  'La sala queda con el juego nuevo, copiado'
);
select lives_ok(
  $$select public.cambiar_juego_de_sala('eeeeeeee-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001')$$,
  'Su propio juego siempre vale, aunque oculte el catálogo'
);
select throws_ok(
  $$select public.cambiar_juego_de_sala('eeeeeeee-0000-0000-0000-000000000001', 'b2222222-0000-0000-0000-000000000002')$$,
  'P0002', null,
  'No se puede elegir un juego de alguien que no está en la sala'
);
select throws_ok(
  $$select public.cambiar_juego_de_sala('eeeeeeee-0000-0000-0000-000000000001', 'd4444444-0000-0000-0000-000000000004')$$,
  'P0002', null,
  'Ni el de alguien de la sala que oculta su catálogo'
);

select * from finish();
rollback;
