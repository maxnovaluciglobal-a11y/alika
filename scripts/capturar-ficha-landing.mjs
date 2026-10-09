// Captura la ficha de un paciente de la clínica demo (datos, alerta de alergia
// y odontograma) para la landing, en 4:3. Reemplaza la foto de stock de un
// dentista: la landing muestra el producto real, no gente que no es cliente.
//
// Requiere Playwright instalado globalmente (npm i -g playwright && npx
// playwright install chromium), igual que generar-og.mjs, y la app corriendo
// en local (npm run dev). Entra por /demo con datos de prueba: ese formulario
// tiene un límite de envíos por hora y por conexión, y cada intento cuenta,
// así que la sesión se guarda en .playwright/demo-state.json y se reusa.
// Uso, desde la raíz del repo:
//   node scripts/capturar-ficha-landing.mjs [http://localhost:8080]
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const raizGlobal = execSync("npm root -g").toString().trim();
const { chromium } = createRequire(join(raizGlobal, "/"))("playwright");

const BASE = process.argv[2] ?? "http://localhost:8080";
const SALIDA = resolve("public/landing/ficha-odontograma.jpg");
const ESTADO = resolve(".playwright/demo-state.json");
// Agustín Morales Peña, paciente fijo del seed de la demo: tiene alergia
// registrada, convenio, una obturación en la 14 y una corona en la 46.
const PACIENTE = "3cdeb639-b2eb-41e7-be29-f891bd33d03a";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1360, height: 1400 },
  deviceScaleFactor: 2,
  ...(existsSync(ESTADO) ? { storageState: ESTADO } : {}),
});
const page = await ctx.newPage();

if (!existsSync(ESTADO)) {
  await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
  await page.getByLabel("Tu nombre").fill("QA Auditoría Claude");
  await page.getByLabel("Email").fill("qa-auditoria@example.com");
  await page.locator("input[type=checkbox]").first().check();
  await page.getByRole("button", { name: "Entrar a la demo" }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  mkdirSync(resolve(".playwright"), { recursive: true });
  await ctx.storageState({ path: ESTADO });
}

await page.goto(`${BASE}/pacientes/${PACIENTE}?pestana=odontograma`, { waitUntil: "networkidle" });
await page.waitForSelector('svg[viewBox="0 0 40 84"]');
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);

// Encuadre: del nombre del paciente al final de la arcada inferior, a lo
// ancho del contenido, centrado en un 4:3 para que la landing no lo recorte.
const nombre = await page
  .locator("main h1, main h2")
  .filter({ hasText: "Morales" })
  .first()
  .boundingBox();
const dientes = await page.$$('svg[viewBox="0 0 40 84"]');
const ultimo = await dientes[dientes.length - 1].boundingBox();
const main = await (await page.$("main")).boundingBox();
const arriba = nombre.y - 36;
const contenido = ultimo.y + ultimo.height + 40 - arriba;
const ancho = main.width;
const alto = (ancho * 3) / 4;
const y = Math.max(0, arriba - Math.max(0, (alto - contenido) / 2));

await page.screenshot({
  path: SALIDA,
  type: "jpeg",
  quality: 82,
  clip: { x: main.x, y, width: ancho, height: alto },
});
console.log(`Listo: ${SALIDA} (${Math.round(ancho * 2)}×${Math.round(alto * 2)})`);
await browser.close();
