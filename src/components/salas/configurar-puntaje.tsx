"use client";

import { Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { configurarPuntaje } from "@/app/sala/[codigo]/actions";
import { Boton } from "@/components/ui/boton";
import { AreaTexto } from "@/components/ui/campo";
import { leerCategorias, type ConfigPuntaje, type TipoPuntaje } from "@/lib/salas/tipos";

const OPCIONES: { tipo: TipoPuntaje; titulo: string; detalle: string }[] = [
  { tipo: "total", titulo: "Total", detalle: "Cada uno anota su puntaje total." },
  {
    tipo: "rondas",
    titulo: "Por rondas",
    detalle: "Una fila por ronda; el total se suma solo. Se agregan rondas mientras juegan.",
  },
  {
    tipo: "categorias",
    titulo: "Hoja de puntuación",
    detalle: "Categorías fijas (como en 7 Wonders o Wingspan) y el total se suma solo.",
  },
];

/** Para el anfitrión: cómo se anota en la sala (antes de empezar). */
export function ConfigurarPuntaje({
  partidaId,
  config,
  juegoId,
  hojaGuardada,
  hayPuntos,
  onListo,
}: {
  partidaId: string;
  config: ConfigPuntaje;
  /** Juego de la sala, si el anfitrión puede guardarle una hoja. */
  juegoId: string | null;
  hojaGuardada: string[] | null;
  hayPuntos: boolean;
  onListo: () => void;
}) {
  const [tipo, setTipo] = useState<TipoPuntaje>(config.tipo_puntaje as TipoPuntaje);
  const [texto, setTexto] = useState(
    (config.categorias.length ? config.categorias : (hojaGuardada ?? [])).join("\n"),
  );
  const [guardar, setGuardar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  const categorias = leerCategorias(texto);

  if (hayPuntos) {
    return (
      <p className="text-sm">
        Ya hay puntos cargados. La forma de anotar se elige antes de empezar; para cambiarla, poné
        los puntos en cero o creá otra sala.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">¿Cómo anotan?</legend>
        {OPCIONES.map((o) => (
          <label
            key={o.tipo}
            className="border-borde has-checked:border-primario has-checked:bg-primario/5 flex cursor-pointer gap-3 rounded-xl border p-3"
          >
            <input
              type="radio"
              name="tipo-puntaje"
              checked={tipo === o.tipo}
              onChange={() => setTipo(o.tipo)}
              className="accent-primario mt-0.5 size-5"
            />
            <span>
              <span className="block text-sm font-semibold">{o.titulo}</span>
              <span className="text-texto-suave block text-xs">{o.detalle}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {tipo === "categorias" && (
        <div className="space-y-3">
          <AreaTexto
            etiqueta="Categorías"
            id="categorias"
            rows={6}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"Militar\nTesoro\nMaravilla\nCiencia"}
            ayuda={`Una por línea, hasta 20. ${
              categorias.length === 1 ? "1 categoría" : `${categorias.length} categorías`
            }.`}
          />
          {juegoId && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={guardar}
                onChange={(e) => setGuardar(e.target.checked)}
                className="accent-primario size-5"
              />
              Guardar esta hoja para la próxima vez que jueguen este juego
            </label>
          )}
        </div>
      )}

      <p
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {error}
      </p>
      <Boton
        className="w-full"
        disabled={guardando || (tipo === "categorias" && categorias.length === 0)}
        onClick={() =>
          iniciar(async () => {
            const r = await configurarPuntaje(partidaId, {
              tipo,
              categorias: tipo === "categorias" ? categorias : [],
              guardarPara: tipo === "categorias" && guardar ? juegoId : null,
            });
            if (r.ok) onListo();
            else setError(r.error);
          })
        }
      >
        {guardando ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <Check aria-hidden className="size-4" />
        )}
        Listo
      </Boton>
    </div>
  );
}
