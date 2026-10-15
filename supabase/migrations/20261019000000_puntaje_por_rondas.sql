-- =============================================================================
-- Fase 2, hito 14: puntuación por rondas y hojas de puntuación
--
-- Cada sala anota de una de tres formas (partidas.tipo_puntaje):
--   'total'       un número por jugador (como hasta ahora)
--   'rondas'      una columna por ronda; se agregan rondas a medida que se juega
--   'categorias'  una hoja con categorías fijas (por ejemplo, las de 7 Wonders)
-- En rondas y categorías, cada casillero es una fila de partida_anotaciones y
-- partida_jugadores.puntos pasa a ser la suma (la mantiene anotar_puntos()).
-- Así el cierre, el historial y el ranking siguen usando puntos sin cambios.
--
-- hojas_de_puntuacion: las categorías que cada uno guarda para un juego, para
-- no escribirlas cada vez. Son privadas de su autor; la sala copia las
-- categorías, así las ven todos.
-- =============================================================================

alter table public.partidas
  add column tipo_puntaje text not null default 'total'
    check (tipo_puntaje in ('total', 'rondas', 'categorias')),
  add column rondas smallint not null default 1 check (rondas between 1 and 50),
  add column categorias text[] not null default '{}' check (cardinality(categorias) <= 20);

comment on column public.partidas.tipo_puntaje is 'Cómo se anota: total, por rondas o con una hoja de categorías.';

-- -----------------------------------------------------------------------------
-- Casilleros de la hoja
-- -----------------------------------------------------------------------------

create table public.partida_anotaciones (
  jugador_id uuid not null references public.partida_jugadores (id) on delete cascade,
  partida_id uuid not null references public.partidas (id) on delete cascade,
  -- Índice de la ronda o de la categoría (desde 0).
  columna    smallint not null check (columna between 0 and 49),
  puntos     integer not null check (puntos between -1000000 and 1000000),
  primary key (jugador_id, columna)
);

comment on table public.partida_anotaciones is
  'Puntos por ronda o por categoría. Se escriben solo con anotar_puntos().';

create index partida_anotaciones_partida_idx on public.partida_anotaciones (partida_id);

-- ¿Cómo se anota en esta partida? (para la política de puntos)
create or replace function public.tipo_puntaje(partida uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.tipo_puntaje from public.partidas p where p.id = partida;
$$;

revoke execute on function public.tipo_puntaje(uuid) from public, anon;
grant execute on function public.tipo_puntaje(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Anotar un casillero
--
-- Cada uno anota los suyos; el anfitrión, los de todos (también los de quien
-- juega sin celular). puntos null borra el casillero. Recalcula el total.
-- -----------------------------------------------------------------------------

create or replace function public.anotar_puntos(jugador uuid, columna integer, puntos integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jugador public.partida_jugadores;
  v_partida public.partidas;
  v_columnas integer;
begin
  select * into v_jugador from public.partida_jugadores j where j.id = jugador;
  if not found then
    raise exception 'Ese jugador no existe' using errcode = 'P0002';
  end if;
  select * into v_partida from public.partidas p where p.id = v_jugador.partida_id;

  if v_partida.estado <> 'en_curso'
     or not (v_jugador.user_id = (select auth.uid()) or v_partida.anfitrion_id = (select auth.uid())) then
    raise exception 'No podés anotar en ese casillero' using errcode = '42501';
  end if;
  if v_partida.tipo_puntaje = 'total' then
    raise exception 'Esta sala anota solo el total' using errcode = '22023';
  end if;
  v_columnas := case v_partida.tipo_puntaje
    when 'rondas' then v_partida.rondas
    else cardinality(v_partida.categorias)
  end;
  if columna < 0 or columna >= v_columnas then
    raise exception 'No existe esa columna' using errcode = '22023';
  end if;
  if puntos is not null and puntos not between -1000000 and 1000000 then
    raise exception 'Puntos fuera de rango' using errcode = '22023';
  end if;

  if puntos is null then
    delete from public.partida_anotaciones a
    where a.jugador_id = jugador and a.columna = anotar_puntos.columna;
  else
    insert into public.partida_anotaciones (jugador_id, partida_id, columna, puntos)
    values (jugador, v_jugador.partida_id, anotar_puntos.columna, anotar_puntos.puntos)
    on conflict on constraint partida_anotaciones_pkey do update set puntos = excluded.puntos;
  end if;

  -- El total es la suma (dispara el aviso de Realtime de la sala).
  update public.partida_jugadores j
  set puntos = coalesce(
    (select sum(a.puntos) from public.partida_anotaciones a where a.jugador_id = jugador), 0
  )
  where j.id = jugador;
end;
$$;

revoke execute on function public.anotar_puntos(uuid, integer, integer) from public, anon;
grant execute on function public.anotar_puntos(uuid, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Elegir cómo se anota (solo el anfitrión, antes de que haya puntos)
-- -----------------------------------------------------------------------------

create or replace function public.configurar_puntaje(
  partida uuid,
  tipo text,
  categorias text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_categorias text[];
begin
  if not exists (
    select 1 from public.partidas p
    where p.id = partida and p.anfitrion_id = (select auth.uid()) and p.estado = 'en_curso'
  ) then
    raise exception 'Solo el anfitrión elige cómo se anota' using errcode = '42501';
  end if;
  if tipo not in ('total', 'rondas', 'categorias') then
    raise exception 'Tipo de puntaje inválido' using errcode = '22023';
  end if;
  if exists (select 1 from public.partida_jugadores j where j.partida_id = partida and j.puntos <> 0)
     or exists (select 1 from public.partida_anotaciones a where a.partida_id = partida) then
    raise exception 'Ya hay puntos cargados' using errcode = 'P0001', hint = 'ya_hay_puntos';
  end if;

  if tipo = 'categorias' then
    select coalesce(array_agg(btrim(c) order by o), '{}') into v_categorias
    from unnest(categorias) with ordinality as t(c, o)
    where btrim(c) <> '';
    if cardinality(v_categorias) not between 1 and 20
       or exists (select 1 from unnest(v_categorias) c where char_length(c) > 30) then
      raise exception 'Entre 1 y 20 categorías, de hasta 30 caracteres' using errcode = '22023';
    end if;
  end if;

  update public.partidas p
  set tipo_puntaje = tipo, rondas = 1, categorias = coalesce(v_categorias, '{}')
  where p.id = partida;
end;
$$;

revoke execute on function public.configurar_puntaje(uuid, text, text[]) from public, anon;
grant execute on function public.configurar_puntaje(uuid, text, text[]) to authenticated;

-- Otra ronda (cualquiera de la sala), hasta 50.
create or replace function public.agregar_ronda(partida uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.juego_en_partida(partida) or public.es_anfitrion(partida)) then
    raise exception 'No estás en esa sala' using errcode = '42501';
  end if;
  update public.partidas p
  set rondas = p.rondas + 1
  where p.id = partida and p.estado = 'en_curso' and p.tipo_puntaje = 'rondas' and p.rondas < 50;
  if not found then
    raise exception 'No se pueden agregar más rondas' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.agregar_ronda(uuid) from public, anon;
grant execute on function public.agregar_ronda(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- El total se escribe a mano solo en las salas de tipo 'total'
-- -----------------------------------------------------------------------------

drop policy "jugadores: cada uno sus puntos, el anfitrión los de todos" on public.partida_jugadores;

create policy "jugadores: cada uno sus puntos, el anfitrión los de todos"
  on public.partida_jugadores for update
  to authenticated
  using (
    (select public.partida_en_curso(partida_id))
    and (select public.tipo_puntaje(partida_id)) = 'total'
    and (user_id = (select auth.uid()) or (select public.es_anfitrion(partida_id)))
  )
  with check (
    (select public.partida_en_curso(partida_id))
    and (select public.tipo_puntaje(partida_id)) = 'total'
    and (user_id = (select auth.uid()) or (select public.es_anfitrion(partida_id)))
  );

-- -----------------------------------------------------------------------------
-- Hojas de puntuación guardadas (privadas de su autor)
-- -----------------------------------------------------------------------------

create table public.hojas_de_puntuacion (
  juego_id       uuid not null references public.juegos (id) on delete cascade,
  autor_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  categorias     text[] not null check (cardinality(categorias) between 1 and 20),
  actualizado_en timestamptz not null default now(),
  primary key (juego_id, autor_id)
);

comment on table public.hojas_de_puntuacion is 'Categorías de puntuación que cada usuario guarda para un juego.';

create trigger hojas_de_puntuacion_actualizado_en
  before update on public.hojas_de_puntuacion
  for each row execute function public.set_actualizado_en();

-- -----------------------------------------------------------------------------
-- Permisos y RLS
-- -----------------------------------------------------------------------------

revoke all on public.partida_anotaciones, public.hojas_de_puntuacion from anon, authenticated;

-- Los casilleros se leen con RLS y se escriben solo con anotar_puntos().
grant select on public.partida_anotaciones to authenticated;
grant select, insert, update, delete on public.hojas_de_puntuacion to authenticated;

alter table public.partida_anotaciones enable row level security;
alter table public.hojas_de_puntuacion enable row level security;

create policy "anotaciones: leer las de mis partidas"
  on public.partida_anotaciones for select
  to authenticated
  using ((select public.juego_en_partida(partida_id)) or (select public.es_anfitrion(partida_id)));

create policy "hojas: leer las propias"
  on public.hojas_de_puntuacion for select
  to authenticated
  using (autor_id = (select auth.uid()));

create policy "hojas: crear propias sobre juegos visibles"
  on public.hojas_de_puntuacion for insert
  to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (select 1 from public.juegos j where j.id = juego_id)
  );

create policy "hojas: editar las propias"
  on public.hojas_de_puntuacion for update
  to authenticated
  using (autor_id = (select auth.uid()))
  with check (
    autor_id = (select auth.uid())
    and exists (select 1 from public.juegos j where j.id = juego_id)
  );

create policy "hojas: borrar las propias"
  on public.hojas_de_puntuacion for delete
  to authenticated
  using (autor_id = (select auth.uid()));

create policy "hojas: no para invitados anónimos"
  on public.hojas_de_puntuacion as restrictive for all
  to authenticated
  using (not (select public.es_anonimo()))
  with check (not (select public.es_anonimo()));
