#!/usr/bin/env node
/**
 * Rechaza caracteres invisibles en el código fuente.
 *
 * Esto pasó tres veces el mismo día (04-sep-2026): un byte NUL que se coló
 * como centinela de un `Map`, y dos regex de diacríticos escritos con los
 * caracteres combinantes literales en vez del rango escapado. Ninguna de las
 * tres la detectó el typecheck ni el lint — la primera solo salió a la luz
 * porque `git diff --stat` marcó el archivo como binario, y las otras dos las
 * encontró una auditoría.
 *
 * El costo de revisarlo a mano cada vez es más alto que el de este guard.
 *
 * Los patrones se construyen con `new RegExp` y escapes en string, no con
 * literales: un guard contra caracteres invisibles que los contuviera se
 * rechazaría a sí mismo (comprobado).
 */
import { readFileSync } from "node:fs";

/** Bytes de control salvo tab (09), LF (0A) y CR (0D). */
const CONTROL = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]");

/**
 * Marcas diacríticas combinantes. Son legítimas dentro de un string de datos,
 * pero en este repo solo aparecieron por error, escritas dentro de un rango de
 * expresión regular donde deberían ir escapadas.
 */
const COMBINANTES = new RegExp("[\\u0300-\\u036F]");

const archivos = process.argv.slice(2);
const problemas = [];

for (const archivo of archivos) {
  let contenido;
  try {
    contenido = readFileSync(archivo, "utf8");
  } catch {
    continue;
  }
  contenido.split("\n").forEach((linea, i) => {
    if (CONTROL.test(linea)) {
      problemas.push(`${archivo}:${i + 1} — carácter de control invisible`);
    } else if (COMBINANTES.test(linea)) {
      problemas.push(
        `${archivo}:${i + 1} — marca diacrítica combinante literal. ` +
          "Si es un rango de regex, escribilo como \\u0300-\\u036f",
      );
    }
  });
}

if (problemas.length) {
  console.error("\nCaracteres invisibles en el fuente:\n");
  for (const p of problemas) console.error(`  ${p}`);
  console.error("\nNadie puede revisar esto en un diff. Escapalos antes de commitear.\n");
  process.exit(1);
}
