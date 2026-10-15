-- Tests de perfiles y amistades (pgTAP). Correr con: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- Tres usuarios: A y B se van a hacer amigos; C es un extraño. El trigger de
-- auth.users les crea el perfil. Un anónimo (invitado) no tiene perfil.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@ejemplo.com', '{"full_name": "Ana Pérez"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'beto@ejemplo.com', '{}'),
  ('cccccccc-0000-0000-0000-000000000003', 'caro@ejemplo.com', '{}');
insert into auth.users (id, is_anonymous) values
  ('dddddddd-0000-0000-0000-000000000004', true);

-- Códigos fijos para poder usarlos en los tests.
update public.perfiles set codigo_amigo = 'AAAAAA' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.perfiles set codigo_amigo = 'BBBBBB' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.perfiles set codigo_amigo = 'CCCCCC' where id = 'cccccccc-0000-0000-0000-000000000003';

create function pg_temp.como(usuario uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- ===========================================================================
-- Trigger de perfiles
-- ===========================================================================
select results_eq(
  $$select nombre from public.perfiles where id in (
      'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002'
    ) order by nombre$$,
  array['Ana Pérez', 'beto'],
  'El perfil toma el nombre de Google o lo que va antes de la @'
);

select is(
  (select count(*) from public.perfiles where id = 'dddddddd-0000-0000-0000-000000000004'),
  0::bigint,
  'Un usuario anónimo no tiene perfil'
);

select matches(
  public.generar_codigo(6),
  '^[A-HJ-NP-Z2-9]{6}$',
  'Los códigos no usan I, O, 0 ni 1'
);

-- ===========================================================================
-- Perfiles
-- ===========================================================================
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');

select results_eq(
  'select nombre from public.perfiles',
  array['Ana Pérez'],
  'Sin amigos, A solo ve su perfil'
);

select lives_ok(
  $$update public.perfiles set nombre = 'Ana' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'A puede cambiar su nombre'
);

select throws_ok(
  $$update public.perfiles set codigo_amigo = 'ZZZZZZ' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501', null,
  'A no puede elegir su código de amigo'
);

with u as (update public.perfiles set nombre = 'hackeado' where id = 'bbbbbbbb-0000-0000-0000-000000000002' returning 1)
select is(count(*), 0::bigint, 'A no puede cambiar el nombre de B') from u;

select throws_ok(
  $$insert into public.perfiles (id, nombre, codigo_amigo) values ('cccccccc-0000-0000-0000-000000000003', 'x', 'XXXXXX')$$,
  '42501', null,
  'Nadie crea perfiles a mano'
);

select throws_ok(
  $$select public.generar_codigo(6)$$,
  '42501', null,
  'Las funciones internas no se pueden llamar desde la API'
);

-- ===========================================================================
-- Solicitudes
-- ===========================================================================
select is(public.enviar_solicitud_amistad('zzzzzz'), 'no_encontrado', 'Código inexistente');
select is(public.enviar_solicitud_amistad('aaaaaa'), 'propio', 'El código propio no sirve');
select is(public.enviar_solicitud_amistad(' bbbbbb '), 'enviada', 'A le manda una solicitud a B (ignora mayúsculas y espacios)');
select is(public.enviar_solicitud_amistad('BBBBBB'), 'ya_enviada', 'No se duplica la solicitud');

select results_eq(
  'select nombre from public.perfiles order by nombre',
  array['Ana', 'beto'],
  'Con una solicitud pendiente, A ve el perfil de B'
);

with u as (
  update public.amistades set estado = 'aceptada'
  where solicitante_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1
)
select is(count(*), 0::bigint, 'A no puede aceptar su propia solicitud') from u;

select throws_ok(
  $$insert into public.amistades (solicitante_id, destinatario_id, estado)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 'aceptada')$$,
  '42501', null,
  'No se pueden crear amistades a mano'
);

-- C no ve nada de A y B.
select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
select is((select count(*) from public.amistades), 0::bigint, 'C no ve la solicitud de A a B');
select results_eq('select nombre from public.perfiles', array['caro'], 'C no ve los perfiles de A ni B');

with d as (delete from public.amistades returning 1)
select is(count(*), 0::bigint, 'C no puede borrar amistades ajenas') from d;

-- B acepta.
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select lives_ok(
  $$update public.amistades set estado = 'aceptada'
    where solicitante_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'B acepta la solicitud de A'
);
select isnt(
  (select aceptada_en from public.amistades where solicitante_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  null,
  'Se registra cuándo se aceptó'
);
select is(public.es_amigo('aaaaaaaa-0000-0000-0000-000000000001'), true, 'B es amigo de A');
select is(public.enviar_solicitud_amistad('AAAAAA'), 'ya_amigos', 'Ya son amigos');

with u as (update public.amistades set estado = 'pendiente' returning 1)
select is(count(*), 0::bigint, 'Una amistad aceptada no vuelve a pendiente') from u;

-- Solicitud cruzada: si C ya le pidió a B, que B le pida a C la acepta.
select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
select is(public.enviar_solicitud_amistad('BBBBBB'), 'enviada', 'C le pide a B');
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select is(public.enviar_solicitud_amistad('CCCCCC'), 'aceptada', 'B le pide a C: quedan como amigos');

-- Un invitado anónimo no puede mandar solicitudes.
select pg_temp.como('dddddddd-0000-0000-0000-000000000004');
select throws_ok(
  $$select public.enviar_solicitud_amistad('AAAAAA')$$,
  '42501', null,
  'Un invitado anónimo no puede agregar amigos'
);

-- Dejar de ser amigos.
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select lives_ok(
  $$delete from public.amistades where solicitante_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'B puede dejar de ser amigo de A'
);

select * from finish();
rollback;
