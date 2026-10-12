"use client";

import { Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import {
  actualizarCatalogo,
  agregarAlCatalogo,
  quitarDelCatalogo,
  type EstadoCatalogo,
} from "@/app/(app)/juegos/[id]/actions";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Selector } from "@/components/ui/campo";
import { Hoja } from "@/components/ui/hoja";

type Catalogo = { puntuacion: number | null; notas: string | null };

/** "En tu catálogo": puntuación y notas, editarlas, quitar o agregar el juego. */
export function AccionesCatalogo({
  juegoId,
  catalogo,
  esManualPropio,
}: {
  juegoId: string;
  catalogo: Catalogo | null;
  esManualPropio: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!catalogo) {
    return (
      <section className="border-borde bg-superficie space-y-3 rounded-2xl border p-4">
        <p className="text-texto-suave text-sm">Este juego no está en tu catálogo.</p>
        <Boton
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await agregarAlCatalogo(juegoId);
              setError(r.ok ? null : r.error);
            })
          }
        >
          {pendiente ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Plus aria-hidden className="size-4" />
          )}
          Agregar a mi catálogo
        </Boton>
        {error && <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>}
      </section>
    );
  }

  return (
    <section className="border-borde bg-superficie space-y-3 rounded-2xl border p-4 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">En tu catálogo</h2>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-primario -mr-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold"
        >
          <Pencil aria-hidden className="size-4" /> Editar
        </button>
      </div>
      <p className="flex items-center gap-1.5 text-sm">
        <Star
          aria-hidden
          className={`size-4 ${catalogo.puntuacion ? "fill-amber-400 text-amber-400" : "text-texto-suave"}`}
        />
        {catalogo.puntuacion ? (
          <>
            Tu puntuación: <strong>{catalogo.puntuacion}/10</strong>
          </>
        ) : (
          <span className="text-texto-suave">Sin puntuar</span>
        )}
      </p>
      {catalogo.notas ? (
        <p className="text-sm whitespace-pre-line">{catalogo.notas}</p>
      ) : (
        <p className="text-texto-suave text-sm">Sin notas.</p>
      )}
      <button
        type="button"
        onClick={() => setQuitando(true)}
        className="text-texto-suave inline-flex min-h-11 items-center gap-1.5 text-sm hover:text-red-700 dark:hover:text-red-400"
      >
        <Trash2 aria-hidden className="size-4" /> Quitar de mi catálogo
      </button>

      <Hoja abierta={editando} onCerrar={() => setEditando(false)} titulo="Tu puntuación y notas">
        {editando && (
          <FormularioCatalogo
            juegoId={juegoId}
            catalogo={catalogo}
            onListo={() => setEditando(false)}
          />
        )}
      </Hoja>

      <Hoja abierta={quitando} onCerrar={() => setQuitando(false)} titulo="¿Quitar de tu catálogo?">
        <div className="space-y-4">
          <p className="text-sm">
            {esManualPropio
              ? "Como este juego lo cargaste vos, también se borran sus datos, su foto y tus resúmenes. No se puede deshacer."
              : "Tus resúmenes de este juego se conservan por si lo volvés a agregar."}
          </p>
          {error && <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>}
          <div className="flex gap-3">
            <Boton variante="secundario" className="flex-1" onClick={() => setQuitando(false)}>
              Cancelar
            </Boton>
            <Boton
              className="flex-1 bg-red-700 hover:bg-red-800"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await quitarDelCatalogo(juegoId);
                  // Si sale bien, la acción redirige al catálogo.
                  if (!r.ok) setError(r.error);
                })
              }
            >
              {pendiente && <Loader2 aria-hidden className="size-4 animate-spin" />}
              Quitar
            </Boton>
          </div>
        </div>
      </Hoja>
    </section>
  );
}

function FormularioCatalogo({
  juegoId,
  catalogo,
  onListo,
}: {
  juegoId: string;
  catalogo: Catalogo;
  onListo: () => void;
}) {
  const [puntuacion, setPuntuacion] = useState(
    catalogo.puntuacion ? String(catalogo.puntuacion) : "",
  );
  const [notas, setNotas] = useState(catalogo.notas ?? "");
  const [estado, accion, guardando] = useActionState(
    async (previo: EstadoCatalogo | null, fd: FormData) => {
      const r = await actualizarCatalogo(juegoId, previo, fd);
      if (r.ok) onListo();
      return r;
    },
    null,
  );
  const errores = estado && !estado.ok ? (estado.errores ?? {}) : {};

  return (
    <form action={accion} className="space-y-4" noValidate>
      <Selector
        etiqueta="Tu puntuación"
        id="editar-puntuacion"
        name="puntuacion"
        value={puntuacion}
        onChange={(e) => setPuntuacion(e.target.value)}
        error={errores.puntuacion}
      >
        <option value="">Sin puntuar</option>
        {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Selector>
      <AreaTexto
        etiqueta="Notas"
        id="editar-notas"
        name="notas"
        rows={4}
        maxLength={5000}
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        error={errores.notas}
      />
      <p aria-live="polite" className="text-sm font-medium text-red-700 dark:text-red-400">
        {estado && !estado.ok && !estado.errores ? estado.error : null}
      </p>
      <Boton type="submit" className="w-full" disabled={guardando}>
        {guardando && <Loader2 aria-hidden className="size-4 animate-spin" />}
        Guardar
      </Boton>
    </form>
  );
}
