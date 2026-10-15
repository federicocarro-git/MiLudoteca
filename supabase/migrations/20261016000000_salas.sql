-- =============================================================================
-- Fase 2, hito 10: salas en vivo
--
-- Tablas:
--   partidas           una sala por partida: juego, código para unirse y
--                      anfitrión (quien la creó)
--   partida_jugadores  quiénes juegan y sus puntos (total)
--
-- Invitados sin cuenta: entran como usuarios anónimos de Supabase Auth
-- (signInAnonymously). Tienen auth.uid() como cualquiera, así que RLS y
-- Realtime funcionan igual, pero no tienen perfil y una política restrictiva
-- les cierra todo lo que no es una sala (catálogo, juegos, resúmenes, fotos,
-- amigos).
--
-- Reglas de acceso (RLS), en resumen:
--   * partidas: las ven el anfitrión y los jugadores. Se crean con
--     crear_partida() y el anfitrión las puede cancelar (borrar) mientras
--     están en curso.
--   * partida_jugadores: los ven los de la misma partida. Cada uno cambia
--     sus puntos; el anfitrión, los de todos. Se entra con el código
--     (unirse_a_partida) o porque el anfitrión agrega a un amigo o a alguien
--     sin celular. Cada uno puede irse; el anfitrión puede sacar a otros.
--   * Los cambios se avisan por Realtime Broadcast (ver al final).
--   * El juego queda copiado en la partida (nombre e imagen): los demás
--     jugadores no necesitan poder ver la fila de juegos (un juego manual es
--     privado) y la partida sobrevive si el juego se borra.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Invitados anónimos: fuera de todo lo que no es una sala
-- -----------------------------------------------------------------------------

create or replace function public.es_anonimo()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
$$;

-- Las políticas restrictivas se suman (AND) a las permisivas que ya existen.
create policy "juegos: no para invitados anónimos"
  on public.juegos as restrictive for all
  to authenticated
  using (not (select public.es_anonimo()))
  with check (not (select public.es_anonimo()));

create policy "catalogo: no para invitados anónimos"
  on public.catalogo_usuario as restrictive for all
  to authenticated
  using (not (select public.es_anonimo()))
  with check (not (select public.es_anonimo()));

create policy "resumenes: no para invitados anónimos"
  on public.resumenes as restrictive for all
  to authenticated
  using (not (select public.es_anonimo()))
  with check (not (select public.es_anonimo()));

create policy "perfiles: no para invitados anónimos"
  on public.perfiles as restrictive for all
  to authenticated
  using (not (select public.es_anonimo()))
  with check (not (select public.es_anonimo()));

create policy "amistades: no para invitados anónimos"
  on public.amistades as restrictive for all
  to authenticated
  using (not (select public.es_anonimo()))
  with check (not (select public.es_anonimo()));

create policy "imagenes-juegos: no para invitados anónimos"
  on storage.objects as restrictive for all
  to authenticated
  using (bucket_id <> 'imagenes-juegos' or not (select public.es_anonimo()))
  with check (bucket_id <> 'imagenes-juegos' or not (select public.es_anonimo()));

-- -----------------------------------------------------------------------------
-- partidas
-- -----------------------------------------------------------------------------

create table public.partidas (
  id               uuid primary key default gen_random_uuid(),
  -- Código para unirse; único solo entre las partidas en curso.
  codigo           text not null check (codigo ~ '^[A-HJ-NP-Z2-9]{6}$'),
  juego_id         uuid references public.juegos (id) on delete set null,
  juego_nombre     text not null check (char_length(btrim(juego_nombre)) between 1 and 200),
  juego_imagen_url text,
  anfitrion_id     uuid references public.perfiles (id) on delete set null,
  estado           text not null default 'en_curso' check (estado in ('en_curso', 'terminada')),
  creada_en        timestamptz not null default now(),
  terminada_en     timestamptz
);

comment on table public.partidas is
  'Salas de juego. El juego se copia (nombre e imagen) para que lo vean todos y sobreviva si se borra.';

create unique index partidas_codigo_en_curso on public.partidas (codigo) where estado = 'en_curso';
create index partidas_anfitrion_idx on public.partidas (anfitrion_id);
create index partidas_juego_idx on public.partidas (juego_id);

-- -----------------------------------------------------------------------------
-- partida_jugadores
-- -----------------------------------------------------------------------------

create table public.partida_jugadores (
  id             uuid primary key default gen_random_uuid(),
  partida_id     uuid not null references public.partidas (id) on delete cascade,
  -- Null para quien juega sin celular (lo carga el anfitrión) y cuando se
  -- borra la cuenta (el nombre queda en la partida).
  user_id        uuid references auth.users (id) on delete set null,
  nombre         text not null check (char_length(btrim(nombre)) between 1 and 40),
  -- Sin cuenta: invitado anónimo o jugador sin celular. No suma al ranking.
  invitado       boolean not null default false,
  puntos         integer not null default 0 check (puntos between -1000000 and 1000000),
  unido_en       timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  unique (partida_id, user_id)
);

comment on table public.partida_jugadores is 'Jugadores de cada partida y su puntaje total.';

create index partida_jugadores_user_idx on public.partida_jugadores (user_id);

create trigger partida_jugadores_actualizado_en
  before update on public.partida_jugadores
  for each row execute function public.set_actualizado_en();

-- Hasta 20 jugadores por partida. Con cuenta, el nombre sale del perfil (no se
-- puede inventar el de otro) y no es invitado.
create or replace function public.preparar_jugador_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
begin
  if (select count(*) from public.partida_jugadores where partida_id = new.partida_id) >= 20 then
    raise exception 'La sala ya tiene 20 jugadores' using errcode = 'P0001', hint = 'sala_llena';
  end if;
  if new.user_id is not null then
    select nombre into v_nombre from public.perfiles where id = new.user_id;
    if v_nombre is not null then
      new.nombre := v_nombre;
      new.invitado := false;
    else
      new.invitado := true;
    end if;
  else
    new.invitado := true;
  end if;
  return new;
end;
$$;

revoke execute on function public.preparar_jugador_nuevo() from public, anon, authenticated;

create trigger partida_jugadores_preparar
  before insert on public.partida_jugadores
  for each row execute function public.preparar_jugador_nuevo();

-- -----------------------------------------------------------------------------
-- Funciones para las políticas (security definer: consultan las tablas sin
-- pasar por sus propias políticas, así no hay recursión)
-- -----------------------------------------------------------------------------

create or replace function public.juego_en_partida(partida uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partida_jugadores j
    where j.partida_id = partida and j.user_id = (select auth.uid())
  );
$$;

create or replace function public.es_anfitrion(partida uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partidas p
    where p.id = partida and p.anfitrion_id = (select auth.uid())
  );
$$;

create or replace function public.partida_en_curso(partida uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.partidas p where p.id = partida and p.estado = 'en_curso');
$$;

revoke execute on function public.juego_en_partida(uuid) from public, anon;
revoke execute on function public.es_anfitrion(uuid) from public, anon;
revoke execute on function public.partida_en_curso(uuid) from public, anon;
grant execute on function public.juego_en_partida(uuid) to authenticated;
grant execute on function public.es_anfitrion(uuid) to authenticated;
grant execute on function public.partida_en_curso(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Crear una partida
--
-- Solo con cuenta (perfil) y con un juego que se pueda ver (de BGG o manual
-- propio). Copia el nombre y la imagen, genera el código y suma al anfitrión
-- como primer jugador.
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
      values (public.generar_codigo(6), v_juego.id, v_juego.nombre, v_juego.imagen_url, yo)
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

revoke execute on function public.crear_partida(uuid) from public, anon;
grant execute on function public.crear_partida(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Ver una sala por código antes de entrar (también sin sesión: es lo que
-- muestra el QR). Solo datos para decidir si unirse: juego, anfitrión y
-- cantidad de jugadores.
-- -----------------------------------------------------------------------------

create or replace function public.ver_sala(codigo text)
returns table (
  partida_id uuid,
  juego_nombre text,
  juego_imagen_url text,
  anfitrion text,
  jugadores integer,
  ya_estoy boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.juego_nombre,
    p.juego_imagen_url,
    coalesce(pf.nombre, 'Alguien'),
    (select count(*)::integer from public.partida_jugadores j where j.partida_id = p.id),
    exists (
      select 1 from public.partida_jugadores j
      where j.partida_id = p.id and j.user_id = (select auth.uid())
    )
  from public.partidas p
  left join public.perfiles pf on pf.id = p.anfitrion_id
  where p.estado = 'en_curso' and p.codigo = upper(btrim(ver_sala.codigo));
$$;

revoke execute on function public.ver_sala(text) from public;
grant execute on function public.ver_sala(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Unirse con el código
--
-- Con cuenta, entra con el nombre del perfil. Invitado anónimo, con el nombre
-- que escribió. Si ya estaba, no hace nada. Devuelve el id de la partida, o
-- null si no hay una partida en curso con ese código.
-- -----------------------------------------------------------------------------

create or replace function public.unirse_a_partida(codigo text, nombre text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  v_partida uuid;
  v_nombre text := btrim(coalesce(nombre, ''));
begin
  if yo is null then
    raise exception 'Hace falta una sesión (con cuenta o como invitado)' using errcode = '42501';
  end if;

  select p.id into v_partida
  from public.partidas p
  where p.estado = 'en_curso' and p.codigo = upper(btrim(unirse_a_partida.codigo));
  if v_partida is null then
    return null;
  end if;

  if exists (select 1 from public.partida_jugadores j where j.partida_id = v_partida and j.user_id = yo) then
    return v_partida;
  end if;

  if not exists (select 1 from public.perfiles p where p.id = yo)
     and char_length(v_nombre) not between 1 and 40 then
    raise exception 'Falta el nombre del invitado' using errcode = '22023';
  end if;

  -- Con perfil, el trigger reemplaza el nombre por el del perfil.
  insert into public.partida_jugadores (partida_id, user_id, nombre)
  values (v_partida, yo, coalesce(nullif(v_nombre, ''), 'Jugador'));
  return v_partida;
end;
$$;

revoke execute on function public.unirse_a_partida(text, text) from public, anon;
grant execute on function public.unirse_a_partida(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Permisos y RLS
-- -----------------------------------------------------------------------------

revoke all on public.partidas, public.partida_jugadores from anon, authenticated;

grant select, delete on public.partidas to authenticated;
grant select, delete on public.partida_jugadores to authenticated;
grant insert (partida_id, user_id, nombre) on public.partida_jugadores to authenticated;
grant update (puntos) on public.partida_jugadores to authenticated;

alter table public.partidas          enable row level security;
alter table public.partida_jugadores enable row level security;

-- partidas --------------------------------------------------------------------

create policy "partidas: leer las propias y en las que juego"
  on public.partidas for select
  to authenticated
  using (anfitrion_id = (select auth.uid()) or (select public.juego_en_partida(id)));

create policy "partidas: el anfitrión cancela las en curso"
  on public.partidas for delete
  to authenticated
  using (anfitrion_id = (select auth.uid()) and estado = 'en_curso');

-- partida_jugadores -----------------------------------------------------------

create policy "jugadores: leer los de mis partidas"
  on public.partida_jugadores for select
  to authenticated
  using ((select public.juego_en_partida(partida_id)) or (select public.es_anfitrion(partida_id)));

-- El anfitrión agrega amigos (con su cuenta) o a alguien sin celular (sin
-- user_id). Los demás entran con unirse_a_partida().
create policy "jugadores: el anfitrión agrega amigos o jugadores sin celular"
  on public.partida_jugadores for insert
  to authenticated
  with check (
    (select public.es_anfitrion(partida_id))
    and (select public.partida_en_curso(partida_id))
    and (user_id is null or (select public.es_amigo(user_id)))
  );

create policy "jugadores: cada uno sus puntos, el anfitrión los de todos"
  on public.partida_jugadores for update
  to authenticated
  using (
    (select public.partida_en_curso(partida_id))
    and (user_id = (select auth.uid()) or (select public.es_anfitrion(partida_id)))
  )
  with check (
    (select public.partida_en_curso(partida_id))
    and (user_id = (select auth.uid()) or (select public.es_anfitrion(partida_id)))
  );

-- Irse de la sala (salvo el anfitrión) o, el anfitrión, sacar a otro.
create policy "jugadores: irse o que el anfitrión saque a otro"
  on public.partida_jugadores for delete
  to authenticated
  using (
    (select public.partida_en_curso(partida_id))
    and (
      (user_id = (select auth.uid()) and not (select public.es_anfitrion(partida_id)))
      or ((select public.es_anfitrion(partida_id)) and user_id is distinct from (select auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- Realtime: aviso de cambios
--
-- Cada cambio en los jugadores (o en la partida) manda un mensaje de
-- Broadcast al canal "sala:<id de la partida>" con solo el id: los clientes
-- vuelven a pedir los datos, y esa consulta pasa por RLS. Así llegan también
-- los borrados (postgres_changes no los filtra por RLS) y nadie recibe datos
-- de una sala en la que no está. El canal es público: quien adivinara el uuid
-- de una partida solo vería avisos vacíos.
-- -----------------------------------------------------------------------------

create or replace function public.avisar_cambio_en_sala()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partida uuid;
begin
  if tg_table_name = 'partidas' then
    v_partida := coalesce(new.id, old.id);
  else
    v_partida := coalesce(new.partida_id, old.partida_id);
  end if;
  perform realtime.send(
    jsonb_build_object('partida_id', v_partida),
    'cambio',
    'sala:' || v_partida::text,
    false
  );
  return null;
end;
$$;

revoke execute on function public.avisar_cambio_en_sala() from public, anon, authenticated;

create trigger partida_jugadores_avisar
  after insert or update or delete on public.partida_jugadores
  for each row execute function public.avisar_cambio_en_sala();

create trigger partidas_avisar
  after update or delete on public.partidas
  for each row execute function public.avisar_cambio_en_sala();
