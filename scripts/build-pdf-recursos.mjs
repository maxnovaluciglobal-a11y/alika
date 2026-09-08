#!/usr/bin/env node
// scripts/build-pdf-recursos.mjs
//
// Genera el PDF descargable del checklist "15 fugas de dinero de una clínica
// dental" (Task 13, Fase 3) a partir de la MISMA página pública que se lee
// online (src/routes/recursos.fugas-clinica-dental.tsx) — una sola fuente de
// verdad: para cambiar una coma se edita el .tsx, no un binario aparte.
//
// Requisito: un dev server tiene que estar corriendo ANTES de correr este
// script. A propósito no lo levanta él mismo (mantenerlo simple) — usá:
//
//   node --env-file=.env node_modules/.bin/vite dev --port 8098
//
// y en otra terminal:
//
//   BASE_URL=http://localhost:8098 node scripts/build-pdf-recursos.mjs
//
// Sin BASE_URL usa el puerto 8080 (el de `preview_start({name: "alika"})`,
// ver CLAUDE.md del repo).
//
// Usa el Chromium de Playwright — instalado GLOBALMENTE en esta máquina
// (`playwright --version` → 1.62.1), no como dependencia de este proyecto.
// `createRequire` resuelve primero un `playwright` local (por si algún día
// se agrega como devDependency) y si no lo encuentra cae al paquete global
// vía `npm root -g`, sin necesidad de tocar package.json ni NODE_PATH.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const require_ = createRequire(import.meta.url);

function resolverPlaywright() {
  try {
    return require_("playwright");
  } catch {
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    try {
      return require_(path.join(globalRoot, "playwright"));
    } catch (err) {
      throw new Error(
        `No encontré el paquete "playwright" ni localmente ni en ${globalRoot}. ` +
          `Instalalo global con "npm install -g playwright" o corré "playwright install chromium" primero. ` +
          `Error original: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

const RECURSOS = {
  "fugas-clinica-dental": {
    ruta: "/recursos/fugas-clinica-dental",
    salida: "assets-privados/fugas-clinica-dental.pdf",
    // Selector de algo que sólo aparece post-hidratación, para no capturar
    // el PDF a mitad de un render en blanco.
    esperarTexto: "El sillón vacío que nadie vuelve a llenar",
  },
};

async function main() {
  const slug = process.argv[2] || "fugas-clinica-dental";
  const recurso = RECURSOS[slug];
  if (!recurso) {
    console.error(
      `Recurso desconocido: "${slug}". Disponibles: ${Object.keys(RECURSOS).join(", ")}`,
    );
    process.exit(1);
  }

  const baseUrl = process.env.BASE_URL || "http://localhost:8080";
  const url = `${baseUrl}${recurso.ruta}`;
  const salida = path.resolve(process.cwd(), recurso.salida);

  const { chromium } = resolverPlaywright();

  console.log(`[build-pdf-recursos] Abriendo ${url} …`);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByText(recurso.esperarTexto).first().waitFor({ state: "visible" });

    // CSS de impresión: la misma página que se lee online, renderizada como
    // se vería impresa (sin la cabecera/nav si tienen reglas @media print).
    await page.emulateMedia({ media: "print" });

    await mkdir(path.dirname(salida), { recursive: true });
    await page.pdf({
      path: salida,
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
    });
  } finally {
    await browser.close();
  }

  console.log(`[build-pdf-recursos] PDF generado en ${salida}`);
}

main().catch((err) => {
  console.error("[build-pdf-recursos] Falló:", err);
  process.exit(1);
});
