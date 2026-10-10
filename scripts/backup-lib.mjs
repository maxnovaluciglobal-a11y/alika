// Helpers puros (o con el cliente inyectado) que usan backup-data.mjs y
// backup-storage.mjs.
//
// Viven aparte por la misma razón que backup-tables.mjs: los tests los
// importan, e importar un script con `main()` dispararía un backup real
// contra producción.

/** Usuarios por página en auth.admin.listUsers (el máximo que acepta GoTrue). */
export const AUTH_PAGE_SIZE = 1000;

/** Objetos por página en storage.list (el default de storage-js es 100). */
export const STORAGE_PAGE_SIZE = 1000;

/**
 * Proyecta un usuario de auth.admin.listUsers a lo que guarda el backup.
 *
 * La API de admin NO devuelve el hash de la contraseña (ni ningún secreto:
 * tokens de recuperación, factores MFA). Por eso un usuario restaurado tiene
 * que entrar con Google o pedir "olvidé mi contraseña" — ver
 * docs/BACKUPS_ALIKA.md, "Restaurar usuarios de auth".
 */
export function projectAuthUser(user) {
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone || null,
    created_at: user.created_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    phone_confirmed_at: user.phone_confirmed_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    banned_until: user.banned_until ?? null,
    user_metadata: user.user_metadata ?? {},
    app_metadata: user.app_metadata ?? {},
    identity_providers: [...new Set((user.identities ?? []).map((i) => i.provider))].sort(),
  };
}

/** Recorre todas las páginas de auth.admin.listUsers. Lanza si alguna falla. */
export async function dumpAuthUsers(admin, perPage = AUTH_PAGE_SIZE) {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth.users (página ${page}): ${error.message}`);
    users.push(...data.users.map(projectAuthUser));
    if (data.users.length < perPage) return users;
  }
}

/** Une un prefijo de carpeta con un nombre, sin barras dobles ni iniciales. */
export function joinStoragePath(prefix, name) {
  return prefix ? `${prefix.replace(/\/+$/, "")}/${name}` : name;
}

/**
 * storage.list devuelve archivos y carpetas mezclados; las carpetas son las
 * entradas con `id === null` (no tienen fila propia en storage.objects).
 */
export function isStorageFolder(entry) {
  return entry.id === null || entry.id === undefined;
}

/**
 * Lista recursivamente todos los objetos de un bucket. Devuelve
 * `[{ path, size, mimetype, updated_at }]`. Lanza ante cualquier error de
 * listado: un listado incompleto es un backup incompleto que se ve en verde,
 * así que eso tiene que tirar el job (a diferencia de la descarga de UN
 * archivo, que se saltea y se reporta).
 */
export async function listBucketObjects(storage, bucket, pageSize = STORAGE_PAGE_SIZE) {
  const files = [];
  const pending = [""];
  while (pending.length > 0) {
    const prefix = pending.shift();
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await storage.from(bucket).list(prefix, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`listar ${bucket}/${prefix}: ${error.message}`);
      for (const entry of data) {
        const path = joinStoragePath(prefix, entry.name);
        if (isStorageFolder(entry)) {
          pending.push(path);
        } else {
          files.push({
            path,
            size: entry.metadata?.size ?? null,
            mimetype: entry.metadata?.mimetype ?? null,
            updated_at: entry.updated_at ?? null,
          });
        }
      }
      if (data.length < pageSize) break;
    }
  }
  return files;
}

/**
 * Rechaza rutas que escaparían del directorio de salida al escribirlas en
 * disco (`..`, absolutas). Los nombres los elige quien sube el archivo.
 */
export function isSafeRelativePath(path) {
  if (!path || path.startsWith("/") || path.includes("\\")) return false;
  return path.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");
}
