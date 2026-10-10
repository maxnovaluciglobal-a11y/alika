// Descarga todos los archivos de todos los buckets de Supabase Storage a un
// directorio local, para que el workflow lo empaquete en storage.tar.gz,
// lo cifre con age y lo suba a B2 (ver .github/workflows/backup.yml).
//
// Hoy existe un solo bucket (`clinical-documents`: radiografías, imágenes,
// PDFs de consentimiento y firmas de presupuesto), pero se recorren TODOS
// los que devuelve listBuckets: un bucket nuevo queda respaldado sin tocar
// este script.
//
// Política de errores:
//   - Falla un LISTADO (de buckets o de una carpeta) → el script sale con 1.
//     Un listado incompleto es un backup incompleto que se vería en verde.
//   - Falla la DESCARGA de un archivo → se saltea, queda en
//     manifest.json → `failed`, y se avisa por stderr (y como ::warning:: en
//     GitHub Actions). Un PDF roto no debe dejar sin backup a los demás.
//
// Salida: <dir>/<bucket>/<ruta del objeto> + <dir>/manifest.json
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-storage.mjs storage-backup
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isSafeRelativePath, listBucketObjects } from "./backup-lib.mjs";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const outDir = process.argv[2];
  if (!url || !key || !outDir) {
    console.error(
      "Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-storage.mjs <dir>",
    );
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);

  const manifest = { exportedAt: new Date().toISOString(), buckets: [], failed: [] };
  let totalFiles = 0;
  let totalBytes = 0;

  for (const bucket of buckets) {
    const objects = await listBucketObjects(admin.storage, bucket.id);
    const saved = [];
    for (const obj of objects) {
      if (!isSafeRelativePath(obj.path)) {
        manifest.failed.push({ bucket: bucket.id, path: obj.path, error: "ruta insegura" });
        continue;
      }
      const { data, error: dlError } = await admin.storage.from(bucket.id).download(obj.path);
      if (dlError || !data) {
        manifest.failed.push({
          bucket: bucket.id,
          path: obj.path,
          error: dlError?.message ?? "respuesta vacía",
        });
        continue;
      }
      const bytes = Buffer.from(await data.arrayBuffer());
      const dest = join(outDir, bucket.id, obj.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, bytes);
      saved.push({ ...obj, size: bytes.length });
      totalBytes += bytes.length;
    }
    totalFiles += saved.length;
    manifest.buckets.push({
      id: bucket.id,
      public: bucket.public,
      file_size_limit: bucket.file_size_limit ?? null,
      allowed_mime_types: bucket.allowed_mime_types ?? null,
      objects: saved,
    });
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  process.stderr.write(
    `Storage: ${buckets.length} buckets, ${totalFiles} archivos, ` +
      `${(totalBytes / 1024 / 1024).toFixed(1)} MB, ${manifest.failed.length} fallidos.\n`,
  );
  for (const f of manifest.failed) {
    // Solo bucket + ruta (ids de clínica/paciente), nunca contenido.
    const line = `No se pudo respaldar ${f.bucket}/${f.path}: ${f.error}`;
    console.error(process.env.GITHUB_ACTIONS ? `::warning::${line}` : line);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
