-- =============================================================================
-- Más datos de BGG: cantidad ideal de jugadores, nombres en español y
-- partidas registradas en BGG
--
-- * juegos.jugadores_mejor / jugadores_recomendados: la encuesta de BGG
--   ("suggested_numplayers"). Null = todavía no se trajo (la cache de BGG
--   vuelve a pedir esas filas); '{}' = BGG no tiene votos.
-- * juegos.nombres_alternativos: los otros nombres del juego en BGG.
--   juegos.nombre_es: el nombre en español, elegido entre esos por alguien que
--   lo tiene en su estante (elegir_nombre_es). juegos.imagen_es: la caja de
--   una edición en español (de las "versions" de BGG). Donde se muestra el
--   juego se usa coalesce(nombre_es, nombre) y coalesce(imagen_es, imagen_url).
-- * partidas.bgg_play_id: partidas importadas de los "plays" de BGG con
--   importar_partidas_bgg(); una sola vez por anfitrión.
-- =============================================================================

alter table public.juegos
  add column jugadores_mejor smallint[] check (cardinality(jugadores_mejor) <= 100),
  add column jugadores_recomendados smallint[] check (cardinality(jugadores_recomendados) <= 100),
  add column nombres_alternativos text[] not null default '{}'
    check (cardinality(nombres_alternativos) <= 100),
  add column nombre_es text check (char_length(btrim(nombre_es)) between 1 and 200),
  add column imagen_es text check (imagen_es is null or imagen_es ~ '^https://');

comment on column public.juegos.jugadores_recomendados is
  'Cantidades de jugadores recomendadas por la comunidad de BGG (null: sin traer todavía).';
comment on column public.juegos.nombre_es is 'Nombre en español (uno de nombres_alternativos).';

alter table public.partidas
  add column bgg_play_id bigint check (bgg_play_id > 0);

create unique index partidas_bgg_play_unica
  on public.partidas (anfitrion_id, bgg_play_id) where bgg_play_id is not null;

-- -----------------------------------------------------------------------------
-- mi_catalogo: nombre e imagen en español si los hay, y los datos nuevos
-- (create or replace permite cambiar la expresión de una columna y sumar al final)
-- -----------------------------------------------------------------------------

create or replace view public.mi_catalogo
with (security_invoker = true)
as
select
  j.id,
  j.bgg_id,
  coalesce(j.nombre_es, j.nombre) as nombre,
  coalesce(j.imagen_es, j.imagen_url) as imagen_url,
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
  j.expande,
  j.nombre as nombre_original,
  j.jugadores_mejor,
  j.jugadores_recomendados
from public.catalogo_usuario c
join public.juegos j on j.id = c.juego_id
where c.user_id = auth.uid();

-- -----------------------------------------------------------------------------
-- Elegir el nombre en español (lo ve todo el que tiene el juego)
-- -----------------------------------------------------------------------------

create or replace function public.elegir_nombre_es(juego uuid, nombre text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  v_juego public.juegos;
  v_nombre text := btrim(coalesce(nombre, ''));
begin
  if yo is null or not exists (select 1 from public.perfiles p where p.id = yo) then
    raise exception 'Hace falta una cuenta' using errcode = '42501';
  end if;
  select * into v_juego from public.juegos j where j.id = juego and j.origen = 'bgg';
  if not found then
    raise exception 'Ese juego no es de BGG' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.catalogo_usuario c where c.user_id = yo and c.juego_id = juego
  ) then
    raise exception 'Solo quien tiene el juego en su estante elige el nombre' using errcode = '42501';
  end if;

  if v_nombre = '' or v_nombre = v_juego.nombre then
    update public.juegos j set nombre_es = null where j.id = juego;
  elsif v_nombre = any (v_juego.nombres_alternativos) then
    update public.juegos j set nombre_es = v_nombre where j.id = juego;
  else
    raise exception 'Ese nombre no es uno de los de BGG' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.elegir_nombre_es(uuid, text) from public, anon;
grant execute on function public.elegir_nombre_es(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Las salas copian el nombre y la caja en español
-- -----------------------------------------------------------------------------

create or replace function public.crear_partida(juego uuid)
returns table (id uuid, codigo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  v_juego public.juegos;
  v_partida public.partidas;
begin
  if yo is null or not exists (select 1 from public.perfiles p where p.id = yo) then
    raise exception 'Hace falta una cuenta para crear una sala' using errcode = '42501';
  end if;

  select * into v_juego
  from public.juegos j
  where j.id = juego and (j.origen = 'bgg' or j.creado_por = yo);
  if not found then
    raise exception 'Ese juego no existe' using errcode = 'P0002';
  end if;

  loop
    begin
      insert into public.partidas (codigo, juego_id, juego_nombre, juego_imagen_url, anfitrion_id)
      values (
        public.generar_codigo(6), v_juego.id, coalesce(v_juego.nombre_es, v_juego.nombre),
        coalesce(v_juego.imagen_es, v_juego.imagen_url), yo
      )
      returning * into v_partida;
      exit;
    exception when unique_violation then
      -- Código en uso por otra partida en curso: probar con otro.
    end;
  end loop;

  insert into public.partida_jugadores (partida_id, user_id, nombre)
  values (v_partida.id, yo, 'anfitrión');

  return query select v_partida.id, v_partida.codigo;
end;
$$;

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
  set juego_id = v_juego.id,
      juego_nombre = coalesce(v_juego.nombre_es, v_juego.nombre),
      juego_imagen_url = coalesce(v_juego.imagen_es, v_juego.imagen_url)
  where id = partida;
end;
$$;

-- -----------------------------------------------------------------------------
-- Juegos de amigos y de la mesa: nombre en español y jugadores recomendados
-- (cambia lo que devuelven: hay que borrarlas y volver a crearlas)
-- -----------------------------------------------------------------------------

drop function public.catalogo_de_amigos();

create function public.catalogo_de_amigos()
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
  tipos text[],
  jugadores_recomendados smallint[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pf.id, pf.nombre, j.id, j.bgg_id, coalesce(j.nombre_es, j.nombre),
    coalesce(j.imagen_es, j.imagen_url), j.jugadores_min, j.jugadores_max, j.duracion_min,
    j.complejidad, j.tipos, j.jugadores_recomendados
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

-- cambiar_juego_de_sala la usa: se recrea en la misma transacción.
drop function public.juegos_de_la_mesa(uuid);

create function public.juegos_de_la_mesa(partida uuid)
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
  tipos text[],
  jugadores_recomendados smallint[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pf.id, pf.nombre, j.id, j.bgg_id, coalesce(j.nombre_es, j.nombre),
    coalesce(j.imagen_es, j.imagen_url), j.jugadores_min, j.jugadores_max, j.duracion_min,
    j.complejidad, j.tipos, j.jugadores_recomendados
  from public.partida_jugadores pj
  join public.perfiles pf on pf.id = pj.user_id
  join public.catalogo_usuario c on c.user_id = pf.id
  join public.juegos j on j.id = c.juego_id
  where pj.partida_id = juegos_de_la_mesa.partida
    and not j.es_expansion
    and (pf.catalogo_visible or pf.id = (select auth.uid()))
    and (public.juego_en_partida(juegos_de_la_mesa.partida) or public.es_anfitrion(juegos_de_la_mesa.partida));
$$;

revoke execute on function public.juegos_de_la_mesa(uuid) from public, anon;
grant execute on function public.juegos_de_la_mesa(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Importar partidas registradas en BGG
--
-- Recibe hasta 100 partidas (una página de "plays") ya armadas por el
-- servidor: [{ bgg_play_id, juego_id?, juego_nombre, jugado_en, minutos?,
-- jugadores: [{ user_id?, nombre, puntos?, gano }] }]. Quedan terminadas, con
-- quien importa como anfitrión, ganadores como dice BGG (modo 'manual') y
-- posiciones por puntos si los hay. Un user_id solo se acepta si es quien
-- importa o un amigo; si no, ese jugador entra sin cuenta (con su nombre).
-- Las que ya estaban (mismo bgg_play_id) no se repiten.
-- -----------------------------------------------------------------------------

create or replace function public.importar_partidas_bgg(partidas jsonb)
returns table (nuevas integer, repetidas integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  p jsonb;
  v_play bigint;
  v_partida uuid;
  v_juego_id uuid;
  v_nombre text;
  v_imagen text;
  v_terminada timestamptz;
  v_minutos integer;
  n_nuevas integer := 0;
  n_repetidas integer := 0;
begin
  if yo is null or not exists (select 1 from public.perfiles pf where pf.id = yo) then
    raise exception 'Hace falta una cuenta' using errcode = '42501';
  end if;
  if jsonb_typeof(partidas) is distinct from 'array' or jsonb_array_length(partidas) > 100 then
    raise exception 'Hasta 100 partidas por vez' using errcode = '22023';
  end if;

  for p in select value from jsonb_array_elements(partidas) loop
    v_play := (p ->> 'bgg_play_id')::bigint;
    if exists (
      select 1 from public.partidas x where x.anfitrion_id = yo and x.bgg_play_id = v_play
    ) then
      n_repetidas := n_repetidas + 1;
      continue;
    end if;

    -- El juego, si es uno que puedo ver (de BGG o manual propio).
    v_juego_id := null;
    v_nombre := left(btrim(coalesce(p ->> 'juego_nombre', '')), 200);
    v_imagen := null;
    if p ->> 'juego_id' is not null then
      select j.id, coalesce(j.nombre_es, j.nombre), coalesce(j.imagen_es, j.imagen_url)
      into v_juego_id, v_nombre, v_imagen
      from public.juegos j
      where j.id = (p ->> 'juego_id')::uuid and (j.origen = 'bgg' or j.creado_por = yo);
      if v_juego_id is null then
        v_nombre := left(btrim(coalesce(p ->> 'juego_nombre', '')), 200);
      end if;
    end if;
    if v_nombre = '' then
      raise exception 'Falta el juego de una partida' using errcode = '22023';
    end if;

    -- BGG guarda solo el día: a la noche, hora de Argentina.
    v_terminada := ((p ->> 'jugado_en')::date + time '21:00')
      at time zone 'America/Argentina/Buenos_Aires';
    v_minutos := least(greatest(coalesce((p ->> 'minutos')::integer, 0), 0), 10000);

    insert into public.partidas (
      codigo, juego_id, juego_nombre, juego_imagen_url, anfitrion_id, estado,
      creada_en, terminada_en, modo_resultado, bgg_play_id
    )
    values (
      public.generar_codigo(6), v_juego_id, v_nombre, v_imagen, yo, 'terminada',
      v_terminada - make_interval(mins => v_minutos), v_terminada, 'manual', v_play
    )
    returning id into v_partida;

    with filas as (
      select
        x,
        o,
        case
          when x ->> 'user_id' is not null
            and ((x ->> 'user_id')::uuid = yo or public.es_amigo((x ->> 'user_id')::uuid))
          then (x ->> 'user_id')::uuid
        end as uid
      from jsonb_array_elements(coalesce(p -> 'jugadores', '[]'::jsonb)) with ordinality as t(x, o)
      order by o
      limit 20
    ),
    unicas as (
      select *, row_number() over (partition by uid order by o) as rn from filas
    )
    insert into public.partida_jugadores (partida_id, user_id, nombre, puntos, gano, unido_en)
    select
      v_partida,
      case when uid is not null and rn = 1 then uid end,
      coalesce(nullif(left(btrim(coalesce(x ->> 'nombre', '')), 40), ''), 'Jugador'),
      least(greatest(coalesce((x ->> 'puntos')::integer, 0), -1000000), 1000000),
      coalesce((x ->> 'gano')::boolean, false),
      v_terminada - make_interval(mins => v_minutos) + o * interval '1 millisecond'
    from unicas;

    -- Posiciones solo si BGG traía puntos.
    if exists (
      select 1 from jsonb_array_elements(coalesce(p -> 'jugadores', '[]'::jsonb)) x
      where x ->> 'puntos' is not null
    ) then
      with orden as (
        select j.id, dense_rank() over (order by j.puntos desc) as pos
        from public.partida_jugadores j where j.partida_id = v_partida
      )
      update public.partida_jugadores j set posicion = orden.pos
      from orden where j.id = orden.id;
    end if;

    n_nuevas := n_nuevas + 1;
  end loop;

  return query select n_nuevas, n_repetidas;
end;
$$;

revoke execute on function public.importar_partidas_bgg(jsonb) from public, anon;
grant execute on function public.importar_partidas_bgg(jsonb) to authenticated;
