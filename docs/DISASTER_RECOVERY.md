# Disaster Recovery — Alika

Runbook para escenarios de falla operacional. Autoridad: Walter (`walterlamadriz@gmail.com`).

---

## Escenarios y respuesta

### 1. Base de datos corrupta o borrada accidentalmente

**Síntomas:** las tablas devuelven `PGRST116` o vacías; miembros no pueden iniciar sesión.

**Recuperación:**

1. ✅ **Actualizado 2026-09-05 — esto ya NO describe la situación real.** Desde el 2026-09-01 corre un backup diario propio (`.github/workflows/backup.yml`, 07:15 UTC): exporta todas las tablas de negocio vía API REST de Supabase (`service_role`), cifra con `age` y sube a Backblaze B2 (`b2:alika-backups/db/`). La lista de tablas del script (`scripts/backup-data.mjs`) estaba desactualizada desde el 22-ago (excluía 22 tablas nuevas, incluidas `patient_medical_history`/`patient_consents`/`patient_documents`) — corregido hoy mismo. `pitr_enabled` sigue en `false` (Supabase plan actual no lo incluye) — el backup diario es la única cobertura, no hay recuperación a un punto intermedio del día.
2. Restauración: manual, documentada paso a paso en `docs/BACKUPS_ALIKA.md` (recrear schema con las migraciones + reinsertar cada tabla del JSON descifrado). **Nunca se ejecutó un restore real end-to-end** — ver checklist post-incidente.
3. Si el backup del día también fallara (o el bucket B2 no fuera accesible), la única recuperación posible es reconstruir desde las migraciones versionadas en `supabase/migrations/` (ver `CLAUDE.md` regla 5) — esto reconstruye el **schema**, no los **datos**.
4. Los seeds iniciales se recuperan solos al re-ejecutar las migraciones: el trigger `on_clinic_created` → `handle_new_clinic()` (definido en `20260726145220`, última redefinición en `20260816170100`) siembra automáticamente los `procedures` default y las 14 `message_templates` de WhatsApp en **cualquier clínica nueva** que se cree.
5. El proyecto huérfano de Lovable Cloud (`9f5bde21-...`) es un snapshot congelado al 2026-08-14 — cada vez más desactualizado, no reemplaza al backup diario.

**Datos que se perderían (RPO real hoy):** hasta 24 horas — todo lo escrito entre la última corrida exitosa del backup (07:15 UTC) y el momento de la falla. Antes del 2026-09-01 no había backup alguno; ese hueco (14-ago a 01-sep) no es recuperable retroactivamente.

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
3. ✅ Actualizado 2026-09-05: `_serverFn/*` y `/api/*` (excepto los webhooks de Stripe/Meta, protegidos por firma) tienen un rate-limit por IP desde `src/server.ts` (`src/lib/rate-limit.server.ts`) — 180 req/min por IP en server functions, 60 req/min en API pública. **Limitación conocida:** es en memoria por instancia de función serverless, no compartido entre instancias — bajo un ataque distribuido en escala (muchas IPs, o mucho tráfico repartido entre instancias de Vercel) no alcanza. Un store compartido (Upstash Redis / Vercel KV) daría un tope real y exacto — no implementado, requiere decisión de infraestructura nueva.

**Prevención pendiente:** si el rate-limit en memoria no alcanza bajo un ataque real, migrar a un store compartido (Upstash Redis/Vercel KV). Ver también el hallazgo #12 de la auditoría (listAppointments sin paginación).

---

## RTO / RPO — objetivos formales

Sin SLA firmado con ninguna clínica todavía; estos son los objetivos internos que gobiernan cómo se prioriza este runbook y las decisiones de infraestructura, no una promesa contractual. Se actualizan si la infraestructura cambia (backups, PITR, ensayo de restore) o cuando exista un SLA real.

| Escenario                           | RPO objetivo             | RPO real hoy                   | RTO objetivo | RTO real hoy                                                  |
| ----------------------------------- | ------------------------ | ------------------------------ | ------------ | ------------------------------------------------------------- |
| DB corrupta/borrada (#1)            | 24 h                     | 24 h (backup diario 07:15 UTC) | 4 h          | **Sin validar** — nunca se ejecutó un restore real end-to-end |
| Deploy Vercel roto (#2)             | 0 (sin pérdida de datos) | 0                              | 15 min       | ~15 min (rollback a deploy anterior vía dashboard)            |
| Credenciales comprometidas (#3)     | 0                        | 0                              | 1 h          | Sin validar                                                   |
| Vercel caído/cuenta suspendida (#5) | 0                        | 0                              | 4 h          | Sin validar — depende de comprar el dominio (pendiente)       |

**Por qué el RTO de DB no está validado:** el backup existe y se verificó por round-trip (descifrar + descomprimir + confirmar filas), pero eso no es lo mismo que reconstruir una base desde cero y confirmar que la app vuelve a andar — ese ensayo nunca se hizo. Hasta que se haga, "4 horas" es una meta, no un número con el que se pueda comprometer una clínica piloto.

**Próximo paso concreto:** ensayar un restore real contra un proyecto Supabase descartable (no el de producción) usando el backup de hoy + `docs/BACKUPS_ALIKA.md`, cronometrarlo, y reemplazar "Sin validar" por el tiempo real. Recién ahí este RTO deja de ser una suposición.

---

## Contactos y accesos

- **Owner del proyecto:** Walter — `walterlamadriz@gmail.com`
- **Lovable:** editor `https://lovable.dev/projects/9f5bde21-41b4-43c0-bc81-ea2215cab660`
- **GitHub:** `maxnovaluciglobal-a11y/alika` (rama `main`) — migrado desde `walterlamadriz-ai/alika` el 2026-08-31, la URL vieja redirige
- **Supabase propio (producción real):** proyecto `hvfkygoguxvpmwslrccb`, `sa-east-1`, org MaxnovaLuci. El proyecto Lovable Cloud `9f5bde21-...` es un huérfano congelado al 14-ago, no producción.
- **Login owner de la clínica "clinica Patricia":** `walterlamadriz@gmail.com` / password reseteada via SQL directo en Fase 1
- **VPS fallback:** `91.99.204.162` (mismo host que GastroCore, ver memoria de proyectos)

## Checklist post-incidente

- [ ] Confirmar RTO real vs el objetivo de la tabla "RTO / RPO — objetivos formales" arriba.
- [ ] Identificar datos perdidos (RPO) y comunicar a las clínicas.
- [ ] Escribir post-mortem en `docs/post-mortems/YYYY-MM-DD-<slug>.md`.
- [ ] Actualizar este runbook con lo aprendido.

## Pendientes de infraestructura (bloquean DR real)

Ver también `docs/DEPLOY_PRODUCTION.md`.

1. ✅ Backup diario propio (API REST de Supabase → B2), corrigiendo 2026-09-05.
2. ✅ Rate-limit en server functions y API pública — con la limitación de memoria-por-instancia documentada arriba.
3. Monitoreo activo (Sentry/Vercel logs alertas + healthcheck externo) — Sentry sigue no-op sin `VITE_SENTRY_DSN`.
4. Ejecutar un ensayo de restore desde backup — nunca se ha probado. Sigue siendo el mayor hueco real de este runbook.
5. Documento formal de RTO/RPO firmado con clientes — la tabla de arriba son objetivos internos, no un SLA firmado; falta eso cuando haya clínicas piloto con contrato.
