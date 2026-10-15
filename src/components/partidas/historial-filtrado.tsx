"use client";

import { ChevronRight, Crown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Selector } from "@/components/ui/campo";
import type { PartidaHistorial } from "@/lib/partidas/consultas";
import { filtrarHistorial, miParticipacion, opcionesDeFiltro } from "@/lib/partidas/historial";
import { formatearFecha, textoResultado } from "@/lib/partidas/resultado";

/**
 * Lista del historial con filtros por juego y por persona. Los filtros van a
 * la query string (?juego=&con=) con replaceState, como en el catálogo.
 */
export function HistorialFiltrado({
  partidas,
  yo,
  filtrosIniciales,
}: {
  partidas: PartidaHistorial[];
  yo: string;
  filtrosIniciales: { juego: string | null; con: string | null };
}) {
  const { juegos, personas } = opcionesDeFiltro(partidas, yo);
  const validos = {
    juego: juegos.some((o) => o.valor === filtrosIniciales.juego) ? filtrosIniciales.juego : null,
    con: personas.some((o) => o.valor === filtrosIniciales.con) ? filtrosIniciales.con : null,
  };
  const [filtros, setFiltros] = useState(validos);

  function cambiar(campo: "juego" | "con", valor: string) {
    const nuevos = { ...filtros, [campo]: valor || null };
    setFiltros(nuevos);
    const params = new URLSearchParams();
    if (nuevos.juego) params.set("juego", nuevos.juego);
    if (nuevos.con) params.set("con", nuevos.con);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  const visibles = filtrarHistorial(partidas, filtros);
  const ganadas = visibles.filter((p) => miParticipacion(p, yo)?.gano).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Selector
          etiqueta="Juego"
          id="filtro-juego"
          value={filtros.juego ?? ""}
          onChange={(e) => cambiar("juego", e.target.value)}
        >
          <option value="">Todos</option>
          {juegos.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector
          etiqueta="Jugaste con"
          id="filtro-con"
          value={filtros.con ?? ""}
          onChange={(e) => cambiar("con", e.target.value)}
        >
          <option value="">Cualquiera</option>
          {personas.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Selector>
      </div>

      <p className="text-texto-suave text-sm" aria-live="polite">
        {visibles.length === 1 ? "1 partida" : `${visibles.length} partidas`} · ganaste {ganadas}
      </p>

      <ul className="space-y-2">
        {visibles.map((p) => {
          const mia = miParticipacion(p, yo);
          return (
            <li key={p.id}>
              <Link
                href={`/partida/${p.id}`}
                className="border-borde bg-superficie hover:border-primario flex items-center gap-3 rounded-2xl border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{p.juego_nombre}</span>
                    {mia?.gano && (
                      <Crown
                        aria-label="Ganaste"
                        className="size-4 shrink-0 fill-amber-400 text-amber-500"
                      />
                    )}
                  </p>
                  <p className="text-texto-suave truncate text-sm">
                    {formatearFecha(p.terminada_en ?? p.creada_en)} · {textoResultado(p)}
                  </p>
                  <p className="text-texto-suave truncate text-xs">
                    {p.jugadores.map((j) => j.nombre).join(", ")}
                  </p>
                </div>
                {mia && p.modo_resultado !== "cooperativo" && (
                  <p className="text-right">
                    <span className="block text-lg font-bold tabular-nums">{mia.puntos}</span>
                    <span className="text-texto-suave block text-xs">
                      {mia.posicion ? `${mia.posicion}º` : ""}
                    </span>
                  </p>
                )}
                <ChevronRight aria-hidden className="text-texto-suave size-5 shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
