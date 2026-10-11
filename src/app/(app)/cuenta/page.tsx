import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import { getUsuarioActual } from "@/lib/auth";
import { cerrarSesion } from "./actions";

export const metadata: Metadata = { title: "Cuenta" };

export default function CuentaPage() {
  return (
    <>
      <EncabezadoPagina titulo="Cuenta" />
      <section className="border-borde bg-superficie space-y-4 rounded-2xl border p-4">
        <Suspense fallback={<p className="bg-borde h-5 w-48 animate-pulse rounded" />}>
          <DatosUsuario />
        </Suspense>
        <form action={cerrarSesion}>
          <Boton variante="secundario" type="submit">
            <LogOut aria-hidden className="size-4" />
            Cerrar sesión
          </Boton>
        </form>
      </section>
    </>
  );
}

async function DatosUsuario() {
  const usuario = await getUsuarioActual();
  return (
    <p className="text-sm">
      <span className="text-texto-suave">Sesión iniciada como </span>
      <strong>{usuario?.email ?? "—"}</strong>
    </p>
  );
}
