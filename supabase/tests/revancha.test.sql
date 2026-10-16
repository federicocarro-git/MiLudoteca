-- Tests de salas sin juego, revancha y reabrir partidas (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- A es anfitrión; B es amigo de A; C juega pero no es amigo; G es un
-- invitado anónimo.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@ejemplo.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'beto@ejemplo.com'),
  ('cccccccc-0000-0000-0000-000000000003', 'caro@ejemplo.com');
insert into auth.users (id, is_anonymous) values
  ('99999999-0000-0000-0000-000000000009', true);
insert into public.amistades (solicitante_id, destinatario_id, estado) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'aceptada');
insert into public.juegos (id, nombre, origen, creado_por) values
  ('a1111111-0000-0000-0000-000000000001', 'Manual de A', 'manual', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.catalogo_usuario (user_id, juego_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001');

-- P1: terminada, con hoja de categorías y cinco jugadores.
-- P2: terminada recién. P3: terminada hace 20 minutos.
-- P4: terminada recién, pero su código ya lo usa P5 (en curso).
insert into public.partidas (id, codigo, juego_id, juego_nombre, anfitrion_id, estado, terminada_en, modo_resultado, tipo_puntaje, categorias) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'AAAAAA', 'a1111111-0000-0000-0000-000000000001', 'Manual de A', 'aaaaaaaa-0000-0000-0000-000000000001', 'terminada', now() - interval '1 hour', 'mas_puntos', 'categorias', array['Militar', 'Ciencia']),
  ('eeeeeeee-0000-0000-0000-000000000002', 'BBBBBB', null, 'Catan', 'aaaaaaaa-0000-0000-0000-000000000001', 'terminada', now(), 'mas_puntos', 'total', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'CCCCCC', null, 'Catan', 'aaaaaaaa-0000-0000-0000-000000000001', 'terminada', now() - interval '20 minutes', 'mas_puntos', 'total', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'DDDDDD', null, 'Catan', 'aaaaaaaa-0000-0000-0000-000000000001', 'terminada', now(), 'mas_puntos', 'total', '{}');
insert into public.partidas (id, codigo, juego_nombre, anfitrion_id) values
  ('eeeeeeee-0000-0000-0000-000000000005', 'DDDDDD', 'Otra', 'cccccccc-0000-0000-0000-000000000003');
insert into public.partida_jugadores (partida_id, user_id, nombre, gano, posicion) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'x', true, 1),
  ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'x', false, 2),
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 'x', false, 3),
  ('eeeeeeee-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000009', 'Gabi', false, 4),
  ('eeeeeeee-0000-0000-0000-000000000001', null, 'Abuela', false, 5),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'x', true, 1),
  ('eeeeeeee-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'x', false, 2),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'x', true, 1),
  ('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'x', true, 1);

-- En una transacción now() no cambia: el orden de P1 se fija a mano.
update public.partida_jugadores set unido_en = now() - interval '1 hour' + (
  case when user_id is null then 5 else position(left(user_id::text, 1) in 'abc9') end
) * interval '1 minute'
where partida_id = 'eeeeeeee-0000-0000-0000-000000000001';

create function pg_temp.como(usuario uuid, anonimo boolean default false) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated', 'is_anonymous', anonimo)::text,
    true
  );
  set local role authenticated;
$$;

select throws_ok(
  $$insert into public.partidas (codigo, anfitrion_id, estado, terminada_en, modo_resultado)
    values ('EEEEEE', 'aaaaaaaa-0000-0000-0000-000000000001', 'terminada', now(), 'manual')$$,
  '23514', null,
  'Una partida terminada siempre tiene juego'
);

-- ===========================================================================
-- Sala sin juego
-- ===========================================================================
select pg_temp.como('99999999-0000-0000-0000-000000000009', true);
select throws_ok(
  $$select public.crear_sala_sin_juego()$$,
  '42501', null,
  'Un invitado anónimo no crea salas'
);

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$select public.crear_sala_sin_juego()$$, 'A crea una sala sin juego');
reset role;
select set_config('t.vacia', (
  select id::text from public.partidas
  where estado = 'en_curso' and anfitrion_id = 'aaaaaaaa-0000-0000-0000-000000000001'
), true);
select set_config('t.codigo', (select codigo from public.partidas where id = current_setting('t.vacia')::uuid), true);

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select is(
  (select juego_nombre from public.partidas where id = current_setting('t.vacia')::uuid),
  null,
  'La sala arranca sin juego'
);
select is(
  (select count(*) from public.partida_jugadores where partida_id = current_setting('t.vacia')::uuid),
  1::bigint,
  'Con el anfitrión como único jugador'
);
select throws_ok(
  $$select public.terminar_partida(current_setting('t.vacia')::uuid, 'mas_puntos')$$,
  'P0001', null,
  'Sin juego no se puede terminar'
);

select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (select juego_nombre from public.ver_sala(current_setting('t.codigo'))),
  null,
  'La vista previa muestra que no tiene juego'
);
select isnt(
  public.unirse_a_partida(current_setting('t.codigo')),
  null,
  'Y se puede entrar igual'
);

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$select public.cambiar_juego_de_sala(current_setting('t.vacia')::uuid, 'a1111111-0000-0000-0000-000000000001')$$,
  'El anfitrión elige el juego en la mesa'
);
select lives_ok(
  $$select public.terminar_partida(current_setting('t.vacia')::uuid, 'mas_puntos')$$,
  'Con juego, ya se puede terminar'
);

-- ===========================================================================
-- Revancha
-- ===========================================================================
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select throws_ok(
  $$select public.revancha('eeeeeeee-0000-0000-0000-000000000001')$$,
  '42501', null,
  'Solo el anfitrión arma la revancha'
);

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$select public.revancha('eeeeeeee-0000-0000-0000-000000000001')$$, 'A arma la revancha');
select results_eq(
  $$select juego_nombre, tipo_puntaje, categorias, estado from public.partidas
    where revancha_de = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  $$values ('Manual de A', 'categorias', array['Militar', 'Ciencia'], 'en_curso')$$,
  'Con el mismo juego y la misma hoja'
);
select results_eq(
  $$select j.user_id, j.nombre from public.partida_jugadores j
    join public.partidas p on p.id = j.partida_id
    where p.revancha_de = 'eeeeeeee-0000-0000-0000-000000000001'
    order by j.unido_en$$,
  $$values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'ana'),
           ('bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'beto'),
           (null::uuid, 'Abuela')$$,
  'Suma al amigo y al que juega sin celular; no al que no es amigo ni al invitado'
);
select is(
  (select p.id from public.revancha('eeeeeeee-0000-0000-0000-000000000001') p),
  (select id from public.partidas where revancha_de = 'eeeeeeee-0000-0000-0000-000000000001'),
  'Tocar dos veces devuelve la misma revancha'
);

select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (select count(*) from public.partidas
   where revancha_de = 'eeeeeeee-0000-0000-0000-000000000001' and estado = 'en_curso'),
  1::bigint,
  'B ve la revancha en la que lo sumaron'
);

-- ===========================================================================
-- Reabrir
-- ===========================================================================
select throws_ok(
  $$select public.reabrir_partida('eeeeeeee-0000-0000-0000-000000000002')$$,
  '42501', null,
  'Solo el anfitrión reabre la partida'
);

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok(
  $$select public.reabrir_partida('eeeeeeee-0000-0000-0000-000000000003')$$,
  'P0001', null,
  'Pasados 10 minutos ya no se reabre'
);
select is(
  public.reabrir_partida('eeeeeeee-0000-0000-0000-000000000002'),
  'BBBBBB',
  'El anfitrión reabre una recién terminada, con el mismo código'
);
select results_eq(
  $$select estado, terminada_en, modo_resultado from public.partidas
    where id = 'eeeeeeee-0000-0000-0000-000000000002'$$,
  $$values ('en_curso', null::timestamptz, null::text)$$,
  'Vuelve a estar en curso y sin resultado'
);
select is(
  (select count(*) from public.partida_jugadores
   where partida_id = 'eeeeeeee-0000-0000-0000-000000000002' and (gano or posicion is not null)),
  0::bigint,
  'Nadie queda como ganador'
);
select isnt(
  public.reabrir_partida('eeeeeeee-0000-0000-0000-000000000004'),
  'DDDDDD',
  'Si otra sala tomó el código, se usa otro'
);

select * from finish();
rollback;
