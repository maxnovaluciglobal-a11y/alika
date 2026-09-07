import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXCLUDED_TABLES, TABLES } from "../scripts/backup-tables.mjs";

/**
 * El backup diario (.github/workflows/backup.yml) respalda exactamente las
 * tablas listadas en scripts/backup-tables.mjs. Si una migración crea una
 * tabla y nadie toca esa lista, el workflow sigue en VERDE respaldando de
 * menos: el script no tiene forma de saber que le falta algo, y el día que
 * haga falta restaurar, esa tabla no está.
 *
 * Ya pasó dos veces (memoria alika_backups_offsite): la última el
 * 06-sep-2026, con `procedure_supplies` e `inventory_counts` creadas ese
 * mismo día. La primera vez se arregló con una nota de "mantener
 * sincronizado" en el script — es decir, dependiendo de que alguien se
 * acuerde. Este test convierte esa nota en un check de CI, que es lo único
 * que detecta la tercera reincidencia sin que nadie esté mirando.
 */

const DIR_MIGRACIONES = new URL("../supabase/migrations/", import.meta.url);

// `CREATE TABLE [IF NOT EXISTS] public.<nombre>`, con o sin comillas dobles.
// Todas las migraciones del repo usan el prefijo `public.` explícito; una
// que no lo use se escapa de este parser, y por eso el primer test ancla el
// resultado contra tablas conocidas en vez de confiar en el conteo.
const CREATE_TABLE = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.("?)([a-z0-9_]+)\1/gi;

function tablasDelSchema(): string[] {
  const encontradas = new Set<string>();
  for (const archivo of readdirSync(DIR_MIGRACIONES).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(new URL(archivo, DIR_MIGRACIONES), "utf8");
    for (const [, , tabla] of sql.matchAll(CREATE_TABLE)) encontradas.add(tabla);
  }
  return [...encontradas].sort();
}

describe("sincronía entre el schema y la lista del backup", () => {
  it("extrae las tablas de las migraciones", () => {
    const schema = tablasDelSchema();

    // Ancla: si el parser o la ruta se rompen, `schema` queda vacío y los
    // dos tests de abajo pasarían sin comparar nada — el mismo verde falso
    // que este archivo existe para evitar.
    expect(schema).toContain("patients");
    expect(schema).toContain("clinics");
    expect(schema).toContain("appointments");
    expect(schema.length).toBeGreaterThan(40);
  });

  it("respalda todas las tablas del schema", () => {
    const faltantes = tablasDelSchema().filter(
      (t) => !TABLES.includes(t) && !EXCLUDED_TABLES.includes(t),
    );

    expect(
      faltantes,
      `Estas tablas existen en supabase/migrations/ y NO se respaldan: ${faltantes.join(", ")}. ` +
        "Agregalas a TABLES en scripts/backup-tables.mjs, o a " +
        "EXCLUDED_TABLES con el motivo si la exclusión es deliberada.",
    ).toEqual([]);
  });

  it("no lista tablas que ya no existen en el schema", () => {
    const schema = tablasDelSchema();
    const fantasmas = TABLES.filter((t: string) => !schema.includes(t));

    // Una tabla renombrada o eliminada rompe el backup entero: dumpTable
    // lanza y el workflow queda en rojo sin subir nada.
    expect(
      fantasmas,
      `TABLES nombra tablas inexistentes: ${fantasmas.join(", ")}. ` +
        "El backup fallaría entero al intentar leerlas.",
    ).toEqual([]);
  });

  it("no excluye del backup tablas que ya no existen", () => {
    const schema = tablasDelSchema();
    const obsoletas = EXCLUDED_TABLES.filter((t: string) => !schema.includes(t));

    // Mantiene honesta la escotilla: una exclusión que sobrevive a su tabla
    // puede tapar mañana a otra tabla nueva con el mismo nombre.
    expect(
      obsoletas,
      `EXCLUDED_TABLES excluye tablas que ya no existen: ${obsoletas.join(", ")}.`,
    ).toEqual([]);
  });
});
