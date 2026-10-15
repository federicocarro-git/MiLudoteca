// Como las salas: sin barra inferior, porque el resultado también lo ven los
// invitados sin cuenta.
export default function PartidaLayout({ children }: LayoutProps<"/partida">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {children}
    </main>
  );
}
