# Deploy a producción — Alika

Checklist paso a paso para el primer lanzamiento B2B con clínicas piloto. Cada sección lista **quién debe hacerlo** (Walter vs código) y **cómo verificar** que quedó.

---

## Pre-vuelo — decisiones bloqueantes

Estas cosas requieren decisión y firma de Walter antes de tocar código productivo.

- [ ] **Confirmar el nombre "Alika"** o retomar la búsqueda. Ver `~/.claude/projects/-Users-walterlamadriz-Documents/memory/oralia_audit_fase6.md` para la investigación. Recomendación: seguir con Alika si el trademark check da libre.
- [ ] **Trademark check formal** en INAPI (CL) + IMPI (MX) + INPI (AR) + USPTO clase 9 y 42. ~US$150 con abogado, 2-3 días. Sin este OK, no comprar dominio ni imprimir marketing.
- [ ] **Comprar `alika.com`**. El dominio aparece en HugeDomains/similar como premium; probable rango US$1-3k. Alternativa `alika.app` (~US$20/año) si el .com sale caro.
- [ ] **Modelo de precios** definido: ¿por seat/profesional/mes? ¿flat por clínica? ¿free trial 14 días? Requerido antes de configurar Stripe.
- [ ] **Piloto**: identificar 3-5 clínicas amigas dispuestas a usar la beta. Sin piloto no vale la pena ir a producción.

---

## Wave 1 — Hardening de código (autónomo, ya en curso)

- [x] Portal pausado (`/portal/*` muestra "próximamente" hasta v2)
- [x] `docs/DISASTER_RECOVERY.md`
- [x] `docs/DEPLOY_PRODUCTION.md` (este archivo)
- [ ] Verificar `/onboarding` E2E
- [ ] Revisar `tests/` (existe carpeta pero no verificada)
- [ ] Wiring Sentry con env-var check (no crashea sin DSN)
- [ ] `robots.txt` + `sitemap.xml` + `vercel.json` con security headers
- [ ] `.env.example` completo con comentarios de cómo obtener cada key

---

## Wave 2 — Infra (requiere Walter)

### 2.1 Dominio

- [ ] Comprar `alika.com` (o `alika.app`). Registrar con contacto profesional (no personal).
- [ ] Activar Cloudflare en frente del dominio (DNS + proxy).
- [ ] Configurar SSL automático (Vercel + Cloudflare lo hacen solos si el dominio apunta bien).

### 2.2 Vercel

- [ ] Cuenta Vercel Pro (~US$20/mes) — necesario para custom domain productivo y multiples envs.
- [ ] Conectar el repo `walterlamadriz-ai/alika` al proyecto Vercel.
- [ ] Configurar dominio productivo → apuntar `alika.com` a Vercel (CNAME o A record).
- [ ] Environment Variables en Vercel (copiar de `.env.example`):
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (⚠️ solo en el env de producción, NO en preview)
  - `GEMINI_API_KEY` u `OPENAI_API_KEY`
  - `SENTRY_DSN` (cuando se cree en 2.4)
  - `PUBLIC_APP_URL=https://alika.com`
- [ ] Configurar branch protection: solo `main` deploya a producción; PRs deploy a preview.

### 2.3 Supabase

- [x] **Resuelto** — se migró de Lovable Cloud al Supabase propio (`hvfkygoguxvpmwslrccb`, sa-east-1) el 2026-08-14. Ver `docs/SUPABASE_MIGRATION.md`. Prod corre contra el propio, verificado.
- [ ] Verificar que el plan actual (Free tier) alcanza el volumen esperado a medida que entren clínicas piloto reales — upgrade si hace falta.
- [ ] Setear backup diario propio via pg_dump + rclone a B2 (`~/.claude/projects/-Users-walterlamadriz-Documents/memory/gastrocore360_b2_offsite.md` tiene el patrón usado en GastroCore).

### 2.4 Monitoreo

- [ ] **Sentry** — cuenta gratis (5k events/mes), crear proyecto React, copiar el DSN a `SENTRY_DSN`. El código ya está preparado para leerlo (ver Wave 1).
- [ ] **Antes de setear `VITE_SENTRY_DSN`**: revisar el `beforeSend` en `src/lib/sentry.ts` — hoy trunca cookies, redacta `user` a solo `id`, y redacta el patrón `(columna)=(valor)` de mensajes tipo Postgres (`Key (email)=(x) already exists`). Confirmar contra errores reales del proyecto que ese redactado alcanza antes de habilitar el DSN en prod (checklist detallado en el comentario del `beforeSend`).
- [ ] **PostHog** — cuenta gratis (1M events/mes), crear proyecto, copiar el key a `POSTHOG_KEY`.
- [ ] **Healthcheck externo** — UptimeRobot (gratis, 5 min interval) apuntando a `https://alika.com/api/health` (endpoint pendiente de crear).
- [ ] **Alertas Slack/Email** — desde Sentry cuando hay errores nuevos, y desde UptimeRobot cuando el sitio cae.

### 2.5 Billing (Stripe)

- [ ] Cuenta Stripe con la LLC USA (Maxnova & Luci LLC) — ver memoria `user_business_context`.
- [ ] Crear productos en Stripe:
  - `Alika Clínica` con precio por seat (o flat) según decisión de pricing.
  - Trial 14 días.
- [ ] Copiar `STRIPE_SECRET_KEY` y `STRIPE_PUBLISHABLE_KEY` a Vercel env vars.
- [ ] Crear webhook endpoint en `https://alika.com/api/stripe/webhook` (pendiente de código).
- [ ] Copiar `STRIPE_WEBHOOK_SECRET`.

---

## Wave 3 — Verificaciones antes del launch

### 3.1 Smoke tests manuales

Loguearse como owner y ejecutar el golden path:

- [ ] Onboarding de una clínica nueva (Walter con cuenta nueva).
- [ ] Crear un paciente.
- [ ] Agendar una cita.
- [ ] Marcar la cita como en-sala → finalizada.
- [ ] Abrir la ficha del paciente y agregar una nota clínica.
- [ ] Marcar el odontograma (piezas y superficies).
- [ ] Crear un presupuesto con 2 ítems.
- [ ] Aceptar el presupuesto → verificar que se creó el plan de tratamiento.
- [ ] Registrar un pago parcial → verificar saldo.
- [ ] Enviar WhatsApp desde la ficha (wa.me link).
- [ ] Probar rol simulado (Recepción) y verificar que no ve notas clínicas.
- [ ] Probar rol simulado (Odontóloga) y verificar que sí ve notas.
- [ ] **Activar producción de email** (`RESEND_API_KEY`/`EMAIL_FROM` en Vercel + sacar el gate de sandbox en `/sandbox-email` para la clínica) — sin esto, confirmaciones/recordatorios/nps por email no salen.
- [ ] **Cargar horario del/los profesional/es** en `/profesionales` — sin esto la agenda no filtra disponibilidad real.
- [ ] **Configurar reglas de comisión** en `/comisiones` si la clínica paga por producción — si se deja sin configurar, el reporte de comisiones queda vacío, no falla, pero no sirve de nada hasta cargarlo.
- [ ] Confirmar que existe al menos un `consent_template` activo en `/consentimientos` antes de recibir el primer paciente que firme algo (el alta es self-service, no requiere SQL manual — es solo un recordatorio de que alguien tiene que crearlo).

### 3.2 Seguridad

- [ ] Ejecutar la auditoría de RLS: como user con rol `reception`, intentar leer `clinical_notes` por REST directo (debería devolver vacío o 401).
- [ ] Verificar que ningún endpoint `_serverFn/*` responde sin JWT válido.
- [ ] Confirmar CSP + headers en `curl -I https://alika.com`.

### 3.3 Performance

- [ ] Lighthouse desktop y mobile en la landing pública (target: >90 en Performance).
- [ ] Tiempo de dashboard con datos reales <2s.
- [ ] Verificar `getPatientBalance` no timeout con 100+ items (test con seed grande).

---

## Wave 4 — Launch soft

- [ ] Onboarding manual (con Walter presente) para 3-5 clínicas piloto.
- [ ] Canal Slack/Discord con las clínicas piloto para feedback rápido.
- [ ] Loop semanal de fixes basado en su uso real.
- [ ] Después de 4-6 semanas de piloto: onboarding self-service + Stripe checkout automatizado + landing pública abierta.

---

## Deferred (no bloquea el launch)

- Portal del paciente (`/portal/*`) — Opción C (URL firmada por wa.me) es lo más simple para v2.
- Fase 4B (Twilio API en vez de wa.me manual) — solo cuando alguna clínica lo pida.
- Fase 3C (facturación electrónica AEAT/SII/DIAN/etc) — pais por país según demanda.
- Landing pública SEO-optimizada — crearla cuando haya presupuesto de marketing.
- Mobile app nativa (React Native o Capacitor) — la PWA responsive es suficiente en v1.
