"use client";

import { Loader2, Repeat, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { armarRevancha, reabrirPartida } from "@/app/partida/[id]/actions";
import { Boton, BotonLink } from "@/components/ui/boton";
import { tiempoParaReabrir } from "@/lib/partidas/resultado";
import { createClient } from "@/lib/supabase/client";

// Cuánto tiempo después del cierre se sigue atento a una revancha o a que se
// reabra la partida.
const ATENTOS_MS = 30 * 60_000;
const REVISAR_CADA_MS = 10_000;

/** Para el anfitrión: otra sala con el mismo juego y los mismos jugadores. */
export function BotonRevancha({ partidaId }: { partidaId: string }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Boton
        className="w-full"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await armarRevancha(partidaId);
            // Si sale bien, la acción redirige a la sala nueva.
            if (!r.ok) setError(r.error);
          })
        }
      >
        {pendiente ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <Repeat aria-hidden className="size-4" />
        )}
        Revancha
      </Boton>
      <p className="text-texto-suave text-center text-xs">
        Otra sala con el mismo juego y los mismos jugadores.
      </p>
      <p
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {error}
      </p>
    </div>
  );
}

/**
 * Para el anfitrión, durante unos minutos: volver a poner la partida en curso.
 * Se muestra recién en el navegador (depende de la hora).
 */
export function ReabrirPartida({
  partidaId,
  terminadaEn,
}: {
  partidaId: string;
  terminadaEn: string;
}) {
  const [vigente, setVigente] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const restante = tiempoParaReabrir(terminadaEn, Date.now());
    if (restante === 0) return;
    const mostrar = setTimeout(() => setVigente(true), 0);
    const ocultar = setTimeout(() => setVigente(false), restante);
    return () => {
      clearTimeout(mostrar);
      clearTimeout(ocultar);
    };
  }, [terminadaEn]);

  if (!vigente) return null;
  return (
    <section className="border-borde bg-superficie flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
      <p className="text-sm">
        <span className="block font-semibold">¿La terminaste sin querer?</span>
        <span className="text-texto-suave">
          Durante 10 minutos podés reabrirla y seguir anotando.
        </span>
      </p>
      <Boton
        variante="secundario"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await reabrirPartida(partidaId);
            // Si sale bien, la acción redirige a la sala.
            if (!r.ok) setError(r.error);
          })
        }
      >
        {pendiente ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <RotateCcw aria-hidden className="size-4" />
        )}
        Reabrir partida
      </Boton>
      <p
        aria-live="polite"
        className="w-full text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {error}
      </p>
    </section>
  );
}

/**
 * Para los demás jugadores: si el anfitrión reabre la partida, vuelven a la
 * sala; si arma la revancha (y los sumó), aparece el link. Escucha los avisos
 * de la sala y revisa cada tanto, durante un rato después del cierre.
 */
export function AvisoRevancha({
  partidaId,
  terminadaEn,
  revancha: inicial,
}: {
  partidaId: string;
  terminadaEn: string;
  /** Código de la revancha en curso, si ya hay una. */
  revancha: string | null;
}) {
  const router = useRouter();
  const [codigo, setCodigo] = useState(inicial);

  useEffect(() => {
    const restante = Date.parse(terminadaEn) + ATENTOS_MS - Date.now();
    if (restante <= 0) return;
    const supabase = createClient();
    let vigente = true;
    async function revisar() {
      const [{ data: partida }, { data: revancha }] = await Promise.all([
        supabase.from("partidas").select("estado, codigo").eq("id", partidaId).maybeSingle(),
        supabase
          .from("partidas")
          .select("codigo")
          .eq("revancha_de", partidaId)
          .eq("estado", "en_curso")
          .limit(1)
          .maybeSingle(),
      ]);
      if (!vigente) return;
      if (partida?.estado === "en_curso") {
        router.replace(`/sala/${partida.codigo}`);
        return;
      }
      setCodigo(revancha?.codigo ?? null);
    }
    const canal = supabase
      .channel(`sala:${partidaId}`)
      .on("broadcast", { event: "cambio" }, () => void revisar())
      .subscribe();
    const intervalo = setInterval(() => void revisar(), REVISAR_CADA_MS);
    const fin = setTimeout(() => clearInterval(intervalo), restante);
    return () => {
      vigente = false;
      clearInterval(intervalo);
      clearTimeout(fin);
      void supabase.removeChannel(canal);
    };
  }, [partidaId, terminadaEn, router]);

  if (!codigo) return null;
  return (
    <section
      aria-label="Revancha"
      className="bg-primario/10 border-primario flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
    >
      <p className="text-sm">
        <span className="block font-semibold">¡Hay revancha!</span>
        <span className="text-texto-suave">Ya estás en la sala nueva.</span>
      </p>
      <BotonLink href={`/sala/${codigo}`}>
        <Repeat aria-hidden className="size-4" /> Ir a la revancha
      </BotonLink>
    </section>
  );
}
