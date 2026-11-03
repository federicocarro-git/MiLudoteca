"use client";

import { History, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { importarPaginaPartidasBgg, terminarImportacionBgg } from "@/app/(app)/cuenta/actions";
import { Boton } from "@/components/ui/boton";
import { PARTIDAS_POR_PAGINA } from "@/lib/coleccion-bgg/partidas";

type Estado =
  | { etapa: "trayendo"; pagina: number; paginas: number | null }
  | { etapa: "listo"; nuevas: number; repetidas: number };

/**
 * "Traer mis partidas": las partidas registradas en BGG pasan al historial
 * (y al ranking, con los amigos que vincularon su usuario de BGG). Se traen
 * de a 100, página por página.
 */
export function PartidasBgg({ deshabilitado }: { deshabilitado: boolean }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trayendo = estado?.etapa === "trayendo";

  async function traer() {
    setError(null);
    setEstado({ etapa: "trayendo", pagina: 1, paginas: null });
    let nuevas = 0;
    let repetidas = 0;
    for (let pagina = 1; ; pagina++) {
      const r = await importarPaginaPartidasBgg(pagina);
      if (!r.ok) {
        setError(
          `${r.error}${nuevas > 0 ? ` Ya se agregaron ${nuevas}: volvé a tocar "Traer mis partidas" para seguir.` : ""}`,
        );
        setEstado(null);
        await terminarImportacionBgg();
        return;
      }
      nuevas += r.data.nuevas;
      repetidas += r.data.repetidas;
      if (!r.data.hayMas) break;
      setEstado({
        etapa: "trayendo",
        pagina: pagina + 1,
        paginas: Math.ceil(r.data.total / PARTIDAS_POR_PAGINA),
      });
    }
    setEstado({ etapa: "listo", nuevas, repetidas });
    await terminarImportacionBgg();
  }

  return (
    <div className="border-borde space-y-3 border-t-[1.5px] pt-4">
      <p className="text-texto-suave text-sm">
        Las partidas que registraste en BGG pasan a tu historial. Tus amigos que vincularon su
        usuario de BGG quedan como jugadores (y suman al ranking); el resto, con su nombre.
      </p>
      <div aria-live="polite" className="text-sm empty:hidden">
        {estado?.etapa === "trayendo" && (
          <p className="flex items-center gap-2">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Trayendo tus partidas
            {estado.paginas ? ` (página ${estado.pagina} de ${estado.paginas})` : ""}…
          </p>
        )}
        {estado?.etapa === "listo" && (
          <div className="bg-primario/10 space-y-1 rounded-2xl p-3">
            <p className="font-semibold">
              {estado.nuevas === 0
                ? "No había partidas nuevas en BGG."
                : `¡Listo! Agregaste ${estado.nuevas === 1 ? "1 partida" : `${estado.nuevas} partidas`} a tu historial.`}
            </p>
            {estado.repetidas > 0 && (
              <p className="text-texto-suave">
                {estado.repetidas === 1 ? "1 ya estaba" : `${estado.repetidas} ya estaban`}.
              </p>
            )}
            {estado.nuevas > 0 && (
              <Link
                href="/jugar/historial"
                className="text-primario inline-flex min-h-11 items-center font-bold"
              >
                Ver el historial
              </Link>
            )}
          </div>
        )}
        {error && <p className="font-medium text-red-700 dark:text-red-400">{error}</p>}
      </div>
      <Boton variante="secundario" onClick={traer} disabled={trayendo || deshabilitado}>
        {trayendo ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <History aria-hidden className="size-4" />
        )}
        Traer mis partidas
      </Boton>
    </div>
  );
}
