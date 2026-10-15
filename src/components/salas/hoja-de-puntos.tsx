"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { claveCasillero } from "@/lib/salas/tipos";
import { PUNTOS_MAX } from "@/lib/validations/salas";

type Jugador = { id: string; nombre: string };

/**
 * Hoja de puntuación: una fila por ronda o categoría, una columna por
 * jugador y el total abajo. Con `onCambiar`, los casilleros editables se
 * pueden escribir; sin él, es de solo lectura (el resultado de la partida).
 */
export function HojaDePuntos({
  filas,
  jugadores,
  casilleros,
  totales,
  editable = () => false,
  onCambiar,
  onAgregarRonda,
}: {
  filas: string[];
  jugadores: Jugador[];
  casilleros: Map<string, number>;
  totales: Map<string, number>;
  editable?: (jugadorId: string) => boolean;
  onCambiar?: (jugadorId: string, columna: number, puntos: number | null) => void;
  onAgregarRonda?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="border-borde overflow-x-auto rounded-2xl border">
        <table className="w-full border-collapse text-sm" aria-label="Hoja de puntuación">
          <thead>
            <tr className="bg-fondo">
              <th scope="col" className="bg-fondo sticky left-0 z-10 min-w-24 p-2 text-left">
                <span className="sr-only">Fila</span>
              </th>
              {jugadores.map((j) => (
                <th
                  key={j.id}
                  scope="col"
                  className="max-w-24 min-w-18 truncate p-2 text-center font-semibold"
                >
                  {j.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, columna) => (
              <tr key={`${fila}-${columna}`} className="border-borde border-t">
                <th
                  scope="row"
                  className="bg-superficie sticky left-0 z-10 p-2 text-left font-medium"
                >
                  {fila}
                </th>
                {jugadores.map((j) => {
                  const valor = casilleros.get(claveCasillero(j.id, columna));
                  return (
                    <td key={j.id} className="p-1 text-center">
                      {onCambiar && editable(j.id) ? (
                        <Casillero
                          valor={valor}
                          etiqueta={`${fila} de ${j.nombre}`}
                          onCambiar={(puntos) => onCambiar(j.id, columna, puntos)}
                        />
                      ) : (
                        <span
                          className="inline-block min-h-11 py-2.5 tabular-nums"
                          aria-label={`${fila} de ${j.nombre}: ${valor ?? "sin anotar"}`}
                        >
                          {valor ?? "—"}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-borde bg-primario/10 border-t-2">
              <th scope="row" className="bg-fondo sticky left-0 z-10 p-2 text-left font-bold">
                Total
              </th>
              {jugadores.map((j) => (
                <td
                  key={j.id}
                  className="p-2 text-center text-lg font-bold tabular-nums"
                  aria-label={`Total de ${j.nombre}: ${totales.get(j.id) ?? 0}`}
                >
                  {totales.get(j.id) ?? 0}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {onAgregarRonda && (
        <Boton variante="secundario" onClick={onAgregarRonda}>
          <Plus aria-hidden className="size-4" /> Agregar ronda
        </Boton>
      )}
    </div>
  );
}

/** Un casillero que se escribe: vacío lo borra. */
function Casillero({
  valor,
  etiqueta,
  onCambiar,
}: {
  valor: number | undefined;
  etiqueta: string;
  onCambiar: (puntos: number | null) => void;
}) {
  // Lo que se está escribiendo (puede quedar con "-" un momento).
  const [texto, setTexto] = useState<string | null>(null);
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={etiqueta}
      value={texto ?? (valor === undefined ? "" : String(valor))}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const limpio = e.target.value.replace(/[^\d-]/g, "");
        setTexto(limpio);
        if (limpio === "") onCambiar(null);
        else if (/^-?\d+$/.test(limpio)) {
          onCambiar(Math.max(-PUNTOS_MAX, Math.min(PUNTOS_MAX, Number(limpio))));
        }
      }}
      onBlur={() => setTexto(null)}
      className="border-borde bg-superficie focus-visible:outline-primario h-11 w-16 rounded-lg border text-center text-base tabular-nums focus-visible:outline-2"
    />
  );
}
