// Avisa a los buscadores que usan IndexNow (Bing, y con él ChatGPT Search;
// también Yandex, Seznam, Naver) que cambiaron las URLs del sitemap.
// La clave es pública por diseño: public/<clave>.txt prueba que el dominio es
// nuestro. Uso: node scripts/indexnow.mjs [https://esmalia.com]
const SITE = process.argv[2] ?? "https://esmalia.com";
const KEY = "22385499ce8cc9c19c8d21268aaee15e";

const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(SITE).host,
    key: KEY,
    keyLocation: `${SITE}/${KEY}.txt`,
    urlList,
  }),
});
console.log(`IndexNow: ${urlList.length} URLs → HTTP ${res.status}`);
if (!res.ok && res.status !== 202) process.exit(1);
