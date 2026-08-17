import type { QueryClient } from "@tanstack/react-query";

import { createAppointment, setAppointmentStatus } from "@/lib/appointments.functions";
import { registerPayment } from "@/lib/finance.functions";
import {
  contarIntento,
  leerCola,
  marcarFallido,
  pendientes,
  quitarDeCola,
  type ItemCola,
  type OperacionKind,
} from "@/lib/offline-queue";

/**
 * Cómo se reproduce cada operación al recuperar conexión.
 *
 * El payload se pasa TAL CUAL se capturó. Nada de recalcular montos, fechas
 * ni nada acá: si algo hay que derivar, se derivó en la captura y viajó
 * dentro del payload.
 */
const despachadores: Record<OperacionKind, (payload: never) => Promise<unknown>> = {
  "crear-cita": (payload) => createAppointment({ data: payload }),
  "registrar-pago": (payload) => registerPayment({ data: payload }),
  "cambiar-estado-cita": (payload) => setAppointmentStatus({ data: payload }),
};

/**
 * Un fallo de red se reintenta; uno de validación o permisos, no.
 *
 * Distinguirlos importa: reintentar para siempre un pago que el servidor
 * rechaza por regla de negocio deja al equipo esperando una sincronización
 * que nunca va a pasar, sin enterarse de que hay algo que revisar.
 */
function esFalloDeRed(error: unknown) {
  if (error instanceof TypeError) return true; // fetch caído
  const mensaje = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    mensaje.includes("failed to fetch") ||
    mensaje.includes("networkerror") ||
    mensaje.includes("load failed") ||
    mensaje.includes("network request failed")
  );
}

/** Claves a refrescar después de sincronizar, por tipo de operación. */
const invalidaciones: Record<OperacionKind, string[]> = {
  "crear-cita": ["appointments"],
  "registrar-pago": ["payments", "patient", "patients", "finance-summary"],
  "cambiar-estado-cita": ["appointments"],
};

let sincronizando = false;

/**
 * Despacha la cola en orden de captura (FIFO).
 *
 * Si algo falla por red, PARA — no sigue con el resto. Mantener el orden
 * importa: un pago y el cambio de estado de la misma cita tienen que llegar
 * como se hicieron. Además, si se cayó la red, el siguiente también va a
 * fallar; seguir intentando solo suma ruido.
 */
export async function sincronizarCola(queryClient: QueryClient, userId: string) {
  if (sincronizando) return { sincronizados: 0, corte: true };
  sincronizando = true;

  let sincronizados = 0;
  let corte = false;
  const kindsTocados = new Set<OperacionKind>();

  try {
    const cola = pendientes(await leerCola()).filter((i) => i.userId === userId);

    for (const item of cola) {
      try {
        await contarIntento(item.localId);
        await (despachadores[item.kind] as (p: unknown) => Promise<unknown>)(item.payload);
        await quitarDeCola(item.localId);
        kindsTocados.add(item.kind);
        sincronizados += 1;
      } catch (error) {
        if (esFalloDeRed(error)) {
          corte = true;
          break;
        }
        // El servidor lo rechazó por una razón real. Queda visible para que
        // alguien lo mire, en vez de desaparecer o reintentarse eternamente.
        await marcarFallido(
          item.localId,
          error instanceof Error ? error.message : "Error desconocido",
        );
      }
    }
  } finally {
    sincronizando = false;
  }

  for (const kind of kindsTocados) {
    for (const clave of invalidaciones[kind]) {
      queryClient.invalidateQueries({ queryKey: [clave] });
    }
  }

  return { sincronizados, corte };
}

/** Texto corto para la lista de pendientes. */
export function describirItem(item: ItemCola) {
  switch (item.kind) {
    case "crear-cita":
      return "Cita nueva";
    case "registrar-pago":
      return "Cobro registrado";
    case "cambiar-estado-cita":
      return "Cambio de estado de una cita";
  }
}
