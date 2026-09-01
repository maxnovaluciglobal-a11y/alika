# CLAUDE.md — Alika

Guía para Claude Code cuando trabaja en este repositorio. Es el complemento del workspace raíz `~/Documents/CLAUDE.md` — este archivo es la fuente de verdad para lo específico de Alika.

## Qué es Alika

SaaS de gestión para clínicas dentales de LatAm (target CL/MX/CO/PE/AR). **Marca actual "Alika"** (rebrand tentativo desde "Oralia" tras auditoría de naming — `oralia.com` es ORALIA GmbH láser dental Alemania y `oralia.app` es SaaS francés). Nombre del proyecto en Lovable y del repo GitHub sigue siendo **"Aurora Dental OS"** por continuidad de sync — no renombrar ninguno de esos dos.

Importado de Lovable en ago-2026. Se sigue desarrollando desde este repo local; Lovable queda como editor visual secundario.

## Ubicaciones y accesos

| Qué                               | Dónde                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local                             | `~/Documents/05 - Alika/` (⚠️ **ruta con espacios y guión** — citar siempre entre comillas en shell)                                                                                                                                                                                                                                                                                                               |
| GitHub                            | `maxnovaluciglobal-a11y/aurora-dental-os` rama `main` (migrado desde `walterlamadriz-ai` el 2026-08-31; la URL vieja redirige)                                                                                                                                                                                                                                                                                     |
| Lovable editor                    | `https://lovable.dev/projects/9f5bde21-41b4-43c0-bc81-ea2215cab660`                                                                                                                                                                                                                                                                                                                                                |
| Supabase propio                   | proyecto `hvfkygoguxvpmwslrccb` en `sa-east-1` (São Paulo), org **MaxnovaLuci** (cuenta empresa, plan Pro — transferido desde la org personal el 2026-08-31; ref y keys sin cambios). Dashboard: https://supabase.com/dashboard/project/hvfkygoguxvpmwslrccb. Migrado desde Lovable Cloud el 2026-08-14 (ver `docs/SUPABASE_MIGRATION.md`). Acceso vía psql con pooler `aws-0-sa-east-1.pooler.supabase.com:5432`. |
| Supabase Lovable Cloud (huérfano) | proyecto `9f5bde21-41b4-43c0-bc81-ea2215cab660` — sigue existiendo por si hay que rollback; acceso vía `mcp__f132d7d4-*__query_database`. No borrar hasta que prod tenga 48hs corriendo en el propio.                                                                                                                                                                                                              |
| Doc maestro                       | `docs/Alika_Documento_Maestro_v1.md`                                                                                                                                                                                                                                                                                                                                                                               |
| Plan por fases                    | `docs/PLAN_ACCION.md`                                                                                                                                                                                                                                                                                                                                                                                              |
| Runbook DR                        | `docs/DISASTER_RECOVERY.md`                                                                                                                                                                                                                                                                                                                                                                                        |
| Checklist launch                  | `docs/DEPLOY_PRODUCTION.md`                                                                                                                                                                                                                                                                                                                                                                                        |
| Backups                           | `docs/BACKUPS_ALIKA.md` — automático diario (`.github/workflows/backup.yml`) pendiente de que Walter cargue 4 secrets; clave privada de cifrado en iCloud, no en el repo.                                                                                                                                                                                                                                          |

## Correr en local

- **Preferido:** `preview_start({name: "alika"})` — entrada en `~/Documents/.claude/launch.json` puerto 8080.
- Directo: `npm run dev` desde el repo → puerto 8080 (Vite).
- Login owner de la clínica "clinica Patricia": `walterlamadriz@gmail.com` — password rotada el 2026-08-15 (ver memoria `alika_auditoria_multiagente_2026_08_15.md`, no en el repo: este repo es público en GitHub).
- Paciente de prueba con datos reales: María Fernanda Torres, ID `d8db4f25-c160-4394-938a-3076282f66c4`.

## Stack

TanStack Start (SSR) + React 19 + Vite 8 + TypeScript + Tailwind 4 + shadcn/ui (48 componentes vendored en `src/components/ui/`) + Supabase (auth/DB/storage/realtime) + AI Gateway (Lovable → Gemini → OpenAI fallback) + Sentry v10 (no-op sin DSN).

**Sin dependencias pesadas evitadas a propósito:** no hay luxon (usar `Intl.DateTimeFormat`), no hay libphonenumber (regex LATAM propia), no hay Twilio (wa.me manual).

## Estado actual

Fases completas end-to-end contra DB real (para el detalle histórico + cronología de commits ver [`~/.claude/projects/-Users-walterlamadriz-Documents/memory/project_oralia_aurora_state.md`](../.claude/projects/-Users-walterlamadriz-Documents/memory/project_oralia_aurora_state.md)):

- **Fase 0-4A** — pacientes, agenda, odontograma versionado, presupuestos+planes, pagos+saldo, WhatsApp por wa.me.
- **Rebrand** Oralia → Alika (`fc02156`).
- **Fase 6 Tanda A** — hardening crítico RLS (PHI leak fix + trigger anti-duplicación + payments + DNS auth + saldo cancelled + tz dashboard).
- **Fase 6 Tanda B.1-B.4** — `/tratamientos` sobre datos reales + formatMoney zero-decimal + tz de citas por sucursal + correlativo atómico via RPC.
- **Prod hardening** (`13c2d27`) — portal pausado, docs de DR y deploy, Sentry, security headers, `.env.example` completo.

**Pendientes bloqueados en decisiones de Walter** (ver `docs/DEPLOY_PRODUCTION.md`): trademark check formal "Alika", compra de dominio, Vercel Pro, pricing decidido, 3-5 clínicas piloto confirmadas.

## Reglas obligatorias

1. **RLS en toda tabla nueva.** Usar helpers `is_clinic_member(clinic_id)`, `has_clinic_role(clinic_id, roles[])`, `can_manage_clinic(clinic_id)`. Ver `supabase/migrations/20260726*.sql` para la definición.
2. **`clinical_notes*` SOLO owner/admin/dentist/assistant.** `payments` excluye assistant. No revertir estas policies sin auditoría (ver `oralia_audit_fase6.md`).
3. **Nunca `git push --force` a main** — rompe el sync de Lovable (ver `AGENTS.md`). Nunca renombrar el repo GitHub ni el proyecto en Lovable.
4. **`types.ts` de Supabase se parchea a MANO** cuando agregás tabla/enum nuevo (no hay CLI configurado). Bloque `Row/Insert/Update/Relationships` + añadir al `Enums`.
5. **Migraciones tienen dos pasos:** (a) archivo en `supabase/migrations/` versionado, (b) aplicar al Supabase propio via `psql "postgresql://postgres.hvfkygoguxvpmwslrccb@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" -f <archivo>` con `PGPASSWORD` del `.env`. Sin este segundo paso el schema queda desfasado. (Legacy vía Lovable MCP sigue funcionando contra el proyecto huérfano, no usarlo salvo rollback).
6. **Dinero:** `bigint` cents. `formatMoney(cents, currency)` respeta ISO zero-decimal (CLP/PYG/COP/JPY/etc). Nunca dividir por 100 asumiendo.
7. **Fechas y timezones:** `hoyISO(timezone)` con `access.clinic?.timezone`, nunca sin argumento. `wallTimeInTzToUtc` en `appointments.functions.ts` es la referencia para interpretar `<input datetime-local>` en tz de la sucursal.
8. **Correlativos** (presupuestos, futuros): vía RPC atómica `next_clinic_counter(clinic_id, kind, year)`. Nunca `count(*)+1`.
9. **Nunca UPDATE de eventos versionados** (odontogram_marks, clinical_note_versions). Patrón: INSERT nueva fila + trigger SECURITY DEFINER cierra la anterior.
10. **Snapshots inmutables** cuando algo depende de catálogo: copiar `name_snapshot` + FK `ON DELETE SET NULL`. Renombrar catálogo no muta el histórico.
11. **Placeholders nullable en vez de fabricar cero:** `saldo`, `no_show_risk`, `ai_summary`. UI muestra "Sin datos" cuando null, no 0.

## Patrón de server function

```ts
// src/lib/*.functions.ts
export const doThing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]) // JWT + inyecta context.supabase con RLS del user
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // ...
  });
```

- **Error "No tienes permisos"** genérico cuando `error` viene de policy — no filtrar el motivo.
- **Evitar embedded `select('t(col)')`** cuando los tipos generados no lo pillen. Preferir 2 queries + `Map` (`clinicId` + `.in()`).
- **Todo `.update()` acepta `clinicId`** y lo agrega al `.eq()` como cinturón (RLS ya cubre, pero defensa en profundidad).

## UI

- Ficha del paciente `/pacientes/:id` es el hub: header con KPIs → NotasClinicas → Odontograma → FinanceSection (presupuestos+plan+pagos) → MessagesHistory → Timeline.
- Route guards en `beforeLoad: requirePermission("perm")`. Matriz en `src/lib/access.ts`.
- **Diálogos:** Radix Dialog + `useMutation` + `queryClient.invalidateQueries` + `toast` en `onSuccess`.
- **Simulación de rol** disponible para probar UI con otro rol sin cambiar user.
- **Portal `/portal/*` EN VIVO** (Wave C, commit `2a229c5` — reconstruido después de que Wave 1 lo pausara, sin gate). Sin login, expone datos de paciente a quien tenga el link JWT firmado. Bandeja de solicitudes en `/agenda` operativa. Rate limit: 3 solicitudes/paciente/24h.

## WhatsApp (Fase 4A + Fase 1 API + Fase 2 + Fase 3 + Fase 4)

**Fase 4A (base, wa.me manual):** `sendWhatsAppFromTemplate` renderiza template + guarda `messages` con `status='sent'` + devuelve URL. Cliente hace `window.open(url, '_blank')` **dentro del click handler original** (política popup del browser). Esto sigue siendo el fallback siempre disponible.

**Fase 1 (envío real por Cloud API):** arquitectura elegida es **Meta Cloud API directo** (Alika como Tech Provider, NO un BSP como Twilio/360dialog). `sendWhatsAppFromTemplate` intenta primero la API real (`sendMetaTemplateMessage` en `whatsapp.functions.ts`) si la clínica tiene `whatsapp_accounts.status='connected'` y la plantilla tiene `meta_status='approved'` — si cualquiera de esas dos condiciones falta, o el POST a Meta falla, cae automáticamente a wa.me. Nunca se bloquea el envío.

- **Conexión por clínica:** Embedded Signup en `/whatsapp` (`completeWhatsAppEmbeddedSignup`) — cada clínica trae su propio número, ningún token por clínica en la DB (un solo `WHATSAPP_SYSTEM_USER_TOKEN` a nivel app).
- **Webhook:** `src/routes/api.whatsapp-webhook.ts` — status callbacks (delivered/read/failed) + mensajes entrantes (SÍ confirma la próxima cita, BAJA/STOP corta `wa_opt_in`).
- **Cola de outreach (recall/reseña/saldo):** `listPendingOutreach` en `messaging.functions.ts`. Decisión de Walter: **NUNCA se manda solo desde un cron** — se calculan candidatos y el staff los despacha a mano en `/recordatorios`, igual que los recordatorios de 48h/3h. Filtrados por `patients.wa_opt_in` (outreach proactivo, no los recordatorios de cita que son transaccionales).
- **Sin infraestructura de links de pago/reseña todavía** (Stripe para clínicas es solo skeleton; no hay campo de Google Reviews) — los templates de `payment_due`/`review_request` NO prometen un link, piden responder o buscar la clínica en Google (ver migración `20260816140000`, corrigió el seed inicial).
- Env vars nuevas en `.env.example`: `WHATSAPP_APP_ID/_APP_SECRET/_SYSTEM_USER_TOKEN/_WEBHOOK_VERIFY_TOKEN/_API_VERSION` (server) + `VITE_WHATSAPP_APP_ID/_CONFIG_ID/_API_VERSION` (cliente, no son secretos). **Sin estas seteadas, todo sigue funcionando por wa.me manual** — no hay nada roto en producción hoy, solo no está habilitado el envío automático hasta que Walter se enrole como Tech Provider en Meta.

**Fase 2 (conversión — lista de espera, seguimiento de presupuestos, portal):** deliberadamente NO usa WhatsApp Flows nativo de Meta (requiere su propio producto/aprobación aparte) — reusa el portal de auto-agendamiento que ya existe (Wave C).

- **Lista de espera operativa** (`waitlist.functions.ts`): `createWaitlistEntry`/`removeWaitlistEntry` cierran el TODO "sin alta/baja todavía" que traía desde el 11-ago. Vincular a un paciente existente es lo normal — sin `patient_id` no hay teléfono y la fila no puede recibir el aviso. Botón "Avisar" en `/agenda` con kind `waitlist_opening`.
- **Seguimiento de presupuestos** (`quote_follow_up`): mismo patrón que la cola de outreach de Fase 1 (staff-aprobado, dedupe por `quote_id` no por paciente — un paciente puede tener 2 presupuestos pendientes a la vez). `quotes.status='sent'` hace +7 días, cooldown 14 días.
- **Helper compartido `tryMetaTemplateSend`** (`whatsapp.functions.ts`): extraído del bloque que antes vivía duplicado dentro de `sendWhatsAppFromTemplate`. Cualquier caller que ya resolvió un template (incluyendo `generatePortalLink`) lo llama para intentar la API real antes de wa.me.
- **`generatePortalLink` ahora registra en `messages`** — antes el link del portal (Wave C) nunca tocaba el historial del paciente, ni siquiera en el flujo wa.me. Ahora intenta la API real igual que todo lo demás y siempre deja rastro.

**Fase 3 (captación — leads de desconocidos):** el webhook ya no descarta en silencio un mensaje de un número que no coincide con ningún paciente (`applyInboundMessage` en `api.whatsapp-webhook.ts`). Deliberadamente NO se corren Click-to-WhatsApp Ads desde acá — eso vive en Meta Ads Manager, fuera del código; Alika solo controla qué pasa cuando alguien escribe.

- **Tabla `whatsapp_leads`** (no reusa `waitlist_entries` ni `messages` — ninguna de las dos puede representar a un desconocido sin ficha). `UNIQUE(clinic_id, phone)` hace que escribir varias veces sea un lead, no varios.
- **`sendMetaTextMessage`** (texto libre, sin plantilla): válido porque el desconocido acaba de abrir la ventana de servicio de 24h al escribir primero — a diferencia de todo lo de Fase 1/2, esto NO necesita que Meta apruebe nada, solo que haya un WABA conectado.
- **`isClinicOpenNow`** (`whatsapp.ts`): decide la auto-respuesta según `branches.opens_at/closes_at` — solo se manda una vez por lead, no en cada mensaje.
- **Verificado E2E simulando el webhook** con firma HMAC válida contra un WABA de prueba insertado a mano (sin credenciales reales de Meta no hay forma de generar tráfico real) — confirmado: lead creado con los datos correctos, idempotencia (mismo remitente no duplica), y el intento de auto-respuesta contra Graph API falla limpiamente sin tumbar el request. Datos de prueba borrados después.

**Fase 4 (comunidad — cumpleaños, seguimiento post-tratamiento, referidos):** deliberadamente NO se fabricó contenido clínico específico por tipo de procedimiento (blanqueamiento, ortodoncia, etc.) — eso es consejo de salud que debería redactar un dentista, no algo para inventar. `treatment_followup` es genérico y categoría `utility` (transaccional a una visita real), no marketing.

- **`patients.referral_code`**: 6 hex uppercase, único por clínica, generado por trigger `generate_patient_referral_code()` (BEFORE INSERT, con reintento si hay colisión) — cualquier camino de alta de paciente lo recibe sin acordarse de generarlo a mano.
- **`ReferralCodeCard`** (ficha del paciente): código copiable + link wa.me pre-armado que apunta al **WhatsApp de la clínica** (no del paciente) con el código ya en el texto. El paciente reenvía el link, un amigo lo abre y le escribe a la clínica con el código adentro.
- **`findReferrerByCode`** (webhook): detecta un token de 6 hex como palabra suelta en el primer mensaje de un lead nuevo (Fase 3) y lo valida contra `patients.referral_code` de esa clínica — conecta el referido solo, sin acción extra del staff. `whatsapp_leads.referred_by_patient_id` guarda el vínculo.
- **`birthday_greeting`**: match de mes/día contra `patients.birth_date`, cooldown 300 días (no repetir en el mismo año). **`treatment_followup`**: `treatment_items.status='completed'` hace 2-10 días, un candidato por paciente (el más reciente). **`referral_invite`**: solo a pacientes con al menos una cita `finalizada` (mismo gate que `hygiene_recall`), cooldown 90 días.
- **Verificado E2E contra Supabase real**: cumpleaños vía `birth_date` temporal (revertido), referidos vía una cita temporalmente marcada `finalizada` (revertida) — ambos con datos reales de "clinica Patricia", no fabricados desde cero. Envío de `referral_invite` confirmado con `{codigo}` renderizado en el mensaje real. Webhook simulado con el código real de una paciente resolvió `referred_by_patient_id` correctamente en un lead nuevo. Todo dato sintético borrado después.

## Herramientas críticas

- **Lovable MCP `query_database`**: SQL directo al Supabase con permisos service_role. Bypassea RLS, ideal para migraciones + seeds + inspección. `{ project_id: "9f5bde21-...", sql: "..." }`.
- **Password reset directo**: `UPDATE auth.users SET encrypted_password = crypt('nueva', gen_salt('bf')) WHERE email = '...'`.
- **Confirmar email sin recibir mail**: `UPDATE auth.users SET email_confirmed_at = now()` (autorizar caso por caso).
- **Preview**: `preview_start({name: "alika"})` reutiliza server si ya está corriendo. Warnings de hydration en HMR suelen ser cambio de source line — verificar con navegación real.

## Gotchas vigentes

- **`types.ts` divergente** — parcheado a mano. Si Lovable regenera desde su editor podría sobrescribir; confirmar antes de aplicar cambios de Lovable.
- **Nunca commitear passwords en texto plano** — este repo es público en GitHub. La password de la cuenta de prueba vive en memoria privada, no acá.
- **Doble lockfile eliminado** — `bun.lock` fuera desde Fase 0, npm es el único.
- **Sub-sistema email/DNS ya construido** (`/dominio-email`, `/pruebas-email`, `/sandbox-email` + libs `dns-email.ts`, `email-preflight.ts`, `email-sandbox.ts`) — no re-inventar cuando llegue Fase 4B para envío por email.
- **Sentry en producción SOLO si `VITE_SENTRY_DSN` está seteado** — sin DSN el init es no-op silencioso.
- **⚠️ Cambios en `vercel.json` (headers/CSP/redirects) NO se prueban en local** — el dev server (`npm run dev`) no aplica esos headers, solo el deploy de Vercel. Verificar SIEMPRE en un preview deploy real. El CSP con `script-src 'self'` (sin `'unsafe-inline'`) tumbó producción entera el 2026-08-15 porque bloqueaba los scripts inline de hidratación de TanStack Start — ver memoria `alika_csp_incident`. Hoy el CSP usa `'unsafe-inline'`; la versión robusta con nonce quedó pendiente.
- **Tabla `clinic_counters` + RPC `next_clinic_counter`** existen en Supabase real desde `bd88622`; el patrón se puede reusar para futuros correlativos (facturas, órdenes) con distinto `kind`.

## Antes de acciones destructivas

- **Naming**: la carpeta local pasó a `05 - Alika/` el 2026-08-31. El repo GitHub **sigue siendo `aurora-dental-os`** — renombrarlo necesita rol admin en la org, que `walterlamadriz-ai` no tiene (es colaborador `write`). La restricción vieja de "nunca renombrar por Lovable" **ya no aplica**: Alika se desacopló de Lovable, ver `docs/DESACOPLE_LOVABLE.md`.
- **Migraciones aplicadas al Supabase real no se pueden "rehacer"** — el archivo en `supabase/migrations/` es solo el historial versionado. Si equivocaste, escribir una migración correctiva nueva.
- **`.env` gitignoreado correctamente** — solo `SUPABASE_PUBLISHABLE_KEY` es pública. `SERVICE_ROLE_KEY` nunca en el repo.

## Referencias de memoria

- [`project_oralia_aurora_state.md`](../.claude/projects/-Users-walterlamadriz-Documents/memory/project_oralia_aurora_state.md) — cronología completa de commits + patrones históricos.
- [`oralia_audit_fase6.md`](../.claude/projects/-Users-walterlamadriz-Documents/memory/oralia_audit_fase6.md) — 17 findings de la auditoría multi-agente + estado de aplicación.
