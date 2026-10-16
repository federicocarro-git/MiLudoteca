"use client";

import { Check, Loader2, UserMinus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { aceptarSolicitud, borrarAmistad } from "@/app/(app)/jugar/amigos/actions";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import type { Amigo, Amistades } from "@/lib/amigos/consultas";
import { Avatar } from "./avatar";

/** Solicitudes recibidas y enviadas, y la lista de amigos. */
export function ListaAmigos({ amistades }: { amistades: Amistades }) {
  const { amigos, recibidas, enviadas } = amistades;
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<Amigo | null>(null);

  function ejecutar(
    accion: () => Promise<{ ok: boolean; error?: string }>,
    alTerminar?: () => void,
  ) {
    iniciar(async () => {
      const r = await accion();
      setError(r.ok ? null : (r.error ?? null));
      if (r.ok) alTerminar?.();
    });
  }

  return (
    <div className="space-y-6">
      <p
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {error}
      </p>

      {recibidas.length > 0 && (
        <section className="space-y-2" aria-labelledby="titulo-recibidas">
          <h2 id="titulo-recibidas" className="font-semibold">
            Solicitudes recibidas
          </h2>
          <ul className="space-y-2">
            {recibidas.map((a) => (
              <Fila key={a.id} amigo={a}>
                <Boton
                  className="px-3"
                  disabled={pendiente}
                  aria-label={`Aceptar a ${a.nombre}`}
                  onClick={() => ejecutar(() => aceptarSolicitud(a.id))}
                >
                  <Check aria-hidden className="size-4" /> Aceptar
                </Boton>
                <Boton
                  variante="secundario"
                  className="px-3"
                  disabled={pendiente}
                  aria-label={`Rechazar a ${a.nombre}`}
                  onClick={() => ejecutar(() => borrarAmistad(a.id))}
                >
                  <X aria-hidden className="size-4" />
                </Boton>
              </Fila>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2" aria-labelledby="titulo-amigos">
        <h2 id="titulo-amigos" className="font-semibold">
          Tus amigos{" "}
          {amigos.length > 0 && <span className="text-texto-suave">({amigos.length})</span>}
        </h2>
        {amigos.length === 0 ? (
          <p className="text-texto-suave text-sm">
            Todavía no tenés amigos en MiLudoteca. Compartí tu código o escribí el de alguien.
          </p>
        ) : (
          <ul className="space-y-2">
            {amigos.map((a) => (
              <Fila key={a.id} amigo={a}>
                <button
                  type="button"
                  onClick={() => setEliminando(a)}
                  aria-label={`Dejar de ser amigo de ${a.nombre}`}
                  className="text-texto-suave inline-flex size-11 items-center justify-center rounded-xl hover:text-red-700 dark:hover:text-red-400"
                >
                  <UserMinus aria-hidden className="size-5" />
                </button>
              </Fila>
            ))}
          </ul>
        )}
      </section>

      {enviadas.length > 0 && (
        <section className="space-y-2" aria-labelledby="titulo-enviadas">
          <h2 id="titulo-enviadas" className="font-semibold">
            Esperando respuesta
          </h2>
          <ul className="space-y-2">
            {enviadas.map((a) => (
              <Fila key={a.id} amigo={a}>
                <Boton
                  variante="secundario"
                  className="px-3"
                  disabled={pendiente}
                  aria-label={`Cancelar la solicitud a ${a.nombre}`}
                  onClick={() => ejecutar(() => borrarAmistad(a.id))}
                >
                  Cancelar
                </Boton>
              </Fila>
            ))}
          </ul>
        </section>
      )}

      <Hoja
        abierta={eliminando !== null}
        onCerrar={() => setEliminando(null)}
        titulo="¿Dejar de ser amigos?"
      >
        {eliminando && (
          <div className="space-y-4">
            <p className="text-sm">
              <strong>{eliminando.nombre}</strong> va a dejar de aparecer en tu lista. Las partidas
              que jugaron juntos se conservan.
            </p>
            <div className="flex gap-3">
              <Boton variante="secundario" className="flex-1" onClick={() => setEliminando(null)}>
                Cancelar
              </Boton>
              <Boton
                className="flex-1 bg-red-700 hover:bg-red-800"
                disabled={pendiente}
                onClick={() =>
                  ejecutar(
                    () => borrarAmistad(eliminando.id),
                    () => setEliminando(null),
                  )
                }
              >
                {pendiente && <Loader2 aria-hidden className="size-4 animate-spin" />}
                Dejar de ser amigos
              </Boton>
            </div>
          </div>
        )}
      </Hoja>
    </div>
  );
}

function Fila({ amigo, children }: { amigo: Amigo; children: React.ReactNode }) {
  return (
    <li className="border-borde bg-superficie relieve flex items-center gap-3 rounded-2xl border p-3">
      <Avatar nombre={amigo.nombre} />
      <span className="min-w-0 flex-1 truncate font-medium">{amigo.nombre}</span>
      <div className="flex shrink-0 gap-2">{children}</div>
    </li>
  );
}
