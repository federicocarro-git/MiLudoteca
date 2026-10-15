"use client";

import { Crown, DoorOpen, Loader2, QrCode, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  actualizarPuntos,
  cancelarSala,
  quitarJugador,
  salirDeSala,
} from "@/app/sala/[codigo]/actions";
import { Avatar } from "@/components/amigos/avatar";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { COLUMNAS_JUGADOR, puntajeMasAlto, type JugadorSala, type Sala } from "@/lib/salas/tipos";
import { createClient } from "@/lib/supabase/client";
import { AgregarJugadores, type AmigoDisponible } from "./agregar-jugadores";
import { InvitarASala } from "./invitar-a-sala";
import { Marcador } from "./marcador";

// Espera antes de guardar los puntos: los toques seguidos en +/− se mandan
// juntos (siempre el valor final, no la diferencia).
const ESPERA_GUARDADO_MS = 400;
// Por si se pierde algún aviso de Realtime.
const RECARGA_PERIODICA_MS = 15_000;

type Conexion = "conectando" | "en_vivo" | "sin_conexion";

/** La sala mientras se juega: jugadores, puntos en vivo y acciones. */
export function SalaEnVivo({
  sala,
  jugadores: iniciales,
  yo,
  url,
  qrSvg,
  amigosDisponibles,
}: {
  sala: Sala;
  jugadores: JugadorSala[];
  yo: string;
  url: string;
  qrSvg: string;
  amigosDisponibles: AmigoDisponible[];
}) {
  const soyAnfitrion = sala.anfitrion_id === yo;
  // Lo último que se sabe del servidor (render inicial, Realtime o recarga).
  const [remotos, setRemotos] = useState(iniciales);
  // Si el servidor vuelve a renderizar (refresh() de una acción), tomar lo nuevo.
  const [inicialesPrevios, setInicialesPrevios] = useState(iniciales);
  if (iniciales !== inicialesPrevios) {
    setInicialesPrevios(iniciales);
    setRemotos(iniciales);
  }
  // Puntos tocados acá que todavía no se guardaron: mandan sobre lo remoto,
  // para que un evento viejo no pise lo que se acaba de tocar.
  const [pendientes, setPendientes] = useState<Record<string, number>>({});
  const temporizadores = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const jugadores = remotos.map((j) =>
    j.id in pendientes ? { ...j, puntos: pendientes[j.id] } : j,
  );

  const [conexion, setConexion] = useState<Conexion>("conectando");
  const [fuera, setFuera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoja, setHoja] = useState<"invitar" | "agregar" | "salir" | null>(null);
  const [quitando, setQuitando] = useState<JugadorSala | null>(null);
  const [pendiente, iniciar] = useTransition();

  const recargar = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("partida_jugadores")
      .select(COLUMNAS_JUGADOR)
      .eq("partida_id", sala.id)
      .order("unido_en");
    if (error) return;
    // Si me sacaron o se canceló la sala, RLS ya no me devuelve mi fila.
    if (!data.some((j) => j.user_id === yo)) {
      setFuera(true);
      return;
    }
    setRemotos(data);
  }, [sala.id, yo]);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`sala:${sala.id}`)
      // La base avisa cada cambio (trigger avisar_cambio_en_sala); los datos
      // se vuelven a pedir con RLS.
      .on("broadcast", { event: "cambio" }, () => void recargar())
      .subscribe((estado) => {
        if (estado === "SUBSCRIBED") {
          setConexion("en_vivo");
          // Lo que haya cambiado mientras se conectaba.
          void recargar();
        } else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") {
          setConexion("sin_conexion");
        }
      });
    const intervalo = setInterval(() => void recargar(), RECARGA_PERIODICA_MS);
    const alVolver = () => document.visibilityState === "visible" && void recargar();
    document.addEventListener("visibilitychange", alVolver);
    const timers = temporizadores.current;
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      timers.forEach(clearTimeout);
      void supabase.removeChannel(canal);
    };
  }, [sala.id, recargar]);

  function cambiarPuntos(jugadorId: string, puntos: number) {
    setPendientes((p) => ({ ...p, [jugadorId]: puntos }));
    clearTimeout(temporizadores.current.get(jugadorId));
    temporizadores.current.set(
      jugadorId,
      setTimeout(async () => {
        const r = await actualizarPuntos(jugadorId, puntos);
        if (r.ok) {
          setRemotos((lista) => lista.map((j) => (j.id === jugadorId ? { ...j, puntos } : j)));
        }
        // Si mientras tanto se tocó de nuevo, el próximo guardado se encarga.
        setPendientes((p) => {
          if (p[jugadorId] !== puntos) return p;
          const resto = { ...p };
          delete resto[jugadorId];
          return resto;
        });
        setError(r.ok ? null : r.error);
        if (!r.ok) void recargar();
      }, ESPERA_GUARDADO_MS),
    );
  }

  function ejecutar(
    accion: () => Promise<{ ok: boolean; error?: string }>,
    alTerminar?: () => void,
  ) {
    iniciar(async () => {
      const r = await accion();
      setError(r.ok ? null : (r.error ?? null));
      if (r.ok) alTerminar?.();
    });
  }

  if (fuera) {
    return (
      <section className="border-borde bg-superficie space-y-3 rounded-2xl border p-6 text-center">
        <DoorOpen aria-hidden className="text-primario mx-auto size-10" />
        <h2 className="font-semibold">Ya no estás en esta sala</h2>
        <p className="text-texto-suave text-sm">La sala se canceló o te sacaron.</p>
        <Link
          href="/jugar"
          className="text-primario inline-flex min-h-11 items-center font-semibold"
        >
          Ir a Jugar
        </Link>
      </section>
    );
  }

  const lideres = puntajeMasAlto(jugadores);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-texto-suave flex items-center gap-1.5 text-xs font-medium" role="status">
          <span
            aria-hidden
            className={`size-2 rounded-full ${
              conexion === "en_vivo"
                ? "bg-green-600"
                : conexion === "conectando"
                  ? "bg-amber-500"
                  : "bg-red-600"
            }`}
          />
          {conexion === "en_vivo"
            ? "En vivo"
            : conexion === "conectando"
              ? "Conectando…"
              : "Sin conexión en vivo: se actualiza cada 15 segundos"}
        </p>
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={() => setHoja("invitar")}>
            <QrCode aria-hidden className="size-4" /> Invitar
          </Boton>
          {soyAnfitrion && (
            <Boton variante="secundario" onClick={() => setHoja("agregar")}>
              <UserPlus aria-hidden className="size-4" /> Agregar
            </Boton>
          )}
        </div>
      </div>

      <p
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {error}
      </p>

      <ul className="space-y-2" aria-label="Jugadores">
        {jugadores.map((j) => {
          const esYo = j.user_id === yo;
          const editable = esYo || soyAnfitrion;
          const etiquetas = [
            esYo && "vos",
            j.user_id && j.user_id === sala.anfitrion_id && "anfitrión",
            j.invitado && (j.user_id ? "invitado" : "sin celular"),
          ].filter(Boolean);
          return (
            <li
              key={j.id}
              aria-label={j.nombre}
              className={`bg-superficie flex items-center gap-3 rounded-2xl border p-3 ${
                esYo ? "border-primario" : "border-borde"
              }`}
            >
              <Avatar nombre={j.nombre} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-medium">
                  <span className="truncate">{j.nombre}</span>
                  {lideres.has(j.id) && (
                    <Crown
                      aria-label="Va ganando"
                      className="size-4 shrink-0 fill-amber-400 text-amber-500"
                    />
                  )}
                </p>
                {etiquetas.length > 0 && (
                  <p className="text-texto-suave text-xs">{etiquetas.join(" · ")}</p>
                )}
              </div>
              {editable ? (
                <Marcador
                  puntos={j.puntos}
                  nombre={j.nombre}
                  onCambiar={(n) => cambiarPuntos(j.id, n)}
                />
              ) : (
                <p className="w-20 text-center text-2xl font-bold tabular-nums">
                  <span className="sr-only">Puntos: </span>
                  {j.puntos}
                </p>
              )}
              {soyAnfitrion && !esYo && (
                <button
                  type="button"
                  onClick={() => setQuitando(j)}
                  aria-label={`Sacar a ${j.nombre}`}
                  className="text-texto-suave -mr-1 inline-flex size-11 items-center justify-center rounded-xl hover:text-red-700 dark:hover:text-red-400"
                >
                  <X aria-hidden className="size-5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="pt-2">
        <button
          type="button"
          onClick={() => setHoja("salir")}
          className="text-texto-suave inline-flex min-h-11 items-center gap-1.5 text-sm hover:text-red-700 dark:hover:text-red-400"
        >
          <DoorOpen aria-hidden className="size-4" />
          {soyAnfitrion ? "Cancelar la sala" : "Salir de la sala"}
        </button>
      </div>

      <Hoja abierta={hoja === "invitar"} onCerrar={() => setHoja(null)} titulo="Invitar a la sala">
        <InvitarASala codigo={sala.codigo} url={url} qrSvg={qrSvg} />
      </Hoja>

      {soyAnfitrion && (
        <Hoja
          abierta={hoja === "agregar"}
          onCerrar={() => setHoja(null)}
          titulo="Agregar jugadores"
        >
          {hoja === "agregar" && (
            <AgregarJugadores
              partidaId={sala.id}
              amigos={amigosDisponibles.filter((a) => !jugadores.some((j) => j.user_id === a.id))}
              onListo={() => setHoja(null)}
            />
          )}
        </Hoja>
      )}

      <Hoja
        abierta={hoja === "salir"}
        onCerrar={() => setHoja(null)}
        titulo={soyAnfitrion ? "¿Cancelar la sala?" : "¿Salir de la sala?"}
      >
        <div className="space-y-4">
          <p className="text-sm">
            {soyAnfitrion
              ? "Se borra la sala con todos sus jugadores y puntos. No se puede deshacer."
              : "Vas a dejar de ver la sala. Podés volver a entrar con el código mientras siga en curso."}
          </p>
          <div className="flex gap-3">
            <Boton variante="secundario" className="flex-1" onClick={() => setHoja(null)}>
              Volver
            </Boton>
            <Boton
              className="flex-1 bg-red-700 hover:bg-red-800"
              disabled={pendiente}
              onClick={() =>
                ejecutar(() =>
                  soyAnfitrion ? cancelarSala(sala.id) : salirDeSala(sala.id, sala.codigo),
                )
              }
            >
              {pendiente && <Loader2 aria-hidden className="size-4 animate-spin" />}
              {soyAnfitrion ? "Cancelar la sala" : "Salir"}
            </Boton>
          </div>
        </div>
      </Hoja>

      <Hoja
        abierta={quitando !== null}
        onCerrar={() => setQuitando(null)}
        titulo="¿Sacar al jugador?"
      >
        {quitando && (
          <div className="space-y-4">
            <p className="text-sm">
              <strong>{quitando.nombre}</strong> deja la sala y se pierden sus puntos.
            </p>
            <div className="flex gap-3">
              <Boton variante="secundario" className="flex-1" onClick={() => setQuitando(null)}>
                Volver
              </Boton>
              <Boton
                className="flex-1 bg-red-700 hover:bg-red-800"
                disabled={pendiente}
                onClick={() =>
                  ejecutar(
                    () => quitarJugador(quitando.id),
                    () => setQuitando(null),
                  )
                }
              >
                {pendiente && <Loader2 aria-hidden className="size-4 animate-spin" />}
                Sacar
              </Boton>
            </div>
          </div>
        )}
      </Hoja>
    </div>
  );
}
