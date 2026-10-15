import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/** "‹ Volver a ..." arriba de las pantallas internas. */
export function EnlaceVolver({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-texto-suave hover:text-texto -ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium print:hidden"
    >
      <ChevronLeft aria-hidden className="size-5" />
      {children}
    </Link>
  );
}
