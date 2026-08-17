import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** Igual que el cache persistido en disco (ver `lib/offline-cache.ts`). */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // El default ("online") deja las queries en pausa y SIN datos apenas
        // el browser se cree desconectado. "offlineFirst" entrega lo que haya
        // en cache y recién ahí intenta la red: es lo que permite que la
        // clínica siga viendo la agenda durante un corte.
        networkMode: "offlineFirst",
        // El default de 5 min descartaría de memoria justo lo que acabamos de
        // guardar en disco. Tiene que durar al menos lo mismo que el cache
        // persistido, o al volver de un corte largo no queda nada que mostrar.
        gcTime: WEEK_MS,
        // Sin red, 3 reintentos con backoff exponencial tardan ~7s en darse
        // por vencidos: el usuario mira una pantalla cargando sin saber por
        // qué. Con 1 el fallo se ve enseguida y el banner aparece a tiempo.
        retry: 1,
      },
      mutations: {
        // Todavía no hay cola de escritura (llega en la Tanda 3). Hasta
        // entonces queremos que una mutación sin red FALLE, no que espere.
        // Ojo con "online" acá: React Query no la falla, la deja en pausa
        // hasta que vuelva la red — el botón se queda girando para siempre y
        // el usuario no sabe si guardó. "always" la deja intentar y fallar.
        networkMode: "always",
        retry: 0,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
