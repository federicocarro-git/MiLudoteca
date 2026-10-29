-- =============================================================================
-- Vincular la cuenta con BoardGameGeek e importar la colección
--
-- * perfiles.bgg_usuario: el nombre de usuario de BGG (no hay login con BGG:
--   solo se lee la colección pública de ese usuario). bgg_importado_en: la
--   última vez que se importó.
-- * juegos.es_expansion y juegos.expande: las expansiones quedan vinculadas a
--   sus juegos base por bgg_id (una expansión puede servir para varios). Las
--   completa el parser de BGG en las filas de la cache.
-- * mi_catalogo suma las dos columnas, para mostrar las expansiones adentro
--   de su juego base.
-- * juegos_de_la_mesa deja afuera las expansiones: no se juegan solas.
-- =============================================================================

alter table public.perfiles
  add column bgg_usuario text
    check (bgg_usuario is null or bgg_usuario ~ '^[A-Za-z0-9_][A-Za-z0-9_ .-]{0,49}$'),
  add column bgg_importado_en timestamptz;

comment on column public.perfiles.bgg_usuario is 'Usuario de BoardGameGeek vinculado (para importar la colección).';

grant update (bgg_usuario, bgg_importado_en) on public.perfiles to authenticated;

alter table public.juegos
  add column es_expansion boolean not null default false,
  add column expande integer[] not null default '{}'
    check (cardinality(expande) <= 50);

comment on column public.juegos.expande is 'bgg_id de los juegos base, si es una expansión.';

create index juegos_expande_idx on public.juegos using gin (expande);

-- La vista solo suma columnas al final (create or replace lo permite).
create or replace view public.mi_catalogo
with (security_invoker = true)
as
select
  j.id,
  j.bgg_id,
  j.nombre,
  j.imagen_url,
  j.jugadores_min,
  j.jugadores_max,
  j.duracion_min,
  j.complejidad,
  j.anio,
  j.tipos,
  j.origen,
  c.notas,
  c.puntuacion,
  c.agregado_en,
  j.es_expansion,
  j.expande
from public.catalogo_usuario c
join public.juegos j on j.id = c.juego_id
where c.user_id = auth.uid();

-- -----------------------------------------------------------------------------
-- La mesa elige entre juegos que se juegan solos (sin expansiones)
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
    and not j.es_expansion
    and (pf.catalogo_visible or pf.id = (select auth.uid()))
    and (public.juego_en_partida(juegos_de_la_mesa.partida) or public.es_anfitrion(juegos_de_la_mesa.partida));
$$;
