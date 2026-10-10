import { describe, expect, it } from "vitest";

import { fuentesSupabaseParaCsp } from "@/lib/csp";

describe("CSP: origen de Supabase", () => {
  it("acota connect-src al proyecto configurado", () => {
    expect(fuentesSupabaseParaCsp("https://abcd1234.supabase.co")).toEqual({
      https: "https://abcd1234.supabase.co",
      wss: "wss://abcd1234.supabase.co",
    });
  });

  it("ignora path y barra final", () => {
    expect(fuentesSupabaseParaCsp("https://abcd1234.supabase.co/rest/v1/").https).toBe(
      "https://abcd1234.supabase.co",
    );
  });

  it("sin variable o con un valor roto cae al comodín en vez de dejar la app sin base", () => {
    const comodin = { https: "https://*.supabase.co", wss: "wss://*.supabase.co" };
    expect(fuentesSupabaseParaCsp(undefined)).toEqual(comodin);
    expect(fuentesSupabaseParaCsp("no es una url")).toEqual(comodin);
  });
});
