"use client";

import { Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  agregarAmigosASala,
  agregarSinCelular,
  type EstadoNombreJugador,
} from "@/app/sala/[codigo]/actions";
import { Avatar } from "@/components/amigos/avatar";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";

export type AmigoDisponible = { id: string; nombre: string };

/** Para el anfitrión: sumar amigos o a alguien que juega sin celular. */
export function AgregarJugadores({
  partidaId,
  amigos,
  onListo,
}: {
  partidaId: string;
  amigos: AmigoDisponible[];
  onListo: () => void;
}) {
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [agregando, iniciar] = useTransition();
  const [nombre, setNombre] = useState("");
  const [estado, accion, guardando] = useActionState(
    async (previo: EstadoNombreJugador, fd: FormData) => {
      const r = await agregarSinCelular(partidaId, previo, fd);
      if (r?.ok) onListo();
      return r;
    },
    null,
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="titulo-amigos-sala">
        <h3 id="titulo-amigos-sala" className="font-semibold">
          Tus amigos
        </h3>
        {amigos.length === 0 ? (
          <p className="text-texto-suave text-sm">
            No hay amigos para agregar.{" "}
            <Link href="/jugar/amigos" className="text-primario font-medium underline">
              Agregá amigos
            </Link>{" "}
            o compartiles el QR.
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {amigos.map((a) => (
                <li key={a.id}>
                  <label className="border-borde has-checked:border-primario flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border p-3">
                    <input
                      type="checkbox"
                      className="accent-primario size-5"
                      checked={elegidos.includes(a.id)}
                      onChange={(e) =>
                        setElegidos((lista) =>
                          e.target.checked ? [...lista, a.id] : lista.filter((id) => id !== a.id),
                        )
                      }
                    />
                    <Avatar nombre={a.nombre} />
                    <span className="font-medium">{a.nombre}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-texto-suave text-xs">
              Les aparece la sala en Jugar y cargan sus puntos desde su celular.
            </p>
            <p
              aria-live="polite"
              className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
            >
              {error}
            </p>
            <Boton
              disabled={elegidos.length === 0 || agregando}
              onClick={() =>
                iniciar(async () => {
                  const r = await agregarAmigosASala(partidaId, elegidos);
                  setError(r.ok ? null : r.error);
                  if (r.ok) onListo();
                })
              }
            >
              {agregando ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <UserPlus aria-hidden className="size-4" />
              )}
              Agregar {elegidos.length > 0 ? `(${elegidos.length})` : ""}
            </Boton>
          </>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="titulo-sin-celular">
        <h3 id="titulo-sin-celular" className="font-semibold">
          Alguien sin celular
        </h3>
        <form action={accion} className="space-y-3" noValidate>
          <Campo
            etiqueta="Nombre del jugador"
            id="nombre-sin-celular"
            name="nombre"
            maxLength={40}
            autoComplete="off"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            error={estado?.ok === false ? estado.errores?.nombre : undefined}
            ayuda="Le cargás vos los puntos."
          />
          <p
            aria-live="polite"
            className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
          >
            {estado?.ok === false && !estado.errores ? estado.error : null}
          </p>
          <Boton type="submit" variante="secundario" disabled={guardando}>
            {guardando && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Agregar jugador
          </Boton>
        </form>
      </section>
    </div>
  );
}
