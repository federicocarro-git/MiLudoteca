"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { sufijo: "", etiqueta: "Ficha" },
  { sufijo: "/como-se-juega", etiqueta: "Cómo se juega" },
  { sufijo: "/hoja-de-turno", etiqueta: "Hoja de turno" },
];

/** Pestañas de la ficha. Cada una es una ruta (se puede compartir e imprimir). */
export function PestanasJuego({ id }: { id: string }) {
  return <PestanasVista id={id} pathname={usePathname()} />;
}

/** Sin pathname (fallback de <Suspense>) ninguna se marca como activa. */
export function PestanasVista({ id, pathname }: { id: string; pathname: string | null }) {
  return (
    <nav
      aria-label="Secciones del juego"
      className="bg-fondo/95 sticky top-0 z-20 -mx-4 px-4 py-2 backdrop-blur print:hidden"
    >
      <ul className="bg-superficie border-borde grid grid-cols-3 rounded-xl border p-1">
        {PESTANAS.map(({ sufijo, etiqueta }) => {
          const href = `/juegos/${id}${sufijo}`;
          const activa = pathname === href;
          return (
            <li key={sufijo}>
              <Link
                href={href}
                replace
                scroll={false}
                aria-current={activa ? "page" : undefined}
                className={`flex min-h-10 items-center justify-center rounded-lg px-1 text-center text-sm leading-tight font-medium ${
                  activa ? "bg-primario text-sobre-primario" : "text-texto-suave hover:text-texto"
                }`}
              >
                {etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
