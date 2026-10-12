"use client";

import { useEffect, useState } from "react";

/** Devuelve `valor` recién cuando dejó de cambiar durante `ms`. */
export function useDebounce<T>(valor: T, ms = 300): T {
  const [demorado, setDemorado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDemorado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return demorado;
}
