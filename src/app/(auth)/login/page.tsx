import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { FormularioLogin } from "@/components/auth/formulario-login";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-[max(2rem,env(safe-area-inset-top))]">
      <header className="flex flex-col items-center gap-3 text-center">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={64}
          height={64}
          priority
          className="rounded-2xl"
        />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MiLudoteca</h1>
          <p className="text-texto-suave text-sm">Tus juegos de mesa, siempre a mano.</p>
        </div>
      </header>
      <section className="border-borde bg-superficie relieve rounded-2xl border p-5 shadow-sm">
        {/* useSearchParams (next y error) es dato del request: va en Suspense. */}
        <Suspense fallback={<div className="bg-fondo h-80 animate-pulse rounded-xl" />}>
          <FormularioLogin />
        </Suspense>
      </section>
    </main>
  );
}
