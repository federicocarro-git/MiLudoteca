import { Crown } from "lucide-react";
import { Avatar } from "@/components/amigos/avatar";
import type { Partida } from "@/lib/partidas/consultas";

/** Jugadores ordenados por posición, con puntos y quién ganó. */
export function TablaResultado({
  jugadores,
  cooperativo,
  yo,
}: {
  jugadores: Partida["jugadores"];
  cooperativo: boolean;
  yo: string | null;
}) {
  return (
    <ol className="space-y-2" aria-label="Resultado">
      {jugadores.map((j) => (
        <li
          key={j.id}
          aria-label={j.nombre}
          className={`bg-superficie flex items-center gap-3 rounded-2xl border p-3 ${
            j.gano ? "border-amber-400" : "border-borde"
          }`}
        >
          {!cooperativo && (
            <span className="text-texto-suave w-6 text-center text-sm font-semibold tabular-nums">
              {j.posicion ? `${j.posicion}º` : ""}
            </span>
          )}
          <Avatar nombre={j.nombre} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{j.nombre}</span>
              {j.gano && (
                <Crown
                  aria-label="Ganó"
                  className="size-4 shrink-0 fill-amber-400 text-amber-500"
                />
              )}
            </p>
            <p className="text-texto-suave text-xs">
              {[
                j.user_id && j.user_id === yo && "vos",
                j.invitado && (j.user_id ? "invitado" : "sin celular"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            <span className="sr-only">Puntos: </span>
            {j.puntos}
          </p>
        </li>
      ))}
    </ol>
  );
}
