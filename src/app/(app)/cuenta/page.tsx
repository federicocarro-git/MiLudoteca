import { ChevronRight, LogOut, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormularioNombre } from "@/components/cuenta/formulario-nombre";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import { obtenerMiPerfil } from "@/lib/amigos/consultas";
import { getUsuarioActual } from "@/lib/auth";
import { cerrarSesion } from "./actions";

export const metadata: Metadata = { title: "Cuenta" };

const TARJETA = "border-borde bg-superficie space-y-4 rounded-2xl border p-4";

export default function CuentaPage() {
  return (
    <>
      <EncabezadoPagina titulo="Cuenta" />
      <div className="space-y-4">
        <section className={TARJETA} aria-labelledby="titulo-perfil">
          <h2 id="titulo-perfil" className="font-semibold">
            Tu perfil
          </h2>
          <Suspense fallback={<div className="bg-borde h-24 animate-pulse rounded-xl" />}>
            <Perfil />
          </Suspense>
        </section>

        <section className={TARJETA}>
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
      </div>
    </>
  );
}

async function Perfil() {
  const perfil = await obtenerMiPerfil();
  if (!perfil) return <p className="text-sm">No encontramos tu perfil. Volvé a ingresar.</p>;
  return (
    <>
      <FormularioNombre nombre={perfil.nombre} />
      <Link
        href="/jugar/amigos"
        className="border-borde hover:border-primario flex min-h-14 items-center gap-3 rounded-xl border p-3"
      >
        <Users aria-hidden className="text-primario size-5 shrink-0" />
        <span className="flex-1 text-sm">
          Tu código de amigo:{" "}
          <strong className="font-mono tracking-widest">{perfil.codigo_amigo}</strong>
        </span>
        <ChevronRight aria-hidden className="text-texto-suave size-5" />
      </Link>
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
