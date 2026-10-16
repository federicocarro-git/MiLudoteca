"use client";

import { Check, Dices, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { cambiarJuegoDeSala } from "@/app/sala/[codigo]/actions";
import { ImagenJuego } from "@/components/juegos/imagen-juego";
import { Boton } from "@/components/ui/boton";
import { Selector } from "@/components/ui/campo";
import { Chip } from "@/components/ui/chip";
import { OPCIONES_DURACION, elegirAlAzar } from "@/lib/catalogo/filtros";
import { formatearDuracion, formatearJugadores } from "@/lib/formato";
import {
  agruparPorJuego,
  duenosDeLosJuegos,
  filtrarPorDuenos,
  juegosParaLaMesa,
  type JuegoConDuenos,
} from "@/lib/mesa/juegos";
import { unirNombres } from "@/lib/partidas/resultado";
import { createClient } from "@/lib/supabase/client";

const DURACION_GIRO_MS = 900;
const PASO_GIRO_MS = 90;

type Candidato = JuegoConDuenos & { id: string };
type Modo = "elegir" | "sortear";

/**
 * "¿A qué jugamos?" con los catálogos de todos los que están en la sala:
 * elegir uno de la lista o sortear. Se puede filtrar por dueño, por la
 * cantidad de jugadores de la mesa y por duración. El anfitrión puede pasar
 * la sala al juego elegido.
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
  const [modo, setModo] = useState<Modo>("elegir");
  const [duenos, setDuenos] = useState<string[]>([]);
  const [soloParaLaMesa, setSoloParaLaMesa] = useState(true);
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

  const deLosDuenos = todos ? filtrarPorDuenos(todos, duenos) : [];
  const candidatos = soloParaLaMesa
    ? juegosParaLaMesa(deLosDuenos, jugadores, duracion)
    : deLosDuenos.filter(
        (j) => duracion === null || (j.duracion_min !== null && j.duracion_min <= duracion),
      );

  // Si un filtro deja afuera al elegido, se deselecciona.
  if (elegido && !girando && !candidatos.some((c) => c.id === elegido.id)) setElegido(null);

  function cambiarFiltro(cambio: () => void) {
    cambio();
    timers.current.forEach(clearTimeout);
    setGirando(null);
  }

  function cambiarModo(nuevo: Modo) {
    if (nuevo === modo) return;
    timers.current.forEach(clearTimeout);
    setGirando(null);
    setElegido(null);
    setModo(nuevo);
  }

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

  const todosLosDuenos = duenosDeLosJuegos(todos);
  const yaEsElDeLaSala = elegido !== null && elegido.juego_id === juegoActualId;

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="group" aria-label="Cómo elegir">
        <Chip activo={modo === "elegir"} onClick={() => cambiarModo("elegir")}>
          Elegir
        </Chip>
        <Chip activo={modo === "sortear"} onClick={() => cambiarModo("sortear")}>
          Al azar
        </Chip>
      </div>

      {todosLosDuenos.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Filtrar por dueño</legend>
          <div className="flex flex-wrap gap-2">
            {todosLosDuenos.map((d) => (
              <Chip
                key={d.id}
                activo={duenos.includes(d.id)}
                onClick={() =>
                  cambiarFiltro(() =>
                    setDuenos((lista) =>
                      lista.includes(d.id) ? lista.filter((id) => id !== d.id) : [...lista, d.id],
                    ),
                  )
                }
              >
                {d.nombre}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-2 items-end gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={soloParaLaMesa}
            onChange={(e) => cambiarFiltro(() => setSoloParaLaMesa(e.target.checked))}
            className="accent-primario size-5"
          />
          Solo para {jugadores} {jugadores === 1 ? "jugador" : "jugadores"}
        </label>
        <Selector
          etiqueta="Duración máxima"
          id="sorteo-duracion"
          value={duracion ?? ""}
          onChange={(e) =>
            cambiarFiltro(() => setDuracion(e.target.value ? Number(e.target.value) : null))
          }
        >
          <option value="">Cualquiera</option>
          {OPCIONES_DURACION.map((m) => (
            <option key={m} value={m}>
              Hasta {formatearDuracion(m)}
            </option>
          ))}
        </Selector>
      </div>

      <p className="text-sm" aria-live="polite">
        {todos.length === 1 ? "1 juego" : `${todos.length} juegos`} en la mesa ·{" "}
        <strong>
          {candidatos.length === 1
            ? "1 con estos filtros"
            : `${candidatos.length} con estos filtros`}
        </strong>
      </p>

      {modo === "elegir" && (
        <Selector
          etiqueta="Juego"
          id="elegir-juego"
          value={elegido?.id ?? ""}
          disabled={candidatos.length === 0}
          onChange={(e) => setElegido(candidatos.find((c) => c.id === e.target.value) ?? null)}
        >
          <option value="">
            {candidatos.length === 0 ? "Ningún juego con estos filtros" : "Elegí un juego"}
          </option>
          {candidatos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} · {unirNombres(c.duenos.map((d) => d.nombre))}
            </option>
          ))}
        </Selector>
      )}

      <div
        aria-live="polite"
        className="flex min-h-40 flex-col items-center justify-center gap-3 text-center"
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
              className="aspect-square w-28 rounded-2xl"
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
              ? "Ningún juego de la mesa pasa estos filtros."
              : modo === "elegir"
                ? "Elegí un juego de la lista."
                : "Tocá Sortear y que decida el azar."}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        {modo === "sortear" && (
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
        )}
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
