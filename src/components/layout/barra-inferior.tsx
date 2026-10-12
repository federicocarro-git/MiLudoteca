"use client";

import { CircleUser, LibraryBig, SquarePlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; etiqueta: string; Icono: LucideIcon };

const ITEMS: Item[] = [
  { href: "/catalogo", etiqueta: "Catálogo", Icono: LibraryBig },
  { href: "/juegos/nuevo", etiqueta: "Agregar", Icono: SquarePlus },
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
  return (
    <nav
      aria-label="Navegación principal"
      className="border-borde bg-superficie/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map(({ href, etiqueta, Icono }) => {
          const activo =
            pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  activo ? "text-primario" : "text-texto-suave hover:text-texto"
                }`}
              >
                <Icono aria-hidden className="size-6" strokeWidth={activo ? 2.25 : 1.75} />
                {etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
