// Las salas tienen su propio layout, sin la barra inferior: a /sala/<código>
// también entran invitados sin cuenta (por el QR).
export default function SalaLayout({ children }: LayoutProps<"/sala">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {children}
    </main>
  );
}
