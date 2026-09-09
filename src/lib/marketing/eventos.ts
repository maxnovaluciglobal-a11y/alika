// src/lib/marketing/eventos.ts
//
// Helper de cliente para el embudo mínimo propio (ver src/routes/api.ev.ts).
type NombreEvento = "calculadora_vista" | "calculadora_usada" | "lead_enviado" | "cta_click";

/** Envía un evento sin bloquear ni romper nunca la página. Sin cookies:
 *  el sessionHash vive sólo en memoria mientras dura la pestaña. */
let sessionHash: string | null = null;

function hashDeSesion(): string {
  if (!sessionHash) {
    sessionHash = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  }
  return sessionHash;
}

export function registrarEvento(
  name: NombreEvento,
  props?: Record<string, string | boolean>,
): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/ev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, props, sessionHash: hashDeSesion() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Nunca romper la página por telemetría.
  }
}
