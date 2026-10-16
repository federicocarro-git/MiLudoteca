"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  NIVELES_COMPLEJIDAD,
  ORDENES,
  contarFiltros,
  escribirFiltros,
  filtrarCatalogo,
  leerFiltros,
  tiposDelCatalogo,
  type Filtros,
  type JuegoCatalogo,
  type Orden,
} from "@/lib/catalogo/filtros";
import { formatearDuracion } from "@/lib/formato";
import { PanelFiltros } from "./panel-filtros";
import { SorteoJuego } from "./sorteo-juego";
import { TarjetaJuego } from "./tarjeta-juego";

/**
 * Grilla del catálogo con filtros. Los filtros viven en la query string y se
 * actualizan con history.replaceState (Next sincroniza useSearchParams), así
 * filtrar no vuelve a pedir el catálogo al servidor.
 */
export function CatalogoInteractivo({ juegos }: { juegos: JuegoCatalogo[] }) {
  const searchParams = useSearchParams();
  const filtros = useMemo(() => leerFiltros(searchParams), [searchParams]);
  const [texto, setTexto] = useState(filtros.q ?? "");
  const [panelAbierto, setPanelAbierto] = useState(false);

  const visibles = useMemo(() => filtrarCatalogo(juegos, filtros), [juegos, filtros]);
  const tiposDisponibles = useMemo(() => tiposDelCatalogo(juegos), [juegos]);
  const cantidadFiltros = contarFiltros(filtros);

  function actualizar(nuevos: Filtros) {
    const qs = escribirFiltros(nuevos);
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  function buscar(valor: string) {
    setTexto(valor);
    actualizar({ ...filtros, q: valor.trim() || undefined });
  }

  function limpiarTodo() {
    setTexto("");
    actualizar({ orden: filtros.orden });
  }

  const activos: Array<{ clave: keyof Filtros; texto: string }> = [];
  if (filtros.jugadores)
    activos.push({ clave: "jugadores", texto: `${filtros.jugadores} jugadores` });
  if (filtros.duracion)
    activos.push({ clave: "duracion", texto: `Hasta ${formatearDuracion(filtros.duracion)}` });
  if (filtros.complejidad)
    activos.push({
      clave: "complejidad",
      texto: NIVELES_COMPLEJIDAD[filtros.complejidad].etiqueta,
    });
  if (filtros.tipo) activos.push({ clave: "tipo", texto: filtros.tipo });

  return (
    <div className="space-y-4">
      <SorteoJuego juegos={visibles} />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="text-texto-suave pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
          />
          <input
            type="search"
            aria-label="Buscar en tu estante"
            placeholder="Buscar en tu estante…"
            value={texto}
            onChange={(e) => buscar(e.target.value)}
            enterKeyHint="search"
            autoComplete="off"
            className="border-borde bg-superficie focus-visible:outline-primario block min-h-12 w-full rounded-full border-[1.5px] pr-4 pl-11 text-base focus-visible:outline-2"
          />
        </div>
        <button
          type="button"
          onClick={() => setPanelAbierto(true)}
          className="border-borde bg-superficie hover:bg-fondo relieve relative inline-flex min-h-12 items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-bold"
        >
          <SlidersHorizontal aria-hidden className="size-5" />
          Filtros
          {cantidadFiltros > 0 && (
            <span className="bg-primario text-sobre-primario flex size-5 items-center justify-center rounded-full text-xs">
              {cantidadFiltros}
              <span className="sr-only"> activos</span>
            </span>
          )}
        </button>
      </div>

      {activos.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Filtros activos">
          {activos.map(({ clave, texto }) => (
            <li key={clave}>
              <button
                type="button"
                onClick={() => actualizar({ ...filtros, [clave]: undefined })}
                className="bg-texto text-fondo inline-flex min-h-9 items-center gap-1.5 rounded-full pr-2.5 pl-3.5 text-sm font-bold"
              >
                {texto}
                <X aria-hidden className="size-4" />
                <span className="sr-only">(quitar filtro)</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-texto-suave text-sm">
          {visibles.length === juegos.length
            ? `${juegos.length} ${juegos.length === 1 ? "juego" : "juegos"}`
            : `${visibles.length} de ${juegos.length} juegos`}
        </p>
        <label className="text-texto-suave flex items-center gap-1.5 text-sm">
          <span className="sr-only">Ordenar por</span>
          <select
            value={filtros.orden ?? "nombre"}
            onChange={(e) => actualizar({ ...filtros, orden: e.target.value as Orden })}
            className="text-texto min-h-11 bg-transparent text-right font-medium"
          >
            {(Object.keys(ORDENES) as Orden[]).map((orden) => (
              <option key={orden} value={orden}>
                {ORDENES[orden]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visibles.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visibles.map((juego, i) => (
            <li key={juego.id}>
              <TarjetaJuego juego={juego} prioridad={i < 4} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-borde space-y-3 rounded-2xl border border-dashed px-6 py-10 text-center">
          <p className="font-semibold">Ningún juego coincide</p>
          <p className="text-texto-suave text-sm">Probá sacando algún filtro.</p>
          <button
            type="button"
            onClick={limpiarTodo}
            className="text-primario min-h-11 text-sm font-semibold"
          >
            Limpiar filtros y búsqueda
          </button>
        </div>
      )}

      <PanelFiltros
        abierta={panelAbierto}
        onCerrar={() => setPanelAbierto(false)}
        filtros={filtros}
        onCambio={actualizar}
        tiposDisponibles={tiposDisponibles}
        cantidad={visibles.length}
      />
    </div>
  );
}
