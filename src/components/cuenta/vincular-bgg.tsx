"use client";

import { CircleCheck, Download, Link2, Loader2, Unlink } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  desvincularBgg,
  importarTandaBgg,
  leerColeccionBgg,
  terminarImportacionBgg,
  vincularBgg,
  type EstadoVincularBgg,
} from "@/app/(app)/cuenta/actions";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { enTandas } from "@/lib/coleccion-bgg/planificar";
import { formatearFecha } from "@/lib/partidas/resultado";

type Progreso =
  | { etapa: "leyendo" }
  | { etapa: "agregando"; hechos: number; total: number }
  | {
      etapa: "listo";
      juegos: number;
      expansiones: number;
      yaEstaban: number;
      sinDatos: number;
    };

/** Cuenta → BoardGameGeek: vincular el usuario y traer la colección al estante. */
export function VincularBgg({
  usuario,
  importadoEn,
}: {
  usuario: string | null;
  importadoEn: string | null;
}) {
  if (!usuario) return <FormularioVincular />;
  return <ColeccionBgg usuario={usuario} importadoEn={importadoEn} />;
}

function FormularioVincular() {
  const [usuario, setUsuario] = useState("");
  const [estado, accion, guardando] = useActionState(
    (previo: EstadoVincularBgg, fd: FormData) => vincularBgg(previo, fd),
    null,
  );
  return (
    <form action={accion} className="space-y-3" noValidate>
      <p className="text-texto-suave text-sm">
        Si ya cargaste tus juegos en BoardGameGeek, vinculá tu usuario y traelos a tu estante. Solo
        se lee tu colección pública: no hace falta tu contraseña.
      </p>
      <Campo
        etiqueta="Tu usuario de BGG"
        id="usuario-bgg"
        name="usuario"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={50}
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
        error={estado?.ok === false ? estado.errores?.usuario : undefined}
      />
      <p
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {estado?.ok === false && !estado.errores ? estado.error : null}
      </p>
      <Boton type="submit" disabled={guardando || usuario.trim() === ""}>
        {guardando ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <Link2 aria-hidden className="size-4" />
        )}
        Vincular
      </Boton>
    </form>
  );
}

function ColeccionBgg({ usuario, importadoEn }: { usuario: string; importadoEn: string | null }) {
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desvinculando, iniciarDesvincular] = useTransition();
  const importando = progreso !== null && progreso.etapa !== "listo";

  async function importar() {
    setError(null);
    setProgreso({ etapa: "leyendo" });
    const leido = await leerColeccionBgg();
    if (!leido.ok) {
      setError(leido.error);
      setProgreso(null);
      return;
    }
    const { nuevos, yaEstaban } = leido.data;
    let agregados = 0;
    let sinDatos = 0;
    let hechos = 0;
    setProgreso({ etapa: "agregando", hechos: 0, total: nuevos.length });
    for (const tanda of enTandas(nuevos)) {
      const r = await importarTandaBgg(
        tanda.map(({ bgg_id, puntuacion }) => ({ bgg_id, puntuacion })),
      );
      if (!r.ok) {
        setError(
          `${r.error}${agregados > 0 ? ` Ya se agregaron ${agregados}: volvé a tocar "Traer mis juegos" para seguir.` : ""}`,
        );
        setProgreso(null);
        await terminarImportacionBgg();
        return;
      }
      agregados += r.data.agregados;
      sinDatos += r.data.sinDatos;
      hechos += tanda.length;
      setProgreso({ etapa: "agregando", hechos, total: nuevos.length });
    }
    const expansiones = nuevos.filter((n) => n.es_expansion).length;
    setProgreso({
      etapa: "listo",
      juegos: Math.max(0, agregados - expansiones),
      expansiones: Math.min(expansiones, agregados),
      yaEstaban,
      sinDatos,
    });
    await terminarImportacionBgg();
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm">
        <CircleCheck aria-hidden className="text-primario size-5 shrink-0" />
        <span>
          Vinculada con <strong>{usuario}</strong>
          {importadoEn && (
            <span className="text-texto-suave">
              {" "}
              · última importación: {formatearFecha(importadoEn)}
            </span>
          )}
        </span>
      </p>
      <p className="text-texto-suave text-sm">
        Trae los juegos que marcaste como “Own” en BGG, con tu puntuación de allá. Las expansiones
        quedan adentro de su juego. Lo que ya está en tu estante no se toca, y nada se quita.
      </p>

      <div aria-live="polite" className="text-sm empty:hidden">
        {progreso?.etapa === "leyendo" && (
          <p className="flex items-center gap-2">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Leyendo tu colección de BGG…
          </p>
        )}
        {progreso?.etapa === "agregando" && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-2">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Agregando {progreso.hechos} de {progreso.total}…
            </p>
            <progress
              value={progreso.hechos}
              max={Math.max(1, progreso.total)}
              aria-label="Progreso de la importación"
              className="accent-primario h-2 w-full"
            />
          </div>
        )}
        {progreso?.etapa === "listo" && <Resumen {...progreso} />}
        {error && <p className="font-medium text-red-700 dark:text-red-400">{error}</p>}
      </div>

      <div className="flex flex-wrap gap-3">
        <Boton onClick={importar} disabled={importando || desvinculando}>
          {importando ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Download aria-hidden className="size-4" />
          )}
          Traer mis juegos
        </Boton>
        <Boton
          variante="secundario"
          disabled={importando || desvinculando}
          onClick={() =>
            iniciarDesvincular(async () => {
              const r = await desvincularBgg();
              if (!r.ok) setError(r.error);
            })
          }
        >
          {desvinculando ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Unlink aria-hidden className="size-4" />
          )}
          Desvincular
        </Boton>
      </div>
    </div>
  );
}

function Resumen({
  juegos,
  expansiones,
  yaEstaban,
  sinDatos,
}: {
  juegos: number;
  expansiones: number;
  yaEstaban: number;
  sinDatos: number;
}) {
  const partes = [
    juegos > 0 && (juegos === 1 ? "1 juego" : `${juegos} juegos`),
    expansiones > 0 && (expansiones === 1 ? "1 expansión" : `${expansiones} expansiones`),
  ].filter(Boolean);
  return (
    <div className="bg-primario/10 space-y-1 rounded-2xl p-3">
      <p className="font-semibold">
        {partes.length > 0
          ? `¡Listo! Agregaste ${partes.join(" y ")}.`
          : "Ya tenías todos tus juegos de BGG."}
      </p>
      {yaEstaban > 0 && (
        <p className="text-texto-suave">
          {yaEstaban === 1 ? "1 ya estaba" : `${yaEstaban} ya estaban`} en tu estante.
        </p>
      )}
      {sinDatos > 0 && (
        <p className="text-texto-suave">
          {sinDatos === 1
            ? "1 juego no se pudo traer (BGG no devolvió sus datos)."
            : `${sinDatos} juegos no se pudieron traer (BGG no devolvió sus datos).`}
        </p>
      )}
      {partes.length > 0 && (
        <Link
          href="/catalogo"
          className="text-primario inline-flex min-h-11 items-center font-bold"
        >
          Ver tu estante
        </Link>
      )}
    </div>
  );
}
