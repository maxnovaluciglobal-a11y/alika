#!/usr/bin/env node
/**
 * Falla si `src/integrations/supabase/types.ts` no coincide con lo que
 * genera el CLI contra la base real.
 *
 * La regla 4 del CLAUDE.md obligó durante meses a parchear ese archivo a
 * mano en cada migración. La auditoría del 04-sep verificó que no había
 * drift, pero eso era disciplina sostenida, no una garantía: al regenerarlo
 * el 05-sep aparecieron veinte foreign keys sin declarar y tres funciones
 * que nunca se agregaron.
 *
 * Esto no corre en cada commit —necesita red y credenciales del CLI— sino a
 * mano después de aplicar una migración, y en CI si algún día hay un token.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const DESTINO = "src/integrations/supabase/types.ts";
const PROYECTO = "hvfkygoguxvpmwslrccb";

function salir(codigo, mensaje) {
  console.error(mensaje);
  process.exit(codigo);
}

let generado;
try {
  generado = execFileSync("supabase", ["gen", "types", "typescript", "--project-id", PROYECTO], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
} catch (e) {
  salir(
    2,
    "\nNo se pudo generar los tipos. Suele ser sesión del CLI:\n" +
      "  supabase login\n\n" +
      `Detalle: ${e.stderr?.toString().trim() || e.message}\n`,
  );
}

// El archivo del repo pasa por prettier; el del CLI no. Se comparan sin
// espacios ni punto y coma para que el formato no cuente como drift.
const normalizar = (s) => s.replace(/[\s;]+/g, " ").trim();

if (normalizar(generado) === normalizar(readFileSync(DESTINO, "utf8"))) {
  console.log(`${DESTINO} coincide con la base.`);
  process.exit(0);
}

salir(
  1,
  `\n${DESTINO} no coincide con la base.\n\n` +
    "Regeneralo y revisá el diff antes de commitear:\n" +
    "  npm run types:gen && git diff --stat " +
    DESTINO +
    "\n",
);
