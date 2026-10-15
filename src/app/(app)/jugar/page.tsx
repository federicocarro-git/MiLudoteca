import { ChevronRight, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { obtenerAmistades } from "@/lib/amigos/consultas";

export const metadata: Metadata = { title: "Jugar" };

export default function JugarPage() {
  return (
    <>
      <EncabezadoPagina titulo="Jugar" />
      <ul className="space-y-3">
        <li>
          <Link
            href="/jugar/amigos"
            className="border-borde bg-superficie hover:border-primario flex min-h-16 items-center gap-3 rounded-2xl border p-4"
          >
            <Users aria-hidden className="text-primario size-6 shrink-0" />
            <span className="flex-1">
              <span className="block font-semibold">Amigos</span>
              <span className="text-texto-suave block text-sm">
                Tu código, solicitudes y lista de amigos
              </span>
            </span>
            <Suspense>
              <SolicitudesPendientes />
            </Suspense>
            <ChevronRight aria-hidden className="text-texto-suave size-5 shrink-0" />
          </Link>
        </li>
      </ul>
    </>
  );
}

async function SolicitudesPendientes() {
  const { recibidas } = await obtenerAmistades();
  if (recibidas.length === 0) return null;
  return (
    <span className="bg-primario text-sobre-primario rounded-full px-2 py-0.5 text-xs font-bold">
      {recibidas.length}
      <span className="sr-only">
        {" "}
        {recibidas.length === 1 ? "solicitud nueva" : "solicitudes nuevas"}
      </span>
    </span>
  );
}
