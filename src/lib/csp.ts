/**
 * Origen del proyecto de Supabase para la CSP (auditoría 10-oct-2026): con
 * `https://*.supabase.co` cualquier proyecto de Supabase —incluido uno de un
 * atacante— era destino válido para un `fetch` inyectado. Se acota al host
 * configurado; si la variable falta o no parsea, se mantiene el comodín para
 * no dejar la app sin base.
 */
export function fuentesSupabaseParaCsp(url: string | undefined): {
  https: string;
  wss: string;
} {
  try {
    if (url) {
      const { host, protocol } = new URL(url);
      if (protocol === "https:") return { https: `https://${host}`, wss: `wss://${host}` };
      // Supabase local (http://127.0.0.1:54321) en desarrollo.
      if (protocol === "http:") return { https: `http://${host}`, wss: `ws://${host}` };
    }
  } catch {
    // cae al comodín
  }
  return { https: "https://*.supabase.co", wss: "wss://*.supabase.co" };
}
