# CLAUDE.md — Alika

Guía para Claude Code cuando trabaja en este repositorio. Es el complemento del workspace raíz `~/Documents/CLAUDE.md` — este archivo es la fuente de verdad para lo específico de Alika.

## Qué es Alika

SaaS de gestión para clínicas dentales de LatAm (target CL/MX/CO/PE/AR). **Marca actual "Alika"** (rebrand tentativo desde "Oralia" tras auditoría de naming — `oralia.com` es ORALIA GmbH láser dental Alemania y `oralia.app` es SaaS francés). Nombre del proyecto en Lovable y del repo GitHub sigue siendo **"Aurora Dental OS"** por continuidad de sync — no renombrar ninguno de esos dos.

Importado de Lovable en ago-2026. Se sigue desarrollando desde este repo local; Lovable queda como editor visual secundario.

## Ubicaciones y accesos

| Qué | Dónde |
|---|---|
| Local | `~/Documents/05 - Aurora Dental OS/` (⚠️ **ruta con espacios y guión** — citar siempre entre comillas en shell) |
| GitHub | `walterlamadriz-ai/aurora-dental-os` rama `main` |
| Lovable editor | `https://lovable.dev/projects/9f5bde21-41b4-43c0-bc81-ea2215cab660` |
| Supabase (via Lovable Cloud) | proyecto `9f5bde21-41b4-43c0-bc81-ea2215cab660` — sin dashboard directo, acceso vía Lovable MCP `mcp__f132d7d4-*__query_database` |
| Doc maestro | `docs/Alika_Documento_Maestro_v1.md` |
| Plan por fases | `docs/PLAN_ACCION.md` |
| Runbook DR | `docs/DISASTER_RECOVERY.md` |
| Checklist launch | `docs/DEPLOY_PRODUCTION.md` |

## Correr en local

- **Preferido:** `preview_start({name: "alika"})` — entrada en `~/Documents/.claude/launch.json` puerto 8080.
- Directo: `npm run dev` desde el repo → puerto 8080 (Vite).
- Login owner de la clínica "clinica Patricia": `walterlamadriz@gmail.com` / password `Oralia2026Test!` (⚠️ **la contraseña sigue con "Oralia..."** — reseteada via SQL directo en Fase 1, no se cambió con el rebrand).
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
5. **Migraciones tienen dos pasos:** (a) archivo en `supabase/migrations/` versionado, (b) aplicar al Supabase real via `mcp__f132d7d4-*__query_database` con `project_id: "9f5bde21-41b4-43c0-bc81-ea2215cab660"`. Sin este segundo paso el schema queda desfasado.
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
  .middleware([requireSupabaseAuth])                    // JWT + inyecta context.supabase con RLS del user
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
- **Portal `/portal/*` pausado** — muestra "Muy pronto" hasta v2. Los archivos siguen en `src/routes/portal.*.tsx` pero el layout `portal.tsx` redirige.

## WhatsApp (Fase 4A)

Enfoque **wa.me sin proveedor** — cero costo. `sendWhatsAppFromTemplate` renderiza template + guarda `messages` con `status='sent'` + devuelve URL. Cliente hace `window.open(url, '_blank')` **dentro del click handler original** (política popup del browser). Fase 4B (Twilio API real) diferida hasta que una clínica lo pida.

## Herramientas críticas

- **Lovable MCP `query_database`**: SQL directo al Supabase con permisos service_role. Bypassea RLS, ideal para migraciones + seeds + inspección. `{ project_id: "9f5bde21-...", sql: "..." }`.
- **Password reset directo**: `UPDATE auth.users SET encrypted_password = crypt('nueva', gen_salt('bf')) WHERE email = '...'`.
- **Confirmar email sin recibir mail**: `UPDATE auth.users SET email_confirmed_at = now()` (autorizar caso por caso).
- **Preview**: `preview_start({name: "alika"})` reutiliza server si ya está corriendo. Warnings de hydration en HMR suelen ser cambio de source line — verificar con navegación real.

## Gotchas vigentes

- **`types.ts` divergente** — parcheado a mano. Si Lovable regenera desde su editor podría sobrescribir; confirmar antes de aplicar cambios de Lovable.
- **Password owner sigue "Oralia2026Test!"** — reseteada pre-rebrand.
- **Contraseña usa mixed-case** — cuidado al citarla.
- **Doble lockfile eliminado** — `bun.lock` fuera desde Fase 0, npm es el único.
- **Sub-sistema email/DNS ya construido** (`/dominio-email`, `/pruebas-email`, `/sandbox-email` + libs `dns-email.ts`, `email-preflight.ts`, `email-sandbox.ts`) — no re-inventar cuando llegue Fase 4B para envío por email.
- **Sentry en producción SOLO si `VITE_SENTRY_DSN` está seteado** — sin DSN el init es no-op silencioso.
- **Tabla `clinic_counters` + RPC `next_clinic_counter`** existen en Supabase real desde `bd88622`; el patrón se puede reusar para futuros correlativos (facturas, órdenes) con distinto `kind`.

## Antes de acciones destructivas

- **Nunca renombrar** carpeta local, repo GitHub, ni proyecto Lovable — todos siguen apuntando a "aurora-dental-os" por diseño.
- **Migraciones aplicadas al Supabase real no se pueden "rehacer"** — el archivo en `supabase/migrations/` es solo el historial versionado. Si equivocaste, escribir una migración correctiva nueva.
- **`.env` gitignoreado correctamente** — solo `SUPABASE_PUBLISHABLE_KEY` es pública. `SERVICE_ROLE_KEY` nunca en el repo.

## Referencias de memoria

- [`project_oralia_aurora_state.md`](../.claude/projects/-Users-walterlamadriz-Documents/memory/project_oralia_aurora_state.md) — cronología completa de commits + patrones históricos.
- [`oralia_audit_fase6.md`](../.claude/projects/-Users-walterlamadriz-Documents/memory/oralia_audit_fase6.md) — 17 findings de la auditoría multi-agente + estado de aplicación.
