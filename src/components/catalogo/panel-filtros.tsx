"use client";

import { Chip } from "@/components/ui/chip";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import {
  NIVELES_COMPLEJIDAD,
  OPCIONES_DURACION,
  OPCIONES_JUGADORES,
  type Filtros,
  type NivelComplejidad,
} from "@/lib/catalogo/filtros";
import type { Tipo } from "@/lib/game-data/tipos";
import { formatearDuracion } from "@/lib/formato";

/**
 * Los filtros se aplican al tocarlos (la grilla de atrás se actualiza); el
 * botón de abajo muestra cuántos juegos quedan y cierra la hoja.
 */
export function PanelFiltros({
  abierta,
  onCerrar,
  filtros,
  onCambio,
  tiposDisponibles,
  cantidad,
}: {
  abierta: boolean;
  onCerrar: () => void;
  filtros: Filtros;
  onCambio: (filtros: Filtros) => void;
  tiposDisponibles: Tipo[];
  cantidad: number;
}) {
  const alternar = <K extends keyof Filtros>(clave: K, valor: Filtros[K]) =>
    onCambio({ ...filtros, [clave]: filtros[clave] === valor ? undefined : valor });

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Filtros">
      <div className="space-y-6">
        <Grupo titulo="¿Cuántos son?">
          {OPCIONES_JUGADORES.map((n) => (
            <Chip
              key={n}
              activo={filtros.jugadores === n}
              onClick={() => alternar("jugadores", n)}
              className="min-w-11"
              aria-label={`${n} ${n === 1 ? "jugador" : "jugadores"}`}
            >
              {n}
            </Chip>
          ))}
        </Grupo>

        <Grupo titulo="Duración máxima">
          {OPCIONES_DURACION.map((min) => (
            <Chip
              key={min}
              activo={filtros.duracion === min}
              onClick={() => alternar("duracion", min)}
            >
              {formatearDuracion(min)}
            </Chip>
          ))}
        </Grupo>

        <Grupo titulo="Complejidad">
          {(Object.keys(NIVELES_COMPLEJIDAD) as NivelComplejidad[]).map((nivel) => (
            <Chip
              key={nivel}
              activo={filtros.complejidad === nivel}
              onClick={() => alternar("complejidad", nivel)}
            >
              {NIVELES_COMPLEJIDAD[nivel].etiqueta}
            </Chip>
          ))}
        </Grupo>

        {tiposDisponibles.length > 0 && (
          <Grupo titulo="Tipo">
            {tiposDisponibles.map((tipo) => (
              <Chip
                key={tipo}
                activo={filtros.tipo === tipo}
                onClick={() => alternar("tipo", tipo)}
              >
                {tipo}
              </Chip>
            ))}
          </Grupo>
        )}

        <p className="text-texto-suave text-xs">
          Los juegos sin ese dato cargado no aparecen al filtrar por él.
        </p>

        <div className="bg-superficie sticky bottom-0 flex gap-3 pt-2">
          <Boton
            type="button"
            variante="secundario"
            onClick={() => onCambio({ q: filtros.q, orden: filtros.orden })}
            className="flex-1"
          >
            Limpiar
          </Boton>
          <Boton type="button" onClick={onCerrar} className="flex-[2]">
            {cantidad === 1 ? "Ver 1 juego" : `Ver ${cantidad} juegos`}
          </Boton>
        </div>
      </div>
    </Hoja>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-semibold">{titulo}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
