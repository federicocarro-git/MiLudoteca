import type { ComponentProps } from "react";

// Input con etiqueta. text-base evita que iOS haga zoom al enfocar.
export function Campo({
  etiqueta,
  id,
  className = "",
  ...props
}: ComponentProps<"input"> & { etiqueta: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={id}
        className={`border-borde bg-superficie placeholder:text-texto-suave/70 focus-visible:outline-primario block min-h-11 w-full rounded-xl border px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 ${className}`}
        {...props}
      />
    </div>
  );
}
