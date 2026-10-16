"use client";

import { Info, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { guardarJuego, type EstadoGuardarJuego } from "@/app/(app)/juegos/nuevo/actions";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Selector } from "@/components/ui/campo";
import { Chip } from "@/components/ui/chip";
import { TIPOS } from "@/lib/game-data/tipos";
import type { DatosJuego, ProviderId } from "@/lib/game-data/types";
import { mismosDatos } from "@/lib/juegos/comparar";
import { VACIO, valoresDesde, type ValoresJuego } from "@/lib/juegos/valores-formulario";
import { BuscadorJuegos, NOMBRE_ORIGEN } from "./buscador-juegos";
import { SelectorImagen } from "./selector-imagen";

function aDatos(v: ValoresJuego): Partial<DatosJuego> {
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  return {
    nombre: v.nombre,
    imagen_url: v.imagen_url,
    jugadores_min: num(v.jugadores_min),
    jugadores_max: num(v.jugadores_max),
    duracion_min: num(v.duracion_min),
    complejidad: num(v.complejidad),
    anio: num(v.anio),
    descripcion: v.descripcion,
    tipos: v.tipos,
  };
}

type AccionGuardar = (previo: EstadoGuardarJuego, fd: FormData) => Promise<EstadoGuardarJuego>;

/**
 * Formulario de un juego. Sin `inicial` es el alta (con búsqueda si hay
 * provider); con `inicial` y `accion` se usa para editar un juego propio.
 */
export function FormularioJuego({
  origen,
  inicial,
  bggIdInicial = null,
  accion: accionGuardar = guardarJuego,
  textoBoton = "Guardar en mi estante",
}: {
  origen: ProviderId | null;
  inicial?: ValoresJuego;
  bggIdInicial?: number | null;
  accion?: AccionGuardar;
  textoBoton?: string;
}) {
  const [valores, setValores] = useState<ValoresJuego>(inicial ?? VACIO);
  // Datos tal como vinieron de la búsqueda (para saber si se editaron).
  const [original, setOriginal] = useState<DatosJuego | null>(null);
  const [bggId, setBggId] = useState<number | null>(bggIdInicial);
  const [estado, accion, guardando] = useActionState(accionGuardar, null);
  const errores = estado?.errores ?? {};

  const cambiar =
    (campo: keyof ValoresJuego) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValores((v) => ({ ...v, [campo]: e.target.value }));

  function alternarTipo(tipo: string) {
    setValores((v) => ({
      ...v,
      tipos: v.tipos.includes(tipo) ? v.tipos.filter((t) => t !== tipo) : [...v.tipos, tipo],
    }));
  }

  function elegir(datos: DatosJuego) {
    setValores((v) => valoresDesde(datos, v));
    setOriginal(datos);
    setBggId(datos.bgg_id);
  }

  function empezarDeCero() {
    setValores((v) => ({ ...VACIO, puntuacion: v.puntuacion, notas: v.notas }));
    setOriginal(null);
    setBggId(null);
  }

  const editado = original !== null && !mismosDatos(original, aDatos(valores));

  return (
    <div className="space-y-4">
      {origen && <BuscadorJuegos origen={origen} onElegir={elegir} />}

      <form action={accion} className="space-y-4" noValidate>
        {original && (
          <div role="status" className="bg-primario/10 flex gap-3 rounded-2xl p-4 text-sm">
            <Info aria-hidden className="text-primario mt-0.5 size-5 shrink-0" />
            <div className="space-y-2">
              <p>
                Completamos los datos de <strong>{original.nombre}</strong> desde{" "}
                {origen ? NOMBRE_ORIGEN[origen] : "la búsqueda"}. Revisalos y cambiá lo que quieras.
              </p>
              {editado && original.bgg_id && (
                <p className="text-texto-suave">
                  Como los modificaste, se van a guardar como tu propia versión del juego.
                </p>
              )}
              <button
                type="button"
                onClick={empezarDeCero}
                className="text-primario inline-flex min-h-11 items-center gap-1.5 font-semibold"
              >
                <RotateCcw aria-hidden className="size-4" /> Empezar de cero
              </button>
            </div>
          </div>
        )}

        <input type="hidden" name="bgg_id" value={bggId ?? ""} />
        <input type="hidden" name="imagen_url" value={valores.imagen_url ?? ""} />
        {valores.tipos.map((t) => (
          <input key={t} type="hidden" name="tipos" value={t} />
        ))}

        <section className="border-borde bg-superficie relieve space-y-4 rounded-2xl border p-4">
          <h2 className="font-semibold">Datos del juego</h2>
          <Campo
            etiqueta="Nombre"
            id="nombre"
            name="nombre"
            required
            maxLength={200}
            autoComplete="off"
            value={valores.nombre}
            onChange={cambiar("nombre")}
            error={errores.nombre}
          />
          <SelectorImagen
            url={valores.imagen_url}
            nombre={valores.nombre}
            onCambio={(url) => setValores((v) => ({ ...v, imagen_url: url }))}
            error={errores.imagen_url}
          />
          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta="Jugadores mín."
              id="jugadores_min"
              name="jugadores_min"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={valores.jugadores_min}
              onChange={cambiar("jugadores_min")}
              error={errores.jugadores_min}
            />
            <Campo
              etiqueta="Jugadores máx."
              id="jugadores_max"
              name="jugadores_max"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={valores.jugadores_max}
              onChange={cambiar("jugadores_max")}
              error={errores.jugadores_max}
            />
            <Campo
              etiqueta="Duración (min)"
              id="duracion_min"
              name="duracion_min"
              type="number"
              inputMode="numeric"
              min={1}
              value={valores.duracion_min}
              onChange={cambiar("duracion_min")}
              error={errores.duracion_min}
            />
            <Campo
              etiqueta="Año"
              id="anio"
              name="anio"
              type="number"
              inputMode="numeric"
              value={valores.anio}
              onChange={cambiar("anio")}
              error={errores.anio}
            />
          </div>
          <Campo
            etiqueta="Complejidad (1 a 5)"
            id="complejidad"
            name="complejidad"
            type="number"
            inputMode="decimal"
            step={0.1}
            min={1}
            max={5}
            value={valores.complejidad}
            onChange={cambiar("complejidad")}
            error={errores.complejidad}
            ayuda="1 = liviano, para cualquiera · 5 = muy pesado. Es la escala de BGG."
          />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Tipo</legend>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((tipo) => {
                const activo = valores.tipos.includes(tipo);
                return (
                  <Chip key={tipo} activo={activo} onClick={() => alternarTipo(tipo)}>
                    {tipo}
                  </Chip>
                );
              })}
            </div>
            {errores.tipos && (
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{errores.tipos}</p>
            )}
          </fieldset>

          <AreaTexto
            etiqueta="Descripción"
            id="descripcion"
            name="descripcion"
            rows={5}
            maxLength={20000}
            value={valores.descripcion}
            onChange={cambiar("descripcion")}
            error={errores.descripcion}
            ayuda="Texto libre. Separá los párrafos con una línea en blanco."
          />
        </section>

        <section className="border-borde bg-superficie relieve space-y-4 rounded-2xl border p-4">
          <h2 className="font-semibold">En tu estante</h2>
          <Selector
            etiqueta="Tu puntuación"
            id="puntuacion"
            name="puntuacion"
            value={valores.puntuacion}
            onChange={cambiar("puntuacion")}
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
            id="notas"
            name="notas"
            rows={3}
            maxLength={5000}
            placeholder="Ej.: le falta una carta, va bien con 4, prestado a Juan…"
            value={valores.notas}
            onChange={cambiar("notas")}
            error={errores.notas}
          />
        </section>

        <div aria-live="polite">
          {estado?.duplicado ? (
            <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950">
              <p className="font-medium">{estado.error}</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/juegos/${estado.duplicado.id}`}
                  className="text-primario inline-flex min-h-11 items-center font-semibold"
                >
                  Ver el que ya tengo
                </Link>
                <Boton
                  type="submit"
                  name="confirmar_duplicado"
                  value="1"
                  variante="secundario"
                  disabled={guardando}
                >
                  Agregar igual
                </Boton>
              </div>
            </div>
          ) : (
            estado?.error && (
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{estado.error}</p>
            )
          )}
        </div>

        <Boton type="submit" className="w-full" disabled={guardando}>
          {guardando && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {textoBoton}
        </Boton>
      </form>
    </div>
  );
}
