import { timingSafeEqual } from "node:crypto";

/**
 * Compara el header `Authorization` de los crons con `Bearer ${CRON_SECRET}`
 * en tiempo constante (auditoría 10-oct-2026). Con `!==` la comparación corta
 * en el primer carácter distinto y, en teoría, deja medir el secreto de a un
 * carácter. El largo distinto se descarta antes: `timingSafeEqual` exige
 * buffers del mismo tamaño, y el largo del secreto no es lo que se protege.
 */
export function cronAutorizado(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const recibido = Buffer.from(header, "utf8");
  const esperado = Buffer.from(`Bearer ${secret}`, "utf8");
  if (recibido.length !== esperado.length) return false;
  return timingSafeEqual(recibido, esperado);
}
