-- =============================================================================
-- Salas sin juego, revancha y reabrir una partida
--
-- * crear_sala_sin_juego(): la sala arranca sin juego ("Elegimos en la mesa")
--   y se elige después con cambiar_juego_de_sala(), entre los catálogos de
--   todos los que se sumaron. No se puede terminar sin juego.
-- * revancha(partida): el anfitrión de una partida terminada crea otra sala
--   con el mismo juego, la misma forma de anotar y los mismos jugadores
--   (los amigos con cuenta y los que juegan sin celular; los invitados
--   anónimos y los que no son amigos vuelven a entrar con el código). Si ya
--   hay una revancha en curso, devuelve esa.
-- * reabrir_partida(partida): el anfitrión vuelve a poner en curso una
--   partida que terminó hace menos de 10 minutos (por si la terminó sin
--   querer). Se borra el resultado y se conservan los puntos.
-- =============================================================================

alter table public.partidas
  alter column juego_nombre drop not null,
  add column revancha_de uuid references public.partidas (id) on delete set null,
  add constraint partidas_terminada_con_juego
    check (estado <> 'terminada' or juego_nombre is not null);

comment on column public.partidas.revancha_de is 'Partida de la que esta sala es la revancha.';

create index partidas_revancha_de_idx on public.partidas (revancha_de);

-- -----------------------------------------------------------------------------
-- Crear una sala sin juego
-- -----------------------------------------------------------------------------

create or replace function public.crear_sala_sin_juego()
returns table (id uuid, codigo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  v_partida public.partidas;
begin
  if yo is null or not exists (select 1 from public.perfiles p where p.id = yo) then
    raise exception 'Hace falta una cuenta para crear una sala' using errcode = '42501';
  end if;

  loop
    begin
      insert into public.partidas (codigo, anfitrion_id)
      values (public.generar_codigo(6), yo)
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

revoke execute on function public.crear_sala_sin_juego() from public, anon;
grant execute on function public.crear_sala_sin_juego() to authenticated;

-- -----------------------------------------------------------------------------
-- Terminar exige que la sala tenga juego
-- -----------------------------------------------------------------------------

create or replace function public.terminar_partida(
  partida uuid,
  modo text,
  ganadores uuid[] default null,
  ganamos boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.partidas p
    where p.id = partida and p.anfitrion_id = (select auth.uid()) and p.estado = 'en_curso'
  ) then
    raise exception 'Solo el anfitrión puede terminar una partida en curso' using errcode = '42501';
  end if;
  if exists (select 1 from public.partidas p where p.id = partida and p.juego_nombre is null) then
    raise exception 'Falta elegir el juego' using errcode = 'P0001', hint = 'sin_juego';
  end if;
  if modo not in ('mas_puntos', 'menos_puntos', 'manual', 'cooperativo') then
    raise exception 'Modo de resultado inválido: %', modo using errcode = '22023';
  end if;
  if modo = 'cooperativo' and ganamos is null then
    raise exception 'Falta si ganaron o perdieron' using errcode = '22023';
  end if;

  if modo = 'cooperativo' then
    update public.partida_jugadores
    set gano = ganamos, posicion = null
    where partida_id = partida;
  else
    with orden as (
      select
        j.id,
        dense_rank() over (
          order by case when modo = 'menos_puntos' then j.puntos else -j.puntos end
        ) as pos
      from public.partida_jugadores j
      where j.partida_id = partida
    )
    update public.partida_jugadores j
    set
      posicion = orden.pos,
      gano = case
        when modo = 'manual' then j.id = any (coalesce(ganadores, '{}'))
        else orden.pos = 1
      end
    from orden
    where j.id = orden.id;
  end if;

  update public.partidas
  set
    estado = 'terminada',
    terminada_en = now(),
    modo_resultado = modo,
    cooperativo_ganado = case when modo = 'cooperativo' then ganamos end
  where id = partida;
end;
$$;

-- -----------------------------------------------------------------------------
-- Revancha
-- -----------------------------------------------------------------------------

create or replace function public.revancha(partida uuid)
returns table (id uuid, codigo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  v_anterior public.partidas;
  v_partida public.partidas;
begin
  select * into v_anterior
  from public.partidas p
  where p.id = partida and p.anfitrion_id = yo and p.estado = 'terminada';
  if not found or not exists (select 1 from public.perfiles pf where pf.id = yo) then
    raise exception 'Solo el anfitrión arma la revancha de una partida terminada' using errcode = '42501';
  end if;

  -- Una sola revancha en curso por partida (por si se toca dos veces).
  select * into v_partida
  from public.partidas p
  where p.revancha_de = v_anterior.id and p.estado = 'en_curso' and p.anfitrion_id = yo
  limit 1;
  if found then
    return query select v_partida.id, v_partida.codigo;
    return;
  end if;

  loop
    begin
      insert into public.partidas (
        codigo, juego_id, juego_nombre, juego_imagen_url, anfitrion_id,
        tipo_puntaje, categorias, revancha_de
      )
      values (
        public.generar_codigo(6), v_anterior.juego_id, v_anterior.juego_nombre,
        v_anterior.juego_imagen_url, yo, v_anterior.tipo_puntaje, v_anterior.categorias,
        v_anterior.id
      )
      returning * into v_partida;
      exit;
    exception when unique_violation then
    end;
  end loop;

  insert into public.partida_jugadores (partida_id, user_id, nombre)
  values (v_partida.id, yo, 'anfitrión');

  -- Los amigos (con cuenta) y los que jugaron sin celular, en el mismo orden
  -- (unido_en ordena la sala; en una misma transacción now() no cambia).
  insert into public.partida_jugadores (partida_id, user_id, nombre, unido_en)
  select
    v_partida.id, j.user_id, j.nombre,
    now() + row_number() over (order by j.unido_en, j.id) * interval '1 millisecond'
  from public.partida_jugadores j
  where j.partida_id = v_anterior.id
    and j.user_id is distinct from yo
    and (
      (j.user_id is null and j.invitado)
      or (j.user_id is not null and public.es_amigo(j.user_id))
    );

  return query select v_partida.id, v_partida.codigo;
end;
$$;

revoke execute on function public.revancha(uuid) from public, anon;
grant execute on function public.revancha(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Reabrir una partida recién terminada
-- -----------------------------------------------------------------------------

create or replace function public.reabrir_partida(partida uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partida public.partidas;
  v_codigo text;
begin
  select * into v_partida
  from public.partidas p
  where p.id = partida and p.anfitrion_id = (select auth.uid()) and p.estado = 'terminada';
  if not found then
    raise exception 'Solo el anfitrión reabre una partida terminada' using errcode = '42501';
  end if;
  if v_partida.terminada_en < now() - interval '10 minutes' then
    raise exception 'Pasaron más de 10 minutos' using errcode = 'P0001', hint = 'muy_tarde';
  end if;

  update public.partida_jugadores j
  set gano = false, posicion = null
  where j.partida_id = partida;

  -- El código puede haberlo tomado otra sala mientras tanto: usar otro.
  v_codigo := v_partida.codigo;
  loop
    begin
      update public.partidas p
      set estado = 'en_curso', codigo = v_codigo, terminada_en = null,
          modo_resultado = null, cooperativo_ganado = null
      where p.id = partida;
      exit;
    exception when unique_violation then
      v_codigo := public.generar_codigo(6);
    end;
  end loop;

  return v_codigo;
end;
$$;

revoke execute on function public.reabrir_partida(uuid) from public, anon;
grant execute on function public.reabrir_partida(uuid) to authenticated;
