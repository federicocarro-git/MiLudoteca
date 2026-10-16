"use client";

import { ChevronRight, HeartHandshake, Swords, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/amigos/avatar";
import { Selector } from "@/components/ui/campo";
import { Chip } from "@/components/ui/chip";
import type { PartidaHistorial } from "@/lib/partidas/consultas";
import { opcionesDeFiltro } from "@/lib/partidas/historial";
import {
  calcularCaraACara,
  calcularDuplas,
  calcularRanking,
  calcularRankingCooperativo,
  nemesis,
  type Persona,
} from "@/lib/partidas/ranking";

const TARJETA = "border-borde bg-superficie space-y-3 relieve rounded-2xl border p-4";

const porcentaje = (p: number | null) => (p === null ? "—" : `${Math.round(p * 100)}%`);

type Modo = "competitivo" | "cooperativo";

/**
 * Ranking entre vos y tus amigos: competitivo (victorias y cara a cara) o
 * cooperativo (ganadas y duplas). Modo y juego van a la query string
 * (?modo=cooperativo&juego=).
 */
export function RankingInteractivo({
  partidas,
  yo,
  amigos,
  juegoInicial,
  modoInicial,
}: {
  partidas: PartidaHistorial[];
  yo: Persona;
  amigos: Persona[];
  juegoInicial: string | null;
  modoInicial: Modo;
}) {
  const [modo, setModo] = useState<Modo>(modoInicial);
  const juegosDe = (m: Modo) =>
    opcionesDeFiltro(
      partidas.filter((p) => (p.modo_resultado === "cooperativo") === (m === "cooperativo")),
      yo.id,
    ).juegos;
  const juegos = juegosDe(modo);
  const [juego, setJuego] = useState(
    juegos.some((o) => o.valor === juegoInicial) ? juegoInicial : null,
  );

  function actualizarUrl(m: Modo, j: string | null) {
    const params = new URLSearchParams();
    if (m === "cooperativo") params.set("modo", m);
    if (j) params.set("juego", j);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  function cambiarJuego(valor: string) {
    setJuego(valor || null);
    actualizarUrl(modo, valor || null);
  }

  function cambiarModo(m: Modo) {
    // El juego elegido sigue solo si también tiene partidas del otro tipo.
    const sigue = juegosDe(m).some((o) => o.valor === juego) ? juego : null;
    setModo(m);
    setJuego(sigue);
    actualizarUrl(m, sigue);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="group" aria-label="Tipo de partidas">
        <Chip activo={modo === "competitivo"} onClick={() => cambiarModo("competitivo")}>
          Competitivo
        </Chip>
        <Chip activo={modo === "cooperativo"} onClick={() => cambiarModo("cooperativo")}>
          Cooperativo
        </Chip>
      </div>

      {juegos.length > 1 && (
        <Selector
          etiqueta="Juego"
          id="ranking-juego"
          value={juego ?? ""}
          onChange={(e) => cambiarJuego(e.target.value)}
        >
          <option value="">Todos los juegos</option>
          {juegos.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Selector>
      )}

      {modo === "competitivo" ? (
        <Competitivo partidas={partidas} yo={yo} amigos={amigos} juego={juego} />
      ) : (
        <Cooperativo partidas={partidas} yo={yo} amigos={amigos} juego={juego} />
      )}
    </div>
  );
}

type PropsSeccion = {
  partidas: PartidaHistorial[];
  yo: Persona;
  amigos: Persona[];
  juego: string | null;
};

function Competitivo({ partidas, yo, amigos, juego }: PropsSeccion) {
  const ranking = calcularRanking(partidas, yo, amigos, juego);
  const caraACara = calcularCaraACara(partidas, yo.id, amigos, juego);
  const rival = nemesis(caraACara);

  return (
    <>
      <section className={TARJETA} aria-labelledby="titulo-ranking">
        <h2 id="titulo-ranking" className="flex items-center gap-2 font-semibold">
          <Trophy aria-hidden className="size-5 text-amber-500" /> Victorias
        </h2>
        <ol className="space-y-2" aria-label="Ranking">
          {ranking.map((f, i) => (
            <li
              key={f.id}
              aria-label={f.nombre}
              className={`flex items-center gap-3 rounded-xl border p-2 ${
                f.esYo ? "border-primario" : "border-borde"
              }`}
            >
              <span className="w-6 text-center font-bold tabular-nums">{i + 1}</span>
              <Avatar nombre={f.nombre} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {f.nombre}
                  {f.esYo && <span className="text-texto-suave font-normal"> (vos)</span>}
                </span>
                <span className="text-texto-suave block text-xs">
                  {f.partidas === 1 ? "1 partida" : `${f.partidas} partidas`} ·{" "}
                  {porcentaje(f.porcentaje)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-xl font-bold tabular-nums">{f.victorias}</span>
                <span className="text-texto-suave block text-xs">
                  {f.victorias === 1 ? "victoria" : "victorias"}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-texto-suave text-xs">
          Cuentan las partidas competitivas que jugaste; las cooperativas tienen su propio ranking.
          Los invitados no entran en el ranking.
        </p>
      </section>

      <section className={TARJETA} aria-labelledby="titulo-cara-a-cara">
        <h2 id="titulo-cara-a-cara" className="flex items-center gap-2 font-semibold">
          <Swords aria-hidden className="text-primario size-5" /> Cara a cara
        </h2>
        {rival && (
          <p className="rounded-xl bg-red-50 p-3 text-sm dark:bg-red-950">
            Tu némesis: <strong>{rival.nombre}</strong>. Te ganó {rival.perdi}{" "}
            {rival.perdi === 1 ? "vez" : "veces"} y vos a {rival.nombre}, {rival.gane}.
          </p>
        )}
        {caraACara.length === 0 ? (
          <p className="text-texto-suave text-sm">
            Cuando termines partidas con tus amigos, acá vas a ver quién le gana a quién.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="Cara a cara">
            {caraACara.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/jugar/historial?con=${f.id}${juego ? `&juego=${encodeURIComponent(juego)}` : ""}`}
                  aria-label={`${f.nombre}: vos ${f.gane}, ${f.nombre} ${f.perdi}`}
                  className="border-borde hover:border-primario flex items-center gap-3 rounded-xl border p-2"
                >
                  <Avatar nombre={f.nombre} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{f.nombre}</span>
                    <span className="text-texto-suave block text-xs">
                      {f.juntos === 1 ? "1 partida juntos" : `${f.juntos} partidas juntos`}
                      {f.empates > 0 && ` · ${f.empates} ${f.empates === 1 ? "empate" : "empates"}`}
                    </span>
                  </span>
                  <span className="text-lg font-bold tabular-nums" aria-hidden>
                    <span className={f.gane > f.perdi ? "text-primario" : ""}>{f.gane}</span>
                    <span className="text-texto-suave mx-1">–</span>
                    <span className={f.perdi > f.gane ? "text-red-700 dark:text-red-400" : ""}>
                      {f.perdi}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="text-texto-suave size-5 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-texto-suave text-xs">
          En cada partida gana el duelo quien ganó o, si ninguno de los dos ganó, quien quedó mejor
          ubicado.
        </p>
      </section>
    </>
  );
}

function Cooperativo({ partidas, yo, amigos, juego }: PropsSeccion) {
  const filas = calcularRankingCooperativo(partidas, yo, amigos, juego);
  const duplas = calcularDuplas(partidas, yo, amigos, juego);

  return (
    <>
      <section className={TARJETA} aria-labelledby="titulo-cooperativo">
        <h2 id="titulo-cooperativo" className="flex items-center gap-2 font-semibold">
          <HeartHandshake aria-hidden className="text-primario size-5" /> Partidas ganadas
        </h2>
        <ol className="space-y-2" aria-label="Ranking cooperativo">
          {filas.map((f, i) => (
            <li
              key={f.id}
              aria-label={f.nombre}
              className={`flex items-center gap-3 rounded-xl border p-2 ${
                f.esYo ? "border-primario" : "border-borde"
              }`}
            >
              <span className="w-6 text-center font-bold tabular-nums">{i + 1}</span>
              <Avatar nombre={f.nombre} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {f.nombre}
                  {f.esYo && <span className="text-texto-suave font-normal"> (vos)</span>}
                </span>
                <span className="text-texto-suave block text-xs">
                  {f.partidas === 1 ? "1 partida" : `${f.partidas} partidas`} ·{" "}
                  {porcentaje(f.porcentaje)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-xl font-bold tabular-nums">{f.ganadas}</span>
                <span className="text-texto-suave block text-xs">
                  {f.ganadas === 1 ? "ganada" : "ganadas"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className={TARJETA} aria-labelledby="titulo-duplas">
        <h2 id="titulo-duplas" className="flex items-center gap-2 font-semibold">
          <Users aria-hidden className="text-primario size-5" /> Duplas
        </h2>
        {duplas.length === 0 ? (
          <p className="text-texto-suave text-sm">
            Cuando terminen partidas cooperativas juntos, acá vas a ver con quién ganás más.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="Duplas">
            {duplas.map((d) => {
              const [a, b] = d.personas;
              const nombres = `${d.conmigo && a.id === yo.id ? "Vos" : a.nombre} y ${b.nombre}`;
              return (
                <li
                  key={`${a.id}|${b.id}`}
                  aria-label={nombres}
                  className={`flex items-center gap-3 rounded-xl border p-2 ${
                    d.conmigo ? "border-primario" : "border-borde"
                  }`}
                >
                  <span className="flex shrink-0 -space-x-3">
                    <Avatar nombre={a.nombre} className="ring-superficie ring-2" />
                    <Avatar nombre={b.nombre} className="ring-superficie ring-2" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{nombres}</span>
                    <span className="text-texto-suave block text-xs">
                      {d.juntas === 1 ? "Jugaron 1 partida" : `Jugaron ${d.juntas} partidas`} y{" "}
                      {d.ganadas === 1 ? "ganaron 1" : `ganaron ${d.ganadas}`}
                    </span>
                  </span>
                  <span className="text-lg font-bold tabular-nums">{porcentaje(d.porcentaje)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-texto-suave text-xs">
          Cuentan las partidas cooperativas que jugaste, con vos y tus amigos. Los invitados no
          entran.
        </p>
      </section>
    </>
  );
}
