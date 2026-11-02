-- Tests de nombres en español y de partidas importadas de BGG (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- A importa; B es amigo de A; C no es amigo de nadie.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@ejemplo.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'beto@ejemplo.com'),
  ('cccccccc-0000-0000-0000-000000000003', 'caro@ejemplo.com');
insert into public.amistades (solicitante_id, destinatario_id, estado) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'aceptada');

insert into public.juegos (id, nombre, origen, creado_por, bgg_id, nombres_alternativos, imagen_url, imagen_es, jugadores_recomendados) values
  ('a1111111-0000-0000-0000-000000000013', 'CATAN', 'bgg', null, 13,
   '{"Catán","Die Siedler von Catan"}', 'https://cf.geekdo-images.com/en.jpg',
   'https://cf.geekdo-images.com/es.jpg', '{3,4}');
insert into public.catalogo_usuario (user_id, juego_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000013');

create function pg_temp.como(usuario uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
$$;

-- ===========================================================================
-- Nombre en español
-- ===========================================================================
select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
select throws_ok(
  $$select public.elegir_nombre_es('a1111111-0000-0000-0000-000000000013', 'Catán')$$,
  '42501', null,
  'Quien no tiene el juego no elige su nombre'
);

select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok(
  $$select public.elegir_nombre_es('a1111111-0000-0000-0000-000000000013', 'Cualquier cosa')$$,
  '22023', null,
  'Solo uno de los nombres que tiene en BGG'
);
select lives_ok(
  $$select public.elegir_nombre_es('a1111111-0000-0000-0000-000000000013', 'Catán')$$,
  'Quien lo tiene elige el nombre en español'
);
select results_eq(
  $$select nombre, imagen_url, nombre_original, jugadores_recomendados from public.mi_catalogo$$,
  $$values ('Catán', 'https://cf.geekdo-images.com/es.jpg', 'CATAN', '{3,4}'::smallint[])$$,
  'El estante muestra el nombre y la caja en español'
);
select set_config('t.sala', (
  select c.id::text from public.crear_partida('a1111111-0000-0000-0000-000000000013') c
), true);
select is(
  (select juego_nombre from public.partidas where id = current_setting('t.sala')::uuid),
  'Catán',
  'La sala copia el nombre en español'
);
select results_eq(
  $$select nombre, jugadores_recomendados
    from public.juegos_de_la_mesa(current_setting('t.sala')::uuid)$$,
  $$values ('Catán', '{3,4}'::smallint[])$$,
  'La mesa también, con los jugadores recomendados'
);
select lives_ok(
  $$select public.elegir_nombre_es('a1111111-0000-0000-0000-000000000013', null)$$,
  'Se puede volver al nombre de BGG'
);
select is(
  (select nombre from public.mi_catalogo),
  'CATAN',
  'Y vuelve a verse el original'
);

-- ===========================================================================
-- Partidas de BGG
-- ===========================================================================
select results_eq(
  $$select * from public.importar_partidas_bgg($j$[
    {"bgg_play_id": 9001, "juego_id": "a1111111-0000-0000-0000-000000000013",
     "juego_nombre": "CATAN", "jugado_en": "2026-10-20", "minutos": 60,
     "jugadores": [
       {"user_id": "aaaaaaaa-0000-0000-0000-000000000001", "nombre": "Ana", "puntos": 10, "gano": true},
       {"user_id": "bbbbbbbb-0000-0000-0000-000000000002", "nombre": "Beto", "puntos": 8, "gano": false},
       {"user_id": "cccccccc-0000-0000-0000-000000000003", "nombre": "Caro", "puntos": 8, "gano": false}
     ]},
    {"bgg_play_id": 9002, "juego_id": null, "juego_nombre": "Pandemic",
     "jugado_en": "2026-10-21", "minutos": null,
     "jugadores": [{"user_id": "aaaaaaaa-0000-0000-0000-000000000001", "nombre": "Yo", "puntos": null, "gano": true}]}
  ]$j$::jsonb)$$,
  $$values (2, 0)$$,
  'Importa las partidas nuevas'
);
select results_eq(
  $$select * from public.importar_partidas_bgg($j$[
    {"bgg_play_id": 9001, "juego_nombre": "CATAN", "jugado_en": "2026-10-20", "jugadores": []}
  ]$j$::jsonb)$$,
  $$values (0, 1)$$,
  'Una partida ya importada no se repite'
);
select results_eq(
  $$select estado, modo_resultado, juego_nombre from public.partidas
    where bgg_play_id = 9001$$,
  $$values ('terminada', 'manual', 'CATAN')$$,
  'Queda terminada, con los ganadores que dice BGG'
);
select results_eq(
  $$select j.nombre, j.user_id, j.gano, j.posicion from public.partida_jugadores j
    join public.partidas p on p.id = j.partida_id
    where p.bgg_play_id = 9001 order by j.unido_en$$,
  $$values ('ana', 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, true, 1::smallint),
           ('beto', 'bbbbbbbb-0000-0000-0000-000000000002'::uuid, false, 2::smallint),
           ('Caro', null::uuid, false, 2::smallint)$$,
  'El amigo entra con su cuenta; quien no es amigo, sin cuenta; posiciones por puntos'
);
select is(
  (select j.posicion from public.partida_jugadores j
   join public.partidas p on p.id = j.partida_id where p.bgg_play_id = 9002),
  null,
  'Sin puntos en BGG no hay posiciones'
);
select throws_ok(
  $$select public.importar_partidas_bgg((select jsonb_agg(jsonb_build_object(
      'bgg_play_id', g, 'juego_nombre', 'X', 'jugado_en', '2026-01-01', 'jugadores', '[]'::jsonb))
    from generate_series(1, 101) g))$$,
  '22023', null,
  'Hasta 100 partidas por vez'
);

select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (select count(*) from public.partidas where bgg_play_id = 9001),
  1::bigint,
  'El amigo ve la partida en su historial'
);

select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
select is(
  (select count(*) from public.partidas where bgg_play_id is not null),
  0::bigint,
  'Quien no es amigo no la ve (no quedó como jugador con cuenta)'
);

select * from finish();
rollback;
