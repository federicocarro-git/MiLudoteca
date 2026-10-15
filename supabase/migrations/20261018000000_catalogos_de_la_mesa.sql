-- =============================================================================
-- Fase 2, hito 13: catálogos de la mesa
--
-- * perfiles.catalogo_visible: si tus amigos (y quienes juegan con vos en una
--   sala) pueden ver qué juegos tenés. Por defecto, sí.
-- * catalogo_de_amigos(): los juegos de tus amigos ("¿Quién lo tiene?").
-- * juegos_de_la_mesa(partida): los juegos de quienes están en la sala, para
--   "¿A qué jugamos?" con la mesa.
-- * cambiar_juego_de_sala(partida, juego): el anfitrión cambia el juego de una
--   sala en curso por uno de la mesa.
--
-- Las funciones son security definer y devuelven solo los datos del juego y
-- de quién lo tiene: nunca las notas ni la puntuación del catálogo, y sin
-- abrir las tablas (catalogo_usuario y los juegos manuales siguen privados
-- por RLS).
-- =============================================================================

alter table public.perfiles
  add column catalogo_visible boolean not null default true;

comment on column public.perfiles.catalogo_visible is
  'Si los amigos y los jugadores de las salas pueden ver los juegos del catálogo.';

grant update (catalogo_visible) on public.perfiles to authenticated;

-- -----------------------------------------------------------------------------
-- Juegos de los amigos
-- -----------------------------------------------------------------------------

create or replace function public.catalogo_de_amigos()
returns table (
  dueno_id uuid,
  dueno_nombre text,
  juego_id uuid,
  bgg_id integer,
  nombre text,
  imagen_url text,
  jugadores_min smallint,
  jugadores_max smallint,
  duracion_min smallint,
  complejidad numeric,
  tipos text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pf.id, pf.nombre, j.id, j.bgg_id, j.nombre, j.imagen_url,
    j.jugadores_min, j.jugadores_max, j.duracion_min, j.complejidad, j.tipos
  from public.amistades a
  join public.perfiles pf
    on pf.id = case
      when a.solicitante_id = (select auth.uid()) then a.destinatario_id
      else a.solicitante_id
    end
  join public.catalogo_usuario c on c.user_id = pf.id
  join public.juegos j on j.id = c.juego_id
  where a.estado = 'aceptada'
    and (select auth.uid()) in (a.solicitante_id, a.destinatario_id)
    and pf.catalogo_visible
    and not (select public.es_anonimo());
$$;

revoke execute on function public.catalogo_de_amigos() from public, anon;
grant execute on function public.catalogo_de_amigos() to authenticated;

-- -----------------------------------------------------------------------------
-- Juegos de la mesa (quienes están en la sala, con cuenta)
--
-- Los ve cualquiera que esté en la sala, también un invitado (sirve para
-- elegir a qué jugar). El catálogo propio entra siempre; el de los demás,
-- si lo muestran.
-- -----------------------------------------------------------------------------

create or replace function public.juegos_de_la_mesa(partida uuid)
returns table (
  dueno_id uuid,
  dueno_nombre text,
  juego_id uuid,
  bgg_id integer,
  nombre text,
  imagen_url text,
  jugadores_min smallint,
  jugadores_max smallint,
  duracion_min smallint,
  complejidad numeric,
  tipos text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pf.id, pf.nombre, j.id, j.bgg_id, j.nombre, j.imagen_url,
    j.jugadores_min, j.jugadores_max, j.duracion_min, j.complejidad, j.tipos
  from public.partida_jugadores pj
  join public.perfiles pf on pf.id = pj.user_id
  join public.catalogo_usuario c on c.user_id = pf.id
  join public.juegos j on j.id = c.juego_id
  where pj.partida_id = juegos_de_la_mesa.partida
    and (pf.catalogo_visible or pf.id = (select auth.uid()))
    and (public.juego_en_partida(juegos_de_la_mesa.partida) or public.es_anfitrion(juegos_de_la_mesa.partida));
$$;

revoke execute on function public.juegos_de_la_mesa(uuid) from public, anon;
grant execute on function public.juegos_de_la_mesa(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Cambiar el juego de una sala en curso
--
-- Solo el anfitrión, y por un juego de la mesa (de su catálogo o del de
-- alguien de la sala que lo muestra). Se copian el nombre y la imagen, como
-- al crearla.
-- -----------------------------------------------------------------------------

create or replace function public.cambiar_juego_de_sala(partida uuid, juego uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_juego public.juegos;
begin
  if not exists (
    select 1 from public.partidas p
    where p.id = partida and p.anfitrion_id = (select auth.uid()) and p.estado = 'en_curso'
  ) then
    raise exception 'Solo el anfitrión cambia el juego de una sala en curso' using errcode = '42501';
  end if;

  select j.* into v_juego
  from public.juegos j
  where j.id = juego
    and exists (select 1 from public.juegos_de_la_mesa(partida) m where m.juego_id = j.id);
  if not found then
    raise exception 'Ese juego no es de nadie de la mesa' using errcode = 'P0002';
  end if;

  update public.partidas
  set juego_id = v_juego.id, juego_nombre = v_juego.nombre, juego_imagen_url = v_juego.imagen_url
  where id = partida;
end;
$$;

revoke execute on function public.cambiar_juego_de_sala(uuid, uuid) from public, anon;
grant execute on function public.cambiar_juego_de_sala(uuid, uuid) to authenticated;
