import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";

export const metadata: Metadata = { title: "Editar resumen" };

// Hito 7: editor de resúmenes en markdown.
export default function EditarResumenPage() {
  return (
    <>
      <EncabezadoPagina titulo="Editar resumen" />
      <p className="text-texto-suave">El editor de resúmenes llega en el hito 7.</p>
    </>
  );
}
