"use client";

import { useEffect } from "react";

// Solo en producción: en desarrollo el service worker cachearía assets
// viejos y complicaría el hot reload.
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.error("No se pudo registrar el service worker", error));
  }, []);

  return null;
}
