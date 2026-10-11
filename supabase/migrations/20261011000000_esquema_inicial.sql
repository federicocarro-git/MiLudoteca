-- =============================================================================
-- MiLudoteca — esquema inicial (fase 1)
--
-- Tablas:
--   juegos            datos de cada juego, compartidos entre usuarios
--   catalogo_usuario  qué juegos tiene cada usuario (+ notas y puntuación)
--   resumenes         "cómo se juega" y "hoja de turno" en markdown, por autor
--
-- Storage:
--   imagenes-juegos   bucket público de lectura; cada usuario escribe solo en
--                     la carpeta <su user_id>/
--
-- Reglas de acceso (RLS), en resumen:
--   * juegos de origen 'bgg': visibles para cualquier usuario autenticado;
--     solo los escribe el servidor con la service role (cache de BGG).
--   * juegos de origen 'manual': los ve y modifica solo quien los creó.
--   * catalogo_usuario: cada usuario ve y modifica solo sus filas.
--   * resumenes: cada usuario ve y modifica solo los que escribió.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

-- Mantiene actualizado_en al día en cada UPDATE.
create or replace function public.set_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- juegos
-- -----------------------------------------------------------------------------

create table public.juegos (
  id                  uuid primary key default gen_random_uuid(),

  -- Id del juego en BoardGameGeek. En juegos 'manual' puede estar presente
  -- como referencia (cuando el usuario partió de un resultado de BGG y lo
  -- editó), pero solo es único entre los juegos 'bgg' (ver índice abajo).
  bgg_id              integer check (bgg_id > 0),

  nombre              text not null check (char_length(btrim(nombre)) between 1 and 200),
  imagen_url          text check (imagen_url is null or imagen_url ~ '^https://'),
  jugadores_min       smallint check (jugadores_min between 1 and 100),
  jugadores_max       smallint check (jugadores_max between 1 and 100),
  -- Duración típica de una partida, en minutos.
  duracion_min        smallint check (duracion_min between 1 and 10000),
  -- Escala de BGG ("weight"): 1 = liviano, 5 = muy pesado.
  complejidad         numeric(3, 2) check (complejidad between 1 and 5),
  anio                smallint check (anio between -5000 and 2200),
  descripcion         text check (char_length(descripcion) <= 20000),
  -- Etiquetas para el filtro "tipo" (cooperativo, party, eurogame, ...).
  -- En juegos de BGG se completan a partir de las categorías.
  tipos               text[] not null default '{}',

  origen              text not null check (origen in ('bgg', 'manual')),
  -- Autor de los juegos 'manual'. Null en los de BGG (los escribe el servidor).
  creado_por          uuid default auth.uid() references auth.users (id) on delete cascade,
  -- Última vez que los datos se trajeron de BGG (control de la cache).
  bgg_sincronizado_en timestamptz,

  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint juegos_jugadores_rango
    check (jugadores_min is null or jugadores_max is null or jugadores_min <= jugadores_max),
  constraint juegos_bgg_requiere_bgg_id
    check (origen <> 'bgg' or bgg_id is not null)
);

comment on table public.juegos is
  'Datos de juegos de mesa. Los de origen bgg son una cache compartida de BoardGameGeek; los manual son privados de su creador.';
comment on column public.juegos.duracion_min is 'Duración típica de una partida, en minutos.';
comment on column public.juegos.complejidad is 'Escala 1-5 (weight de BGG).';
comment on column public.juegos.anio is 'Año de publicación.';

-- Un solo registro de cache por juego de BGG.
create unique index juegos_bgg_id_unico on public.juegos (bgg_id) where origen = 'bgg';
create index juegos_bgg_id_idx on public.juegos (bgg_id) where bgg_id is not null;
create index juegos_creado_por_idx on public.juegos (creado_por);
create index juegos_nombre_trgm_idx on public.juegos using gin (nombre extensions.gin_trgm_ops);
create index juegos_tipos_idx on public.juegos using gin (tipos);

create trigger juegos_actualizado_en
  before update on public.juegos
  for each row execute function public.set_actualizado_en();

-- -----------------------------------------------------------------------------
-- catalogo_usuario
-- -----------------------------------------------------------------------------

create table public.catalogo_usuario (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  juego_id       uuid not null references public.juegos (id) on delete cascade,
  notas          text check (char_length(notas) <= 5000),
  -- Puntuación personal de 1 a 10.
  puntuacion     smallint check (puntuacion between 1 and 10),
  agregado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  primary key (user_id, juego_id)
);

comment on table public.catalogo_usuario is 'Colección personal: qué juegos tiene cada usuario.';

create index catalogo_usuario_juego_idx on public.catalogo_usuario (juego_id);

create trigger catalogo_usuario_actualizado_en
  before update on public.catalogo_usuario
  for each row execute function public.set_actualizado_en();

-- -----------------------------------------------------------------------------
-- resumenes
-- -----------------------------------------------------------------------------

create table public.resumenes (
  id             uuid primary key default gen_random_uuid(),
  juego_id       uuid not null references public.juegos (id) on delete cascade,
  autor_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  como_se_juega  text not null default '' check (char_length(como_se_juega) <= 100000),
  hoja_de_turno  text not null default '' check (char_length(hoja_de_turno) <= 50000),
  -- Preparado para la fase 2: 'ia' = generado con Claude a partir del PDF del
  -- reglamento (y luego, posiblemente, editado a mano).
  origen         text not null default 'manual' check (origen in ('manual', 'ia')),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  -- Un resumen por juego y autor (se edita, no se duplica).
  unique (juego_id, autor_id)
);

comment on table public.resumenes is 'Resúmenes en markdown de cada juego, uno por autor.';

create index resumenes_autor_idx on public.resumenes (autor_id);

create trigger resumenes_actualizado_en
  before update on public.resumenes
  for each row execute function public.set_actualizado_en();

-- -----------------------------------------------------------------------------
-- Vista del catálogo personal (juego + datos del usuario)
--
-- security_invoker = true: la vista se evalúa con los permisos y las políticas
-- RLS de quien consulta, así que nunca muestra filas ajenas.
-- -----------------------------------------------------------------------------

create view public.mi_catalogo
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
  c.agregado_en
from public.catalogo_usuario c
join public.juegos j on j.id = c.juego_id
where c.user_id = auth.uid();

comment on view public.mi_catalogo is 'Catálogo del usuario autenticado, listo para filtrar.';

-- -----------------------------------------------------------------------------
-- Permisos
--
-- Nada para anon: toda la app requiere sesión. La service role (solo servidor)
-- saltea RLS y es la única que escribe juegos de origen 'bgg'.
-- -----------------------------------------------------------------------------

revoke all on public.juegos, public.catalogo_usuario, public.resumenes, public.mi_catalogo from anon;

grant select, insert, update, delete on public.juegos           to authenticated;
grant select, insert, update, delete on public.catalogo_usuario to authenticated;
grant select, insert, update, delete on public.resumenes        to authenticated;
grant select                         on public.mi_catalogo      to authenticated;

alter table public.juegos           enable row level security;
alter table public.catalogo_usuario enable row level security;
alter table public.resumenes        enable row level security;

-- juegos ----------------------------------------------------------------------

create policy "juegos: leer los de BGG y los manuales propios"
  on public.juegos for select
  to authenticated
  using (origen = 'bgg' or creado_por = (select auth.uid()));

create policy "juegos: crear solo manuales propios"
  on public.juegos for insert
  to authenticated
  with check (origen = 'manual' and creado_por = (select auth.uid()) and bgg_sincronizado_en is null);

create policy "juegos: editar solo manuales propios"
  on public.juegos for update
  to authenticated
  using (origen = 'manual' and creado_por = (select auth.uid()))
  with check (origen = 'manual' and creado_por = (select auth.uid()) and bgg_sincronizado_en is null);

create policy "juegos: borrar solo manuales propios"
  on public.juegos for delete
  to authenticated
  using (origen = 'manual' and creado_por = (select auth.uid()));

-- catalogo_usuario ------------------------------------------------------------
-- La subconsulta sobre juegos corre con las políticas de juegos de quien
-- consulta: no se puede agregar al catálogo un juego manual ajeno.

create policy "catalogo: leer el propio"
  on public.catalogo_usuario for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "catalogo: agregar al propio juegos visibles"
  on public.catalogo_usuario for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.juegos j where j.id = juego_id)
  );

create policy "catalogo: editar el propio"
  on public.catalogo_usuario for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.juegos j where j.id = juego_id)
  );

create policy "catalogo: quitar del propio"
  on public.catalogo_usuario for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- resumenes -------------------------------------------------------------------

create policy "resumenes: leer los propios"
  on public.resumenes for select
  to authenticated
  using (autor_id = (select auth.uid()));

create policy "resumenes: crear propios sobre juegos visibles"
  on public.resumenes for insert
  to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (select 1 from public.juegos j where j.id = juego_id)
  );

create policy "resumenes: editar los propios"
  on public.resumenes for update
  to authenticated
  using (autor_id = (select auth.uid()))
  with check (
    autor_id = (select auth.uid())
    and exists (select 1 from public.juegos j where j.id = juego_id)
  );

create policy "resumenes: borrar los propios"
  on public.resumenes for delete
  to authenticated
  using (autor_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Storage: imágenes de juegos
--
-- Bucket público (las imágenes se muestran por URL pública, sin firmar).
-- Ruta de cada archivo: <user_id>/<uuid>.<ext>
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imagenes-juegos',
  'imagenes-juegos',
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

create policy "imagenes-juegos: subir a la carpeta propia"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'imagenes-juegos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "imagenes-juegos: reemplazar en la carpeta propia"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'imagenes-juegos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'imagenes-juegos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "imagenes-juegos: borrar de la carpeta propia"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'imagenes-juegos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Listar/leer vía API (el upsert del cliente lo necesita); la lectura pública
-- por URL no pasa por RLS porque el bucket es público.
create policy "imagenes-juegos: leer la carpeta propia"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'imagenes-juegos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
