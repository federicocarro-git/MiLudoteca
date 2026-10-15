-- =============================================================================
-- Fase 2, hito 11: cierre de partidas, historial, notas y fotos
--
-- * terminar_partida(): el anfitrión cierra la sala y se decide quién ganó:
--     'mas_puntos'    gana el puntaje más alto (empates: ganan todos los empatados)
--     'menos_puntos'  gana el puntaje más bajo
--     'manual'        el anfitrión elige a los ganadores (puede no haber ninguno)
--     'cooperativo'   ganan o pierden todos juntos
--   Queda guardada la posición de cada uno (salvo en los cooperativos).
-- * partidas.notas: las escribe el anfitrión (durante o después).
-- * Fotos: bucket público fotos-partidas, carpeta <id de la partida>/. Suben
--   los jugadores con cuenta (hasta 12 por partida); cada uno borra las suyas
--   y el anfitrión, cualquiera. Las ven los que jugaron.
-- * El anfitrión puede borrar una partida terminada (sale del historial de
--   todos).
-- =============================================================================

alter table public.partidas
  add column modo_resultado    text check (modo_resultado in ('mas_puntos', 'menos_puntos', 'manual', 'cooperativo')),
  add column cooperativo_ganado boolean,
  add column notas             text check (char_length(notas) <= 2000),
  add constraint partidas_terminada_con_resultado
    check (estado <> 'terminada' or (modo_resultado is not null and terminada_en is not null)),
  add constraint partidas_cooperativo_con_resultado
    check ((modo_resultado = 'cooperativo') = (cooperativo_ganado is not null));

comment on column public.partidas.modo_resultado is 'Cómo se decidió quién ganó (al terminar).';

alter table public.partida_jugadores
  add column gano     boolean not null default false,
  -- 1 = primero. Empatados comparten posición. Null en los cooperativos.
  add column posicion smallint check (posicion >= 1);

create index partidas_terminadas_idx on public.partidas (terminada_en desc) where estado = 'terminada';

-- -----------------------------------------------------------------------------
-- Terminar una partida
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

revoke execute on function public.terminar_partida(uuid, text, uuid[], boolean) from public, anon;
grant execute on function public.terminar_partida(uuid, text, uuid[], boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Permisos: notas y borrar partidas terminadas
-- -----------------------------------------------------------------------------

grant update (notas) on public.partidas to authenticated;

create policy "partidas: el anfitrión escribe las notas"
  on public.partidas for update
  to authenticated
  using (anfitrion_id = (select auth.uid()))
  with check (anfitrion_id = (select auth.uid()));

drop policy "partidas: el anfitrión cancela las en curso" on public.partidas;

-- En curso es cancelar la sala; terminada, sacarla del historial de todos.
create policy "partidas: el anfitrión las borra"
  on public.partidas for delete
  to authenticated
  using (anfitrion_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Fotos de las partidas
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-partidas',
  'fotos-partidas',
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

-- La partida a la que pertenece un archivo (<id>/<archivo>), o null.
create or replace function public.partida_de_foto(ruta text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (storage.foldername(ruta))[1]::uuid;
exception when others then
  return null;
end;
$$;

-- ¿Puede el usuario actual subir otra foto a esta partida? Con cuenta, que
-- haya jugado y que no haya 12 todavía.
create or replace function public.puede_subir_foto(partida uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    partida is not null
    and not (select public.es_anonimo())
    and (public.juego_en_partida(partida) or public.es_anfitrion(partida))
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'fotos-partidas' and public.partida_de_foto(o.name) = partida
    ) < 12;
$$;

revoke execute on function public.puede_subir_foto(uuid) from public, anon;
grant execute on function public.puede_subir_foto(uuid) to authenticated;

create policy "fotos-partidas: subir si jugué"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos-partidas'
    and (select public.puede_subir_foto(public.partida_de_foto(name)))
  );

create policy "fotos-partidas: ver las de mis partidas"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fotos-partidas'
    and (
      (select public.juego_en_partida(public.partida_de_foto(name)))
      or (select public.es_anfitrion(public.partida_de_foto(name)))
    )
  );

-- Cada uno las suyas; el anfitrión, todas.
create policy "fotos-partidas: borrar las propias o, el anfitrión, cualquiera"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fotos-partidas'
    and (
      owner_id = (select auth.uid())::text
      or (select public.es_anfitrion(public.partida_de_foto(name)))
    )
  );
