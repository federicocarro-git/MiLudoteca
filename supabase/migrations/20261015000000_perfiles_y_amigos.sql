-- =============================================================================
-- Fase 2, hito 9: perfiles y amigos
--
-- Tablas:
--   perfiles   nombre visible y código de amigo de cada usuario (uno por
--              cuenta; se crea solo al registrarse)
--   amistades  solicitudes de amistad y amistades aceptadas
--
-- Reglas de acceso (RLS), en resumen:
--   * perfiles: cada usuario ve el propio y el de las personas con las que
--     tiene una amistad o una solicitud (en cualquier sentido). Solo edita su
--     nombre. Nadie puede buscar perfiles por código: eso pasa por la función
--     enviar_solicitud_amistad(), que no devuelve datos del otro.
--   * amistades: cada uno ve las suyas. La solicitud se crea con la función
--     anterior; la acepta solo quien la recibió; cualquiera de los dos la borra
--     (rechazar, cancelar o dejar de ser amigos).
--
-- Los usuarios anónimos (invitados de las salas, hito 10) no tienen perfil.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Códigos cortos para compartir (amigos y, después, salas)
--
-- 32 símbolos, sin I, O, 0 ni 1 para que no se confundan al dictarlos.
-- -----------------------------------------------------------------------------

create or replace function public.generar_codigo(largo integer)
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1),
    ''
  )
  from generate_series(1, largo);
$$;

revoke execute on function public.generar_codigo(integer) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- perfiles
-- -----------------------------------------------------------------------------

create table public.perfiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  nombre         text not null check (char_length(btrim(nombre)) between 1 and 40),
  codigo_amigo   text not null unique check (codigo_amigo ~ '^[A-HJ-NP-Z2-9]{6}$'),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.perfiles is
  'Datos públicos de cada usuario para sus amigos: nombre visible y código para agregarlo.';

create trigger perfiles_actualizado_en
  before update on public.perfiles
  for each row execute function public.set_actualizado_en();

-- Crea el perfil de un usuario si no lo tiene. Reintenta si el código sale
-- repetido (con 32^6 combinaciones casi nunca pasa).
create or replace function public.asegurar_perfil(usuario uuid, nombre_inicial text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := left(btrim(coalesce(nullif(btrim(nombre_inicial), ''), 'Jugador')), 40);
begin
  loop
    begin
      insert into public.perfiles (id, nombre, codigo_amigo)
      values (usuario, v_nombre, public.generar_codigo(6))
      on conflict (id) do nothing;
      return;
    exception when unique_violation then
      -- Código repetido: probar con otro.
    end;
  end loop;
end;
$$;

revoke execute on function public.asegurar_perfil(uuid, text) from public, anon, authenticated;

-- Nombre inicial: el de Google (full_name/name) o lo que va antes de la @.
create or replace function public.crear_perfil_de_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  perform public.asegurar_perfil(
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

revoke execute on function public.crear_perfil_de_usuario_nuevo() from public, anon, authenticated;

create trigger crear_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil_de_usuario_nuevo();

-- Un invitado anónimo que después se registra (linkIdentity / updateUser con
-- email) deja de ser anónimo: ahí también necesita perfil.
create trigger crear_perfil_al_dejar_de_ser_anonimo
  after update of is_anonymous on auth.users
  for each row
  when (old.is_anonymous and not new.is_anonymous)
  execute function public.crear_perfil_de_usuario_nuevo();

-- Perfiles para las cuentas que ya existían.
do $$
declare
  u record;
begin
  for u in
    select id, email, raw_user_meta_data from auth.users where not coalesce(is_anonymous, false)
  loop
    perform public.asegurar_perfil(
      u.id,
      coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1))
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- amistades
--
-- Una fila por par de usuarios, sin importar quién la pidió (índice único
-- sobre el par ordenado).
-- -----------------------------------------------------------------------------

create table public.amistades (
  solicitante_id uuid not null references public.perfiles (id) on delete cascade,
  destinatario_id uuid not null references public.perfiles (id) on delete cascade,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'aceptada')),
  creado_en      timestamptz not null default now(),
  aceptada_en    timestamptz,

  primary key (solicitante_id, destinatario_id),
  constraint amistades_no_con_uno_mismo check (solicitante_id <> destinatario_id)
);

comment on table public.amistades is 'Solicitudes de amistad (pendiente) y amistades (aceptada).';

create unique index amistades_par_unico
  on public.amistades (least(solicitante_id, destinatario_id), greatest(solicitante_id, destinatario_id));
create index amistades_destinatario_idx on public.amistades (destinatario_id);

create or replace function public.marcar_amistad_aceptada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado = 'aceptada' and old.estado <> 'aceptada' then
    new.aceptada_en := now();
  end if;
  return new;
end;
$$;

create trigger amistades_aceptada_en
  before update on public.amistades
  for each row execute function public.marcar_amistad_aceptada();

-- ¿Hay amistad aceptada entre el usuario actual y otro? La usan las políticas
-- de las tablas de los hitos siguientes.
create or replace function public.es_amigo(otro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.amistades a
    where a.estado = 'aceptada'
      and (
        (a.solicitante_id = (select auth.uid()) and a.destinatario_id = otro)
        or (a.destinatario_id = (select auth.uid()) and a.solicitante_id = otro)
      )
  );
$$;

revoke execute on function public.es_amigo(uuid) from public, anon;
grant execute on function public.es_amigo(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Enviar una solicitud a partir del código de amigo
--
-- security definer: busca el perfil por código sin que la tabla quede abierta
-- para buscar. Devuelve qué pasó, nunca datos del otro usuario:
--   'enviada'       se creó la solicitud
--   'aceptada'      el otro ya te había mandado una: quedan como amigos
--   'ya_enviada'    ya le habías mandado una que sigue pendiente
--   'ya_amigos'     ya eran amigos
--   'propio'        es tu propio código
--   'no_encontrado' no hay nadie con ese código
-- -----------------------------------------------------------------------------

create or replace function public.enviar_solicitud_amistad(codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  otro uuid;
  existente public.amistades;
begin
  if yo is null or not exists (select 1 from public.perfiles where id = yo) then
    raise exception 'Hace falta una cuenta para agregar amigos' using errcode = '42501';
  end if;

  select id into otro from public.perfiles where codigo_amigo = upper(btrim(codigo));
  if otro is null then
    return 'no_encontrado';
  end if;
  if otro = yo then
    return 'propio';
  end if;

  select * into existente
  from public.amistades a
  where (a.solicitante_id = yo and a.destinatario_id = otro)
     or (a.solicitante_id = otro and a.destinatario_id = yo);

  if not found then
    insert into public.amistades (solicitante_id, destinatario_id) values (yo, otro);
    return 'enviada';
  end if;
  if existente.estado = 'aceptada' then
    return 'ya_amigos';
  end if;
  if existente.solicitante_id = yo then
    return 'ya_enviada';
  end if;
  update public.amistades
  set estado = 'aceptada'
  where solicitante_id = otro and destinatario_id = yo;
  return 'aceptada';
end;
$$;

revoke execute on function public.enviar_solicitud_amistad(text) from public, anon;
grant execute on function public.enviar_solicitud_amistad(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Permisos y RLS
-- -----------------------------------------------------------------------------

revoke all on public.perfiles, public.amistades from anon, authenticated;

-- perfiles: solo se lee y se cambia el nombre. Los crea el trigger y se borran
-- en cascada con la cuenta.
grant select on public.perfiles to authenticated;
grant update (nombre) on public.perfiles to authenticated;

-- amistades: las crea enviar_solicitud_amistad(); aceptar es cambiar el estado.
grant select, delete on public.amistades to authenticated;
grant update (estado) on public.amistades to authenticated;

alter table public.perfiles  enable row level security;
alter table public.amistades enable row level security;

-- perfiles --------------------------------------------------------------------

create policy "perfiles: leer el propio y los de amigos o solicitudes"
  on public.perfiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.amistades a
      where (a.solicitante_id = (select auth.uid()) and a.destinatario_id = perfiles.id)
         or (a.destinatario_id = (select auth.uid()) and a.solicitante_id = perfiles.id)
    )
  );

create policy "perfiles: editar el propio"
  on public.perfiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- amistades -------------------------------------------------------------------

create policy "amistades: leer las propias"
  on public.amistades for select
  to authenticated
  using (solicitante_id = (select auth.uid()) or destinatario_id = (select auth.uid()));

create policy "amistades: aceptar las recibidas"
  on public.amistades for update
  to authenticated
  using (destinatario_id = (select auth.uid()) and estado = 'pendiente')
  with check (destinatario_id = (select auth.uid()) and estado = 'aceptada');

create policy "amistades: borrar las propias"
  on public.amistades for delete
  to authenticated
  using (solicitante_id = (select auth.uid()) or destinatario_id = (select auth.uid()));
