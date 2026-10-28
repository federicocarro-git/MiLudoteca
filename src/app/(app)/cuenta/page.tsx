import { ChevronRight, LogOut, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormularioNombre } from "@/components/cuenta/formulario-nombre";
import { VincularBgg } from "@/components/cuenta/vincular-bgg";
import { VisibilidadCatalogo } from "@/components/cuenta/visibilidad-catalogo";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import { obtenerMiPerfil } from "@/lib/amigos/consultas";
import { getUsuarioActual } from "@/lib/auth";
import { elegirProvider } from "@/lib/game-data";
import { cerrarSesion } from "./actions";

export const metadata: Metadata = { title: "Cuenta" };

const TARJETA = "border-borde bg-superficie space-y-4 relieve rounded-2xl border p-4";

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

        {/* Sin token de BGG (en producción) no hay de dónde leer la colección. */}
        {elegirProvider(process.env) !== null && (
          <section className={TARJETA} aria-labelledby="titulo-bgg">
            <h2 id="titulo-bgg" className="font-semibold">
              BoardGameGeek
            </h2>
            <Suspense fallback={<div className="bg-borde h-24 animate-pulse rounded-xl" />}>
              <CuentaBgg />
            </Suspense>
          </section>
        )}

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
      <VisibilidadCatalogo visible={perfil.catalogo_visible} />
    </>
  );
}

async function CuentaBgg() {
  const perfil = await obtenerMiPerfil();
  if (!perfil) return null;
  return <VincularBgg usuario={perfil.bgg_usuario} importadoEn={perfil.bgg_importado_en} />;
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
