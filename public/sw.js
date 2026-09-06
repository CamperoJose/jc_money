/* Service worker de MyMoney.
 *
 * Criterio de diseño, importante en una app de dinero: NUNCA se sirve contenido
 * financiero cacheado como si fuera actual. Un saldo viejo mostrado sin avisar
 * es peor que no mostrar nada. Por eso:
 *   - Los archivos estáticos (JS, CSS, iconos) se cachean: no cambian nunca sin
 *     cambiar de nombre y son lo que hace lenta la primera carga.
 *   - Las navegaciones van SIEMPRE a la red; si no hay conexión, se muestra una
 *     página de "sin conexión" explícita, no una copia vieja de la pantalla.
 *   - Las peticiones a /api no se cachean jamás.
 */
const VERSION = "v1";
const CACHE_ESTATICO = `mymoney-estatico-${VERSION}`;
const PAGINA_SIN_CONEXION = "/sin-conexion";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_ESTATICO)
      .then((cache) => cache.addAll([PAGINA_SIN_CONEXION, "/icon-192.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => c !== CACHE_ESTATICO).map((c) => caches.delete(c)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Datos: siempre a la red, sin copia local.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Navegaciones: red primero, y si no hay conexión, página de aviso.
  if (req.mode === "navigate") {
    evento.respondWith(
      fetch(req).catch(() => caches.match(PAGINA_SIN_CONEXION))
    );
    return;
  }

  // Estáticos con hash en el nombre: cache primero, y se guarda al vuelo.
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    evento.respondWith(
      caches.match(req).then(
        (guardado) =>
          guardado ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copia = res.clone();
              caches.open(CACHE_ESTATICO).then((c) => c.put(req, copia));
            }
            return res;
          })
      )
    );
  }
});
