import { BarraInferior } from "@/components/layout/barra-inferior";

// La sesión la exige el proxy (src/proxy.ts). Cada página lee al usuario
// dentro de su propio <Suspense>, nunca acá: un await en el layout bloquearía
// todo el segmento (ver Cache Components en CLAUDE.md).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-24 print:p-0">
        {children}
      </main>
      <BarraInferior />
    </>
  );
}
