// Regresión de la migración 20261007000000: ninguna función SECURITY DEFINER
// que PostgREST expone por /rest/v1/rpc puede ser ejecutada por `anon`.
//
// Por qué un test y no solo la migración: en Supabase toda función nueva de
// `public` nace con EXECUTE para anon/authenticated (default privileges), y
// un `REVOKE ... FROM PUBLIC` no lo quita. Así quedó abierta
// `anotar_auditoria_de_nota` desde el 07-sep hasta el 07-oct-2026. Este test
// hace que la próxima función nueva olvidada rompa el CI en vez de quedar
// llamable con la clave pública.
//
// Solo lee el catálogo (has_function_privilege): no escribe nada.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { conectar } from "./helpers/db";

let client: Client;

beforeAll(async () => {
  client = await conectar();
});

afterAll(async () => {
  await client?.end();
});

describe("funciones SECURITY DEFINER expuestas por RPC", () => {
  it("ninguna es ejecutable por anon", async () => {
    const { rows } = await client.query<{ proname: string }>(`
      select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and p.prokind = 'f'
        and pg_get_function_result(p.oid) <> 'trigger'
        and has_function_privilege('anon', p.oid, 'execute')
      order by 1
    `);
    expect(rows.map((r) => r.proname)).toEqual([]);
  });

  it("la auditoría de notas y el reset de la demo no los llama ningún usuario", async () => {
    const { rows } = await client.query<{ proname: string; authn: boolean }>(`
      select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as authn
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('anotar_auditoria_de_nota', 'reset_demo_clinic')
    `);
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.authn, r.proname).toBe(false);
  });
});
