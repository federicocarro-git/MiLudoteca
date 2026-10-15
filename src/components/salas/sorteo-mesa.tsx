"use client";

import { Check, Dices, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { cambiarJuegoDeSala } from "@/app/sala/[codigo]/actions";
import { ImagenJuego } from "@/components/juegos/imagen-juego";
import { Boton } from "@/components/ui/boton";
import { Selector } from "@/components/ui/campo";
import { OPCIONES_DURACION, elegirAlAzar } from "@/lib/catalogo/filtros";
import { formatearDuracion, formatearJugadores } from "@/lib/formato";
import { agruparPorJuego, juegosParaLaMesa, type JuegoConDuenos } from "@/lib/mesa/juegos";
import { unirNombres } from "@/lib/partidas/resultado";
import { createClient } from "@/lib/supabase/client";

const DURACION_GIRO_MS = 900;
const PASO_GIRO_MS = 90;

type Candidato = JuegoConDuenos & { id: string };

/**
 * "¿A qué jugamos?" con los catálogos de todos los que están en la sala,
 * para la cantidad de jugadores de la mesa. El anfitrión puede pasar la sala
 * al juego que salió.
 */
export function SorteoMesa({
  partidaId,
  juegoActualId,
  jugadores,
  soyAnfitrion,
  onListo,
}: {
  partidaId: string;
  juegoActualId: string | null;
  jugadores: number;
  soyAnfitrion: boolean;
  onListo: () => void;
}) {
  const [todos, setTodos] = useState<Candidato[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duracion, setDuracion] = useState<number | null>(null);
  const [elegido, setElegido] = useState<Candidato | null>(null);
  const [girando, setGirando] = useState<string | null>(null);
  const [cambiando, iniciar] = useTransition();
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let vigente = true;
    createClient()
      .rpc("juegos_de_la_mesa", { partida: partidaId })
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) setError("No se pudieron traer los juegos de la mesa.");
        else setTodos(agruparPorJuego(data).map((j) => ({ ...j, id: j.clave })));
      });
    const pendientes = timers.current;
    return () => {
      vigente = false;
      pendientes.forEach(clearTimeout);
    };
  }, [partidaId]);

  const candidatos = todos ? juegosParaLaMesa(todos, jugadores, duracion) : [];

  function sortear(anterior?: string) {
    const resultado = elegirAlAzar(candidatos, anterior);
    if (!resultado) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (candidatos.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setElegido(resultado);
      return;
    }
    setElegido(null);
    for (let t = 0; t < DURACION_GIRO_MS; t += PASO_GIRO_MS) {
      timers.current.push(
        window.setTimeout(
          () => setGirando(candidatos[Math.floor(Math.random() * candidatos.length)].nombre),
          t,
        ),
      );
    }
    timers.current.push(
      window.setTimeout(() => {
        setGirando(null);
        setElegido(resultado);
      }, DURACION_GIRO_MS),
    );
  }

  if (error) {
    return <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>;
  }
  if (!todos) {
    return (
      <p className="text-texto-suave flex items-center gap-2 text-sm">
        <Loader2 aria-hidden className="size-4 animate-spin" /> Juntando los catálogos de la mesa…
      </p>
    );
  }

  const sinDatos = todos.length - juegosParaLaMesa(todos, jugadores).length;
  const yaEsElDeLaSala = elegido !== null && elegido.juego_id === juegoActualId;

  return (
    <div className="space-y-4">
      <p className="text-sm">
        {todos.length === 1 ? "1 juego" : `${todos.length} juegos`} entre los catálogos de la mesa ·{" "}
        <strong>
          {candidatos.length === 1
            ? `1 sirve para ${jugadores}`
            : `${candidatos.length} sirven para ${jugadores}`}
        </strong>
      </p>
      <Selector
        etiqueta="Duración máxima"
        id="sorteo-duracion"
        value={duracion ?? ""}
        onChange={(e) => {
          setDuracion(e.target.value ? Number(e.target.value) : null);
          setElegido(null);
        }}
      >
        <option value="">Cualquiera</option>
        {OPCIONES_DURACION.map((m) => (
          <option key={m} value={m}>
            Hasta {formatearDuracion(m)}
          </option>
        ))}
      </Selector>
      {sinDatos > 0 && (
        <p className="text-texto-suave text-xs">
          {sinDatos === 1 ? "1 juego no entra" : `${sinDatos} juegos no entran`}: no sirven para{" "}
          {jugadores} o no tienen la cantidad de jugadores cargada.
        </p>
      )}

      <div
        aria-live="polite"
        className="flex min-h-56 flex-col items-center justify-center gap-3 text-center"
      >
        {girando && (
          <p className="text-texto-suave animate-pulse text-xl font-semibold">{girando}</p>
        )}
        {elegido && !girando && (
          <>
            <ImagenJuego
              url={elegido.imagen_url}
              nombre={elegido.nombre}
              sizes="128px"
              className="aspect-square w-32 rounded-2xl"
            />
            <div>
              <p className="text-2xl font-bold tracking-tight">{elegido.nombre}</p>
              <p className="text-texto-suave text-sm">
                {[
                  formatearJugadores(elegido.jugadores_min, elegido.jugadores_max),
                  formatearDuracion(elegido.duracion_min),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-sm">Lo tiene {unirNombres(elegido.duenos.map((d) => d.nombre))}</p>
            </div>
          </>
        )}
        {!elegido && !girando && (
          <p className="text-texto-suave text-sm">
            {candidatos.length === 0
              ? "Ningún juego de la mesa sirve para esta cantidad de jugadores."
              : "Tocá Sortear y que decida el azar."}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Boton
          variante={elegido ? "secundario" : "primario"}
          className="flex-1"
          disabled={candidatos.length === 0 || (elegido !== null && candidatos.length < 2)}
          onClick={() => sortear(elegido?.id)}
        >
          {elegido ? (
            <RefreshCw aria-hidden className="size-4" />
          ) : (
            <Dices aria-hidden className="size-4" />
          )}
          {elegido ? "Otro" : "Sortear"}
        </Boton>
        {soyAnfitrion && elegido && !girando && (
          <Boton
            className="flex-1"
            disabled={cambiando || yaEsElDeLaSala}
            onClick={() =>
              iniciar(async () => {
                const r = await cambiarJuegoDeSala(partidaId, elegido.juego_id);
                if (r.ok) onListo();
                else setError(r.error);
              })
            }
          >
            {cambiando ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Check aria-hidden className="size-4" />
            )}
            {yaEsElDeLaSala ? "Ya es el de la sala" : "Jugar este"}
          </Boton>
        )}
      </div>
    </div>
  );
}
