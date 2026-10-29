"use client";

import { CircleUser, Dices, History, LibraryBig, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RUTA_JUGAR, itemActivo } from "@/lib/navegacion";

type Item = { href: string; etiqueta: string; Icono: LucideIcon };

const IZQUIERDA: Item[] = [
  { href: "/catalogo", etiqueta: "Estante", Icono: LibraryBig },
  { href: "/jugar/historial", etiqueta: "Historial", Icono: History },
];
const DERECHA: Item[] = [
  { href: "/jugar/ranking", etiqueta: "Ranking", Icono: Trophy },
  { href: "/cuenta", etiqueta: "Cuenta", Icono: CircleUser },
];

export function BarraInferior() {
  return <BarraInferiorVista pathname={usePathname()} />;
}

/**
 * La barra sin depender de la URL. Se usa como fallback del <Suspense>: en
 * rutas dinámicas (`/juegos/[id]`) usePathname() es dato del request.
 */
export function BarraInferiorVista({ pathname }: { pathname: string | null }) {
  const activo = itemActivo(pathname);

  function enlace({ href, etiqueta, Icono }: Item) {
    const esActivo = activo === href;
    return (
      <li key={href} className="flex-1">
        <Link
          href={href}
          aria-current={esActivo ? "page" : undefined}
          className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-extrabold ${
            esActivo ? "text-primario" : "text-texto-suave hover:text-texto"
          }`}
        >
          <Icono aria-hidden className="size-6" strokeWidth={esActivo ? 2.4 : 1.9} />
          {etiqueta}
        </Link>
      </li>
    );
  }

  const jugarActivo = activo === RUTA_JUGAR;
  return (
    <nav
      aria-label="Navegación principal"
      className="border-borde bg-superficie/95 fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-end px-1">
        {IZQUIERDA.map(enlace)}
        {/* Jugar, en el centro y destacado: lo principal de la app. */}
        <li className="flex flex-1 justify-center">
          <Link
            href={RUTA_JUGAR}
            aria-current={jugarActivo ? "page" : undefined}
            className={`-mt-7 flex flex-col items-center gap-0.5 pb-1.5 text-xs font-extrabold ${
              jugarActivo ? "text-acento" : "text-texto-suave hover:text-texto"
            }`}
          >
            <span className="bg-acento text-sobre-acento border-fondo relieve-acento flex size-15 items-center justify-center rounded-full border-4 transition active:translate-y-0.5">
              <Dices aria-hidden className="size-7" strokeWidth={2.4} />
            </span>
            Jugar
          </Link>
        </li>
        {DERECHA.map(enlace)}
      </ul>
    </nav>
  );
}
