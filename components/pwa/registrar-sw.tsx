"use client";

import { useEffect } from "react";

/** Registra el service worker una vez cargada la página. */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Tras `load` para no competir con la carga inicial por ancho de banda.
    const registrar = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* si el navegador lo bloquea, la app funciona igual, solo sin offline */
      });
    };
    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });
  }, []);

  return null;
}
