import type { ReactNode } from "react";

export function EncabezadoPagina({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
      {children}
    </header>
  );
}
