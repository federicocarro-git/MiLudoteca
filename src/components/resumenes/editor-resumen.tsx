"use client";

import {
  Bold,
  Eye,
  Heading2,
  List,
  ListChecks,
  Loader2,
  PencilLine,
  Sparkles,
  Table,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { EstadoGuardarResumen } from "@/app/(app)/juegos/[id]/resumen/editar/actions";
import { Markdown } from "@/components/markdown";
import { Boton } from "@/components/ui/boton";
import { useAvisoCambios } from "@/hooks/use-aviso-cambios";
import { PLANTILLAS, aplicarFormato, type Formato } from "@/lib/resumenes/formato";
import {
  LIMITES_RESUMEN,
  SECCIONES_RESUMEN,
  type SeccionResumen,
  type SeccionUrl,
} from "@/lib/validations/resumen";

type Textos = Record<SeccionResumen, string>;

const TITULOS: Record<SeccionResumen, string> = {
  como_se_juega: "Cómo se juega",
  hoja_de_turno: "Hoja de turno",
};

const HERRAMIENTAS: Array<{ formato: Formato; etiqueta: string; Icono: LucideIcon }> = [
  { formato: "titulo", etiqueta: "Título", Icono: Heading2 },
  { formato: "negrita", etiqueta: "Negrita", Icono: Bold },
  { formato: "lista", etiqueta: "Lista", Icono: List },
  { formato: "checklist", etiqueta: "Checklist", Icono: ListChecks },
  { formato: "tabla", etiqueta: "Tabla", Icono: Table },
];

type Borrador = { textos: Textos; guardadoEn: string };

const normalizar = (t: string) => t.replace(/\r\n?/g, "\n").trimEnd();
const iguales = (a: Textos, b: Textos) =>
  normalizar(a.como_se_juega) === normalizar(b.como_se_juega) &&
  normalizar(a.hoja_de_turno) === normalizar(b.hoja_de_turno);

function leerBorrador(clave: string): Borrador | null {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as Borrador) : null;
  } catch {
    return null;
  }
}

function escribirBorrador(clave: string, borrador: Borrador | null) {
  try {
    if (borrador) localStorage.setItem(clave, JSON.stringify(borrador));
    else localStorage.removeItem(clave);
  } catch {
    // Sin almacenamiento (modo privado, cuota llena): el editor sigue andando.
  }
}

export function EditorResumen({
  juegoId,
  inicial,
  seccionInicial,
  accion,
}: {
  juegoId: string;
  inicial: Textos;
  seccionInicial: SeccionUrl;
  accion: (previo: EstadoGuardarResumen, fd: FormData) => Promise<EstadoGuardarResumen>;
}) {
  const claveBorrador = `miludoteca:borrador-resumen:${juegoId}`;
  const [textos, setTextos] = useState<Textos>(inicial);
  const [seccionUrl, setSeccionUrl] = useState<SeccionUrl>(seccionInicial);
  const [modo, setModo] = useState<"escribir" | "vista">("escribir");
  const [borradorPendiente, setBorradorPendiente] = useState<Borrador | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const seleccionPendiente = useRef<[number, number] | null>(null);

  const seccion = SECCIONES_RESUMEN[seccionUrl];
  const hayCambios = !iguales(textos, inicial);
  useAvisoCambios(hayCambios);

  const [estado, enviar, guardando] = useActionState(
    async (previo: EstadoGuardarResumen, fd: FormData) => {
      // Si sale bien, la acción redirige y este código no sigue: el borrador
      // se borra antes y se restaura si hubo un error.
      escribirBorrador(claveBorrador, null);
      const resultado = await accion(previo, fd);
      escribirBorrador(claveBorrador, { textos, guardadoEn: new Date().toISOString() });
      return resultado;
    },
    null,
  );

  // Al abrir: ¿hay un borrador local distinto de lo guardado?
  useEffect(() => {
    const borrador = leerBorrador(claveBorrador);
    if (borrador && !iguales(borrador.textos, inicial)) {
      queueMicrotask(() => setBorradorPendiente(borrador));
    } else if (borrador) {
      escribirBorrador(claveBorrador, null);
    }
  }, [claveBorrador, inicial]);

  // Guarda el borrador local mientras se escribe.
  useEffect(() => {
    if (borradorPendiente) return; // no pisar uno que todavía no se recuperó
    const t = setTimeout(() => {
      escribirBorrador(
        claveBorrador,
        hayCambios ? { textos, guardadoEn: new Date().toISOString() } : null,
      );
    }, 400);
    return () => clearTimeout(t);
  }, [claveBorrador, textos, hayCambios, borradorPendiente]);

  // Al ocultar o cerrar la página (cambiar de app, recargar, el sistema mata
  // la pestaña), guardar ya, sin esperar el debounce.
  const ultimo = useRef({ textos, hayCambios, pendiente: borradorPendiente !== null });
  useEffect(() => {
    ultimo.current = { textos, hayCambios, pendiente: borradorPendiente !== null };
  });
  useEffect(() => {
    const guardarYa = () => {
      const { textos: t, hayCambios: cambios, pendiente } = ultimo.current;
      if (cambios && !pendiente) {
        escribirBorrador(claveBorrador, { textos: t, guardadoEn: new Date().toISOString() });
      }
    };
    const alOcultar = () => document.visibilityState === "hidden" && guardarYa();
    window.addEventListener("pagehide", guardarYa);
    document.addEventListener("visibilitychange", alOcultar);
    return () => {
      window.removeEventListener("pagehide", guardarYa);
      document.removeEventListener("visibilitychange", alOcultar);
    };
  }, [claveBorrador]);

  // Después de aplicar un formato, restaurar la selección en el textarea.
  useEffect(() => {
    const sel = seleccionPendiente.current;
    if (!sel || !area.current) return;
    seleccionPendiente.current = null;
    area.current.focus();
    area.current.setSelectionRange(sel[0], sel[1]);
  }, [textos]);

  function cambiarTexto(valor: string) {
    setTextos((t) => ({ ...t, [seccion]: valor }));
  }

  function formatear(formato: Formato) {
    const el = area.current;
    if (!el) return;
    const r = aplicarFormato(
      { texto: textos[seccion], inicio: el.selectionStart, fin: el.selectionEnd },
      formato,
    );
    seleccionPendiente.current = [r.inicio, r.fin];
    cambiarTexto(r.texto);
  }

  function usarPlantilla() {
    seleccionPendiente.current = [0, 0];
    cambiarTexto(PLANTILLAS[seccion]);
  }

  const texto = textos[seccion];
  const limite = LIMITES_RESUMEN[seccion];
  const cercaDelLimite = texto.length > limite * 0.8;

  return (
    <form action={enviar} className="space-y-4">
      {borradorPendiente && (
        <div
          role="status"
          className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950"
        >
          <p>
            Tenés un borrador sin guardar del{" "}
            {new Date(borradorPendiente.guardadoEn).toLocaleString("es-AR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
            .
          </p>
          <div className="flex gap-3">
            <Boton
              type="button"
              onClick={() => {
                setTextos(borradorPendiente.textos);
                setBorradorPendiente(null);
              }}
            >
              Recuperar
            </Boton>
            <Boton
              type="button"
              variante="secundario"
              onClick={() => {
                escribirBorrador(claveBorrador, null);
                setBorradorPendiente(null);
              }}
            >
              Descartar
            </Boton>
          </div>
        </div>
      )}

      <input type="hidden" name="como_se_juega" value={textos.como_se_juega} />
      <input type="hidden" name="hoja_de_turno" value={textos.hoja_de_turno} />
      <input type="hidden" name="volver_a" value={seccionUrl} />

      <div
        role="tablist"
        aria-label="Sección"
        className="bg-superficie border-borde grid grid-cols-2 rounded-xl border p-1"
      >
        {(Object.keys(SECCIONES_RESUMEN) as SeccionUrl[]).map((s) => {
          const activa = s === seccionUrl;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setSeccionUrl(s)}
              className={`min-h-10 rounded-lg text-sm font-medium ${
                activa ? "bg-primario text-sobre-primario" : "text-texto-suave hover:text-texto"
              }`}
            >
              {TITULOS[SECCIONES_RESUMEN[s]]}
            </button>
          );
        })}
      </div>

      <div className="border-borde bg-superficie overflow-hidden rounded-2xl border">
        <div className="border-borde flex items-center justify-between gap-2 border-b px-2 py-1">
          <div className="flex">
            {(["escribir", "vista"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ${
                  modo === m ? "text-primario" : "text-texto-suave hover:text-texto"
                }`}
              >
                {m === "escribir" ? (
                  <PencilLine aria-hidden className="size-4" />
                ) : (
                  <Eye aria-hidden className="size-4" />
                )}
                {m === "escribir" ? "Escribir" : "Vista previa"}
              </button>
            ))}
          </div>
          {modo === "escribir" && !texto.trim() && (
            <button
              type="button"
              onClick={usarPlantilla}
              className="text-primario inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold"
            >
              <Sparkles aria-hidden className="size-4" /> Usar plantilla
            </button>
          )}
        </div>

        {modo === "escribir" ? (
          <>
            <div
              role="toolbar"
              aria-label="Formato"
              className="border-borde flex gap-1 overflow-x-auto border-b px-2 py-1"
            >
              {HERRAMIENTAS.map(({ formato, etiqueta, Icono }) => (
                <button
                  key={formato}
                  type="button"
                  title={etiqueta}
                  aria-label={etiqueta}
                  // Que el textarea no pierda la selección al tocar el botón.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => formatear(formato)}
                  className="text-texto-suave hover:bg-fondo hover:text-texto flex size-11 shrink-0 items-center justify-center rounded-lg"
                >
                  <Icono aria-hidden className="size-5" />
                </button>
              ))}
            </div>
            <label htmlFor="texto-resumen" className="sr-only">
              {TITULOS[seccion]} (markdown)
            </label>
            <textarea
              id="texto-resumen"
              ref={area}
              value={texto}
              onChange={(e) => cambiarTexto(e.target.value)}
              maxLength={limite}
              spellCheck
              placeholder={`Escribí ${TITULOS[seccion].toLowerCase()} en markdown, o usá la plantilla.`}
              className="block min-h-[55dvh] w-full resize-y bg-transparent p-3 font-mono text-base leading-relaxed outline-none"
            />
          </>
        ) : (
          <div className="min-h-[55dvh] p-4">
            {texto.trim() ? (
              <Markdown texto={texto} variante={seccion === "hoja_de_turno" ? "hoja" : "normal"} />
            ) : (
              <p className="text-texto-suave text-sm">Todavía no hay nada para mostrar.</p>
            )}
          </div>
        )}
      </div>

      <p
        className={`text-xs ${cercaDelLimite ? "font-medium text-amber-700 dark:text-amber-400" : "text-texto-suave"}`}
      >
        {cercaDelLimite
          ? `${texto.length.toLocaleString("es-AR")} de ${limite.toLocaleString("es-AR")} caracteres.`
          : "Markdown: ## título, **negrita**, - lista, - [ ] checklist, | tablas |."}
      </p>

      <div className="bg-fondo/95 sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 space-y-2 px-4 py-3 backdrop-blur">
        {estado && !estado.ok && (
          <p aria-live="polite" className="text-sm font-medium text-red-700 dark:text-red-400">
            {estado.error}
          </p>
        )}
        <div className="flex gap-3">
          <Link
            href={`/juegos/${juegoId}/${seccionUrl}`}
            className="border-borde bg-superficie hover:bg-fondo inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold"
          >
            Cancelar
          </Link>
          <Boton type="submit" className="flex-[2]" disabled={guardando || !hayCambios}>
            {guardando && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {hayCambios ? "Guardar" : "Sin cambios"}
          </Boton>
        </div>
      </div>
    </form>
  );
}
