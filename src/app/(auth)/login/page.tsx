import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ingresar" };

// Hito 2: login con email y con Google.
export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-2 px-4">
      <h1 className="text-2xl font-bold">MiLudoteca</h1>
      <p className="text-texto-suave">El ingreso con email y con Google llega en el hito 2.</p>
    </main>
  );
}
