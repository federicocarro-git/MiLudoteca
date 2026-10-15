"use client";

import { Crown, Flag, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { terminarPartida } from "@/app/sala/[codigo]/actions";
import { Boton } from "@/components/ui/boton";
import { Chip } from "@/components/ui/chip";
import {
  MODOS_RESULTADO,
  NOMBRE_MODO,
  ganadoresPrevistos,
  unirNombres,
  type ModoResultado,
} from "@/lib/partidas/resultado";
import type { JugadorSala } from "@/lib/salas/tipos";

/** Para el anfitrión: cómo se gana, quiénes ganaron y confirmar. */
export function TerminarPartida({
  partidaId,
  jugadores,
  guardandoPuntos,
}: {
  partidaId: string;
  jugadores: JugadorSala[];
  /** Hay puntos tocados que todavía no se guardaron: esperar. */
  guardandoPuntos: boolean;
}) {
  const [modo, setModo] = useState<ModoResultado>("mas_puntos");
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [ganamos, setGanamos] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminando, iniciar] = useTransition();

  const ganadores = ganadoresPrevistos(jugadores, modo, { elegidos, ganamos });
  const nombresGanadores = jugadores.filter((j) => ganadores.has(j.id)).map((j) => j.nombre);
  const falta = modo === "cooperativo" && ganamos === null;

  let resumen: string;
  if (modo === "cooperativo") {
    resumen =
      ganamos === null ? "¿Ganaron o perdieron?" : ganamos ? "Ganaron todos" : "Perdieron todos";
  } else if (nombresGanadores.length === 0) {
    resumen = "Nadie gana";
  } else if (nombresGanadores.length === jugadores.length && jugadores.length > 1) {
    resumen = "Empate: ganan todos";
  } else {
    resumen = `${nombresGanadores.length === 1 ? "Gana" : "Ganan"} ${unirNombres(nombresGanadores)}`;
  }

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">¿Cómo se gana?</legend>
        {MODOS_RESULTADO.map((m) => (
          <label
            key={m}
            className="border-borde has-checked:border-primario has-checked:bg-primario/5 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3"
          >
            <input
              type="radio"
              name="modo"
              value={m}
              checked={modo === m}
              onChange={() => setModo(m)}
              className="accent-primario size-5"
            />
            <span className="text-sm font-medium">{NOMBRE_MODO[m]}</span>
          </label>
        ))}
      </fieldset>

      {modo === "manual" && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">¿Quiénes ganaron?</legend>
          <div className="flex flex-wrap gap-2">
            {jugadores.map((j) => (
              <Chip
                key={j.id}
                activo={elegidos.includes(j.id)}
                onClick={() =>
                  setElegidos((lista) =>
                    lista.includes(j.id) ? lista.filter((id) => id !== j.id) : [...lista, j.id],
                  )
                }
              >
                {j.nombre}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      {modo === "cooperativo" && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">¿Cómo les fue?</legend>
          <div className="flex gap-2">
            <Chip activo={ganamos === true} onClick={() => setGanamos(true)}>
              Ganamos
            </Chip>
            <Chip activo={ganamos === false} onClick={() => setGanamos(false)}>
              Perdimos
            </Chip>
          </div>
        </fieldset>
      )}

      <p
        className="bg-primario/10 flex items-center gap-2 rounded-2xl p-3 font-semibold"
        aria-live="polite"
      >
        <Crown aria-hidden className="size-5 shrink-0 fill-amber-400 text-amber-500" />
        {resumen}
      </p>

      <p className="text-texto-suave text-sm">
        Después de terminar ya no se pueden cambiar los puntos. La partida queda en el historial de
        los que tienen cuenta.
      </p>

      <p
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {error}
      </p>

      <Boton
        className="w-full"
        disabled={terminando || guardandoPuntos || falta}
        onClick={() =>
          iniciar(async () => {
            const r = await terminarPartida(partidaId, {
              modo,
              ganadores: modo === "manual" ? [...ganadores] : [],
              ganamos: modo === "cooperativo" ? ganamos : null,
            });
            // Si sale bien, la acción redirige al resultado.
            if (!r.ok) setError(r.error);
          })
        }
      >
        {terminando || guardandoPuntos ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <Flag aria-hidden className="size-4" />
        )}
        {guardandoPuntos ? "Guardando puntos…" : "Terminar y guardar"}
      </Boton>
    </div>
  );
}
