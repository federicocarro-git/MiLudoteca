import type { ComponentProps, ReactNode } from "react";

const ESTILO_CONTROL =
  "border-borde bg-superficie placeholder:text-texto-suave/70 focus-visible:outline-primario block w-full rounded-xl border px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 aria-[invalid=true]:border-red-600";

type PropsComunes = { etiqueta: string; id: string; error?: string; ayuda?: ReactNode };

function Envoltorio({
  etiqueta,
  id,
  error,
  ayuda,
  children,
}: PropsComunes & { children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {etiqueta}
      </label>
      {children}
      {ayuda && !error && (
        <p id={`${id}-ayuda`} className="text-texto-suave text-xs">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, ayuda?: ReactNode) {
  return error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;
}

// Input con etiqueta. text-base evita que iOS haga zoom al enfocar.
export function Campo({
  etiqueta,
  id,
  error,
  ayuda,
  className = "",
  ...props
}: ComponentProps<"input"> & PropsComunes) {
  return (
    <Envoltorio etiqueta={etiqueta} id={id} error={error} ayuda={ayuda}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, ayuda)}
        className={`${ESTILO_CONTROL} min-h-11 ${className}`}
        {...props}
      />
    </Envoltorio>
  );
}

export function AreaTexto({
  etiqueta,
  id,
  error,
  ayuda,
  className = "",
  ...props
}: ComponentProps<"textarea"> & PropsComunes) {
  return (
    <Envoltorio etiqueta={etiqueta} id={id} error={error} ayuda={ayuda}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, ayuda)}
        className={`${ESTILO_CONTROL} min-h-24 py-2.5 ${className}`}
        {...props}
      />
    </Envoltorio>
  );
}

export function Selector({
  etiqueta,
  id,
  error,
  ayuda,
  className = "",
  children,
  ...props
}: ComponentProps<"select"> & PropsComunes) {
  return (
    <Envoltorio etiqueta={etiqueta} id={id} error={error} ayuda={ayuda}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, ayuda)}
        className={`${ESTILO_CONTROL} min-h-11 ${className}`}
        {...props}
      >
        {children}
      </select>
    </Envoltorio>
  );
}
