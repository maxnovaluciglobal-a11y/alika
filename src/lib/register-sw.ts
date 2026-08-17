/**
 * Registra el service worker (`public/sw.js`).
 *
 * Sin esto, recargar la página sin internet da pantalla en blanco: la app es
 * SSR y el pedido del documento al servidor falla. El SW responde con el
 * último shell que sí cargó, la app hidrata del lado del cliente y lee los
 * datos del cache persistido en IndexedDB.
 *
 * Solo en producción: en dev el SW se pelea con el HMR de Vite (sirve chunks
 * viejos y hace parecer que un cambio "no se aplicó").
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      // Que falle el registro no puede tumbar la app: sin SW simplemente no
      // hay respaldo offline, todo lo demás sigue funcionando igual.
      console.warn("[sw] no se pudo registrar", error);
    });
  });
}
