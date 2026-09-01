# Backups de Alika

## Qué respalda y qué no

- **Esquema** (tablas, columnas, triggers, RLS, funciones): ya vive versionado en `supabase/migrations/` — eso es su backup, no hace falta duplicarlo.
- **Data** (pacientes, citas, notas clínicas, pagos, todo lo que no está en git): la respalda `scripts/backup-data.mjs`, que exporta las 33 tablas de negocio vía la API REST de Supabase (service role, no necesita la contraseña directa de Postgres).

## Cómo funciona el automático

`.github/workflows/backup.yml` corre todos los días a las 07:15 UTC (~madrugada Chile):

1. `scripts/backup-data.mjs` exporta todas las tablas a un JSON gzipeado.
2. Se cifra con `age` usando la clave pública de Alika (hardcodeada en el workflow — es pública, no es secreto).
3. Se sube a Backblaze B2, bucket `alika-backups/db/`.

También se puede disparar a mano desde GitHub → Actions → "Backup diario" → Run workflow.

## Setup pendiente (una sola vez)

1. **Crear el bucket en Backblaze B2**: `alika-backups`, privado. Sugerido: regla de lifecycle que borre objetos de más de 90 días (retención automática, sin script aparte).
2. **Crear una Application Key** de B2 restringida a ese bucket (no la master key de la cuenta).
3. **Cargar 4 secrets** en GitHub → Settings → Secrets and variables → Actions del repo `alika` (los valores de Supabase ya los tenés en tu `.env` local, cópialos de ahí):
   ```
   gh secret set SUPABASE_URL
   gh secret set SUPABASE_SERVICE_ROLE_KEY
   gh secret set B2_ACCOUNT_ID
   gh secret set B2_APPLICATION_KEY
   ```

Hasta que estén los 4 secrets, el workflow programado va a fallar (o podés dejarlo sin correr) — no rompe nada más, es un job aislado.

## La clave privada de cifrado

- **Pública** (segura en el repo): `age1xrwep8wxudjt6zy0ygnqf5xzr5tmpeakmn55yt8q37lg23ewqu2q2tzvqv`
- **Privada**: generada el 2026-08-17, guardada en `~/Library/Mobile Documents/com~apple~CloudDocs/alika-backups/.alika-backup-age.key` (iCloud Drive de Walter, `chmod 600`). Sin ella, los `.json.gz.age` en B2 son ilegibles — no hay forma de recuperarla si se pierde.
- Verificada por round-trip real el 2026-08-17: descifrado + descomprimido un backup real, confirmadas 33 tablas / 115 filas incluyendo el nombre de un paciente real.

**Si hay que rotar la clave** (sospecha de compromiso): `age-keygen` una nueva, actualizar la pública en `backup.yml`, guardar la privada nueva junto a la vieja (los backups viejos solo se leen con la vieja).

## Cómo restaurar

```bash
# 1) Bajar el backup cifrado de B2 (o usar el botón "download" en el dashboard de B2)
rclone copy b2:alika-backups/db/alika_YYYYMMDD_HHMMSS.json.gz.age /tmp/

# 2) Descifrar + descomprimir
age -d -i ~/Library/"Mobile Documents"/com~apple~CloudDocs/alika-backups/.alika-backup-age.key \
  /tmp/alika_YYYYMMDD_HHMMSS.json.gz.age | gunzip > /tmp/alika-restore.json

# 3) El JSON tiene forma { exportedAt, tables: { patients: [...], appointments: [...], ... } }
#    No es un dump SQL — restaurar significa re-insertar cada tabla contra un
#    esquema ya creado (correr las migraciones de supabase/migrations/ primero
#    si es una DB nueva), respetando el orden de FKs. No hay un solo comando:
#    escribir un script puntual con supabase-js que haga upsert por tabla en
#    el momento que haga falta un restore real — no se armó de antemano para
#    no mantener código de restore sin probar contra una restauración real.
```

## Bitácora

- **2026-08-17**: primer backup manual hecho a mano (no por el workflow, que todavía no tiene los secrets) — 33 tablas, 115 filas, verificado por round-trip. Cierra el riesgo de "cero backups con pacientes reales en prod" mientras se completa el setup de B2. Guardado también en iCloud junto a la clave privada (redundancia geográfica real desde el día uno, no solo local).
