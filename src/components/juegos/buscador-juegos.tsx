"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { buscarJuegos, obtenerDatosJuego } from "@/app/(app)/juegos/nuevo/actions";
import type { DatosJuego, ProviderId, ResultadoBusqueda } from "@/lib/game-data/types";
import { useDebounce } from "@/hooks/use-debounce";

export const NOMBRE_ORIGEN: Record<ProviderId, string> = {
  bgg: "BoardGameGeek",
  mock: "la base de prueba",
};

type Busqueda =
  | { estado: "inactiva" }
  | { estado: "buscando"; consulta: string }
  | { estado: "lista"; consulta: string; resultados: ResultadoBusqueda[] }
  | { estado: "error"; consulta: string; error: string };

export function BuscadorJuegos({
  origen,
  onElegir,
}: {
  origen: ProviderId;
  onElegir: (datos: DatosJuego) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const demorada = useDebounce(consulta.trim(), 350);
  const [busqueda, setBusqueda] = useState<Busqueda>({ estado: "inactiva" });
  const [cargandoId, setCargandoId] = useState<string | null>(null);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  useEffect(() => {
    if (demorada.length < 2) return;
    let vigente = true;
    // Mostrar "buscando" sin bloquear: la respuesta puede llegar desordenada,
    // por eso se descartan las que no son de la última consulta.
    queueMicrotask(() => vigente && setBusqueda({ estado: "buscando", consulta: demorada }));
    buscarJuegos(demorada).then((r) => {
      if (!vigente) return;
      setBusqueda(
        r.ok
          ? { estado: "lista", consulta: demorada, resultados: r.data }
          : { estado: "error", consulta: demorada, error: r.error },
      );
    });
    return () => {
      vigente = false;
    };
  }, [demorada]);

  async function elegir(id: string) {
    setCargandoId(id);
    setErrorDetalle(null);
    const r = await obtenerDatosJuego(id);
    setCargandoId(null);
    if (!r.ok) {
      setErrorDetalle(r.error);
      return;
    }
    onElegir(r.data);
    setConsulta("");
  }

  const activa = consulta.trim().length >= 2 && busqueda.estado !== "inactiva";

  return (
    <section className="border-borde bg-superficie relieve space-y-3 rounded-2xl border p-4">
      <div>
        <h2 className="font-semibold">Buscar el juego</h2>
        <p className="text-texto-suave text-sm">
          Completá el formulario con los datos de {NOMBRE_ORIGEN[origen]} y después editalos.
        </p>
      </div>
      <div className="relative">
        <Search
          aria-hidden
          className="text-texto-suave pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <input
          type="search"
          aria-label="Buscar por nombre"
          placeholder="Ej.: Catan, Azul, Pandemic…"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          enterKeyHint="search"
          autoComplete="off"
          className="border-borde bg-fondo focus-visible:outline-primario block min-h-11 w-full rounded-xl border pr-11 pl-10 text-base focus-visible:outline-2"
        />
        {consulta && (
          <button
            type="button"
            onClick={() => setConsulta("")}
            aria-label="Borrar búsqueda"
            className="text-texto-suave absolute top-0 right-0 flex size-11 items-center justify-center"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <div aria-live="polite">
        {activa && busqueda.estado === "buscando" && (
          <p className="text-texto-suave flex items-center gap-2 text-sm">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Buscando…
          </p>
        )}
        {activa && busqueda.estado === "error" && (
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{busqueda.error}</p>
        )}
        {activa && busqueda.estado === "lista" && busqueda.resultados.length === 0 && (
          <p className="text-texto-suave text-sm">
            No encontramos “{busqueda.consulta}”. Podés cargarlo a mano abajo.
          </p>
        )}
        {errorDetalle && (
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{errorDetalle}</p>
        )}
      </div>

      {activa && busqueda.estado === "lista" && busqueda.resultados.length > 0 && (
        <ul className="divide-borde border-borde max-h-80 divide-y overflow-y-auto rounded-xl border">
          {busqueda.resultados.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => elegir(r.id)}
                disabled={cargandoId !== null}
                className="hover:bg-fondo flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left disabled:opacity-60"
              >
                <span>
                  <span className="font-medium">{r.nombre}</span>
                  {r.anio && <span className="text-texto-suave"> ({r.anio})</span>}
                </span>
                {cargandoId === r.id && (
                  <Loader2 aria-label="Cargando" className="size-4 shrink-0 animate-spin" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
