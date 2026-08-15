# Disaster Recovery — Alika

Runbook para escenarios de falla operacional. Autoridad: Walter (`walterlamadriz@gmail.com`).

---

## Escenarios y respuesta

### 1. Base de datos corrupta o borrada accidentalmente

**Síntomas:** las tablas devuelven `PGRST116` o vacías; miembros no pueden iniciar sesión.

**Recuperación:**

1. ⚠️ **Desde la migración a Supabase propio (`7ca6301`, 2026-08-14) esto YA NO tiene backup automático.** El proyecto real es `hvfkygoguxvpmwslrccb` (`alika-prod`), plan **Free**. Verificado el 2026-08-15 vía `supabase backups list --project-ref hvfkygoguxvpmwslrccb`: `pitr_enabled: false`, `backups: []` — cero backups existen hoy. El plan Free de Supabase no incluye backups automáticos (a diferencia de Lovable Cloud, que sí los hacía — este párrafo describía ese sistema anterior, ya no aplica).
2. Sin backup propio, la única recuperación posible hoy es reconstruir desde las migraciones versionadas: `supabase/migrations/` está en git, se pueden re-ejecutar en orden contra un proyecto Supabase nuevo vía psql (ver `CLAUDE.md` regla 5). Esto reconstruye el **schema**, no los **datos** — cualquier paciente/cita/pago real cargado hoy se perdería sin remedio.
3. Los seeds iniciales (procedures, message_templates de la clínica `58d8e02c-cf1a-47b6-8f9d-457c0373d209`) están en las migraciones respectivas — eso sí se recupera.
4. El proyecto huérfano de Lovable Cloud (`9f5bde21-...`) ya no es un rollback útil una vez que pasen los 30 días de gracia post-migración (borrado pendiente, ver `docs/SUPABASE_MIGRATION.md`) — y de todos modos es un snapshot congelado al 2026-08-14, cada vez más viejo.

**Datos que se perderían:** TODO lo cargado desde la migración del 2026-08-14 en adelante — no hay backup de ningún punto intermedio. Con pacientes reales de piloto ya en la base, este es el hallazgo de mayor riesgo pendiente del proyecto.

**Mitigación — pendiente de decisión de Walter:** (a) subir a Supabase Pro (~US$25/mes) para backups diarios automáticos + PITR opcional, o (b) backup diario propio vía `pg_dump` a S3/B2 mientras se sigue en Free (mismo patrón que GastroCore360, que ya lo tiene con cifrado `age` — ver memoria `gastrocore360_age_encryption` y `gastrocore360_b2_offsite` en el otro proyecto como referencia). Cualquiera de las dos requiere que Walter decida (gasto recurrente o cuenta B2/S3 nueva).

---

### 2. Deploy en Vercel roto

**Síntomas:** el sitio en producción tira 500 en todas las rutas, o carga en blanco.

**Recuperación:**

1. Vercel guarda historial de deploys. Ir al dashboard del proyecto → Deployments → identificar el último deploy que funcionaba → "Promote to Production".
2. Si el problema es un env var mal seteado, corregir en Vercel → Settings → Environment Variables y redeploy.
3. Si el problema es una migración que dejó la DB en estado incompatible con el código anterior, es un DR de DB (ver #1) — no basta con rollback de Vercel.

**Prevención:** cada deploy corre en preview antes de merge; nunca hacer push directo a main sin verificar en local + preview.

---

### 3. Credenciales de Supabase comprometidas

**Síntomas:** actividad sospechosa en logs (queries desde IPs raras), o alguien te avisó que la `SERVICE_ROLE_KEY` está en un repo público.

**Recuperación:**

1. Rotar las keys desde el dashboard de Supabase (via Lovable si aplica). Esto invalida todas las sesiones activas — los usuarios tendrán que re-loguear.
2. Actualizar `.env` local + Vercel env vars con las keys nuevas.
3. Auditar `pg_stat_activity` y las tablas sensibles (`clinical_notes`, `payments`, `patients`) por accesos anómalos en las últimas 24-48 hrs.
4. Notificar a las clínicas afectadas — si hubo lectura de PHI, hay obligación de reporte según país (GDPR-like en LatAm varía).

**Prevención:** `.env` ya está gitignoreado. `SERVICE_ROLE_KEY` no está en el repo (solo `PUBLISHABLE_KEY` que es pública por diseño). Revisar `git log --all --full-history -- .env` periódicamente por accidentes históricos.

---

### 4. Sync con Lovable roto

**Síntomas:** Lovable no reconoce commits recientes; el editor visual muestra estado viejo.

**Recuperación:**

1. Nunca hacer `git push --force` a `main` (regla ya documentada en `AGENTS.md`). Si alguien lo hizo, restaurar desde el reflog local o desde otro clone.
2. Si el repo GitHub y Lovable divergieron: en el editor de Lovable, "Reconnect GitHub" y elegir mantener el estado del repo (no el de Lovable).
3. Si es imposible reconectar, exportar de Lovable como ZIP fallback y re-arrancar sync después de aplicar diffs manualmente.

**Prevención:** trabajar siempre por commits desde local; usar Lovable solo para lectura visual o cuando explícitamente se quiere que Lovable genere.

---

### 5. Vercel caído o cuenta suspendida

**Síntomas:** dominio principal no responde; Vercel manda email de billing.

**Recuperación temporal (mismo día):**

1. Desplegar en emergencia a otro provider: Cloudflare Pages, Netlify, o self-hosted en el VPS `91.99.204.162` (ver `~/.claude/projects/-Users-walterlamadriz-Documents/memory/user_business_context.md`).
2. Apuntar el dominio (una vez comprado — pendiente) al backup vía cambio de DNS. Propagación 5-60 min.
3. Verificar que las env vars de producción estén replicadas en el nuevo host.

**Prevención:** mantener `Dockerfile` funcional (ya existe) para deploy en cualquier docker host como fallback siempre disponible.

---

### 6. Lovable Cloud cerrado / Lovable AI abandonado

**Síntomas:** Lovable cierra el servicio o cambia términos incompatibles.

**Recuperación:**

1. Extraer el schema completo del Supabase de Lovable: `pg_dump` vía RPC o `supabase db dump` si migramos a Supabase self-hosted.
2. Crear proyecto Supabase propio (self-hosted en VPS o cloud oficial de Supabase).
3. Aplicar migraciones + restaurar datos.
4. Actualizar `.env` con nueva `SUPABASE_URL` + keys.
5. Perder: AI Gateway (Gemini + OpenAI fallback) — reconfigurar directo con las APIs de cada proveedor.

**Preparación:** los archivos `supabase/migrations/` son la fuente de verdad del schema; no hay migraciones "solo en Lovable". La app puede correr contra cualquier Postgres 15+ con las extensiones estándar.

---

### 7. Ataque de rate limit / DDoS

**Síntomas:** el sitio va lento; costos de Vercel/Supabase suben.

**Recuperación:**

1. Cloudflare frente a Vercel (mover DNS a Cloudflare, activar proxy) — mitigación inmediata.
2. Bloquear IPs en el firewall del Supabase (via Lovable soporte).
3. Verificar que endpoints costosos tengan rate-limit (Vercel edge middleware) — actualmente **no está implementado**, es un pendiente.

**Prevención pendiente:** rate-limit middleware por IP + JWT en `_serverFn/*`. Ver el hallazgo #12 de la auditoría (listAppointments sin paginación).

---

## Contactos y accesos

- **Owner del proyecto:** Walter — `walterlamadriz@gmail.com`
- **Lovable:** editor `https://lovable.dev/projects/9f5bde21-41b4-43c0-bc81-ea2215cab660`
- **GitHub:** `walterlamadriz-ai/aurora-dental-os` (rama `main`)
- **Supabase (via Lovable):** proyecto `9f5bde21-41b4-43c0-bc81-ea2215cab660`
- **Login owner de la clínica "clinica Patricia":** `walterlamadriz@gmail.com` / password reseteada via SQL directo en Fase 1
- **VPS fallback:** `91.99.204.162` (mismo host que GastroCore, ver memoria de proyectos)

## Checklist post-incidente

- [ ] Confirmar RTO real vs objetivo (aún sin objetivo formal; sugerido: 4 hrs).
- [ ] Identificar datos perdidos (RPO) y comunicar a las clínicas.
- [ ] Escribir post-mortem en `docs/post-mortems/YYYY-MM-DD-<slug>.md`.
- [ ] Actualizar este runbook con lo aprendido.

## Pendientes de infraestructura (bloquean DR real)

Ver también `docs/DEPLOY_PRODUCTION.md`.

1. Backup diario propio via pg_dump → B2/S3 (independiente de Lovable).
2. Rate-limit middleware en server functions.
3. Monitoreo activo (Sentry/Vercel logs alertas + healthcheck externo).
4. Ejecutar un ensayo de restore desde backup — nunca se ha probado.
5. Documento formal de RTO/RPO firmado con clientes cuando haya SLA.
