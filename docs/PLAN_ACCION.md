# Oralia — Plan de acción

_Auditado y escrito el 2026-08-11, tras importar el proyecto de Lovable y correrlo en local._

## 1. Estado real (no el que sugiere la demo)

Se auditó el código, no solo el doc maestro. Diferencia importante entre lo que
**parece** funcionar navegando la demo y lo que **efectivamente** pega contra la
base de datos:

### Real, con backend Supabase + RLS, testeado

| Módulo | Evidencia |
|---|---|
| Auth + creación de clínica | `onboarding.tsx` real, `useQuery(["my-clinics"])` contra Supabase |
| Equipo y permisos | `clinic_members`, enum `app_role`, helpers `is_clinic_member` / `has_clinic_role` / `can_manage_clinic` (SECURITY DEFINER) |
| **Notas clínicas** | El módulo más maduro del proyecto: versionado inmutable, flujo de revisión/aprobación por par, extracción de entidades por IA, auditoría, export a PDF, comparador de versiones, **test de RLS en Vitest** (`tests/clinical-notes-rls.test.ts`) |
| Notificaciones | Realtime vía canal de Supabase, marcado de lectura |
| Compliance export | Consulta real sobre `clinical_note_audit` + `clinical_note_reviews`, export CSV/PDF |
| Dominio/email | Subsistema completo de verificación DNS, sandbox de envío, pruebas — construido para producción, no demo |

### Fachada — UI real, datos 100% hardcodeados, cero tabla en la base

| Ruta | Fuente de datos |
|---|---|
| `/dashboard` | `kpis`, `pacientes` desde `clinic-data.ts` |
| `/agenda` | `citas`, `profesionales` desde `clinic-data.ts` |
| `/pacientes`, `/pacientes/:id` | `getPaciente()` sobre el mismo fixture |
| `/tratamientos` | ídem |

`clinic-data.ts` (583 líneas) tiene un comentario literal: *"Fecha de referencia
del prototipo (jueves)"*. No existen las tablas `patients` ni `appointments` en
ninguna de las 13 migraciones. El propio doc maestro lo admite en la sección de
roadmap: *"MVP — implementado en este prototipo la capa de Agenda + Pacientes"*
se refiere a la capa visual, no a datos reales.

### No existe ni como boceto de código (solo visión en el doc maestro)

Odontograma/periodontograma, presupuestos, planes de tratamiento reales, caja/
facturación, inventario/compras, marketing/campañas, BI configurable, WhatsApp,
facturación electrónica por país, forecast, marketplace de integraciones.

**Conclusión:** no es "un MVP casi terminado al que le faltan módulos". Es un
**vertical productivo muy sólido (notas clínicas + equipo + compliance + email)**
envuelto en una **demo de agenda/pacientes sin persistencia real**. El primer
trabajo no es sumar módulos nuevos del roadmap — es reemplazar el fixture por
datos reales, porque todo lo demás (odontograma, presupuestos, IA de ausencias)
depende de que exista un paciente y una cita de verdad.

## 2. Decisiones ya tomadas (no bloquean, se documentan)

- **Marca = Oralia.** "Aurora Dental OS" es solo el nombre de proyecto en Lovable;
  en código, `.env`, doc maestro y la propia UI (`<title>Oralia`, logo) todo dice
  Oralia. `package.json` y `README.md` ya corregidos en este repo.
- **Un solo lockfile.** Se eliminó `bun.lock`; el proyecto usa `npm` (coincide
  con `vercel.json` → `installCommand: npm install`).
- **`.env` fuera de git.** El `.gitignore` de Lovable no lo excluía; corregido.
- El proyecto **corre en local** (`npm run dev`, puerto 8080) contra el Supabase
  que hostea Lovable (`jysoyttegoxynwrbgnlg`). Landing y login verificados
  visualmente, sin errores de consola.

## 3. Fases

### Fase 0 — Higiene (hecho en esta sesión)
- [x] Rename `package.json` → `oralia`
- [x] README real (estado, cómo correr, links)
- [x] `.gitignore` con `.env`
- [x] `launch.json` local para preview

### Fase 1 — Pacientes y Agenda reales ✅ código completo, ⚠️ pendiente de aplicar

**Hecho (2026-08-11):**
- Migración `supabase/migrations/20260811120000_...sql`: tablas `patients`,
  `appointments`, `waitlist_entries` + enums `patient_status`/`appointment_status`
  + columna `professionals.default_operatory_id`. RLS calcada del patrón
  existente (mismo set de roles que ya definía `patients:manage`/`agenda:manage`
  en `access.ts`).
- Server functions nuevas: `patients.functions.ts`, `appointments.functions.ts`,
  `waitlist.functions.ts`, `clinic-catalog.functions.ts` (branches/professionals,
  la tabla `professionals` ya existía pero nunca se había leído desde código).
- 4 rutas reescritas para leer datos reales: `dashboard.tsx`, `agenda.tsx`,
  `pacientes.index.tsx`, `pacientes.$pacienteId.tsx`. Con alta de paciente y de
  cita (diálogos simples, sin drag-and-drop todavía — tampoco lo tenía la demo).
- `saldo`/`riesgoAusencia`/`resumenIA` quedaron nullable y explícitamente
  "Sin datos" en vez de fabricar un 0% o un texto de IA falso.
- Guard de `/pacientes/:id` cambiado de `clinical:view` a `patients:view`
  (bug real que encontramos: bloqueaba a recepción de ver hasta el teléfono
  del paciente); las notas clínicas siguen gateadas por `clinical:view` aparte.
- `clinical_notes.patient_ref` no necesitó migración — ya era `text` libre.
- Typecheck (`tsc --noEmit`) y lint limpios en los 8 archivos nuevos/reescritos.
  `types.ts` (generado por Supabase) parcheado a mano con las tablas nuevas
  hasta que se pueda correr `supabase gen types` de verdad.

**⚠️ Bloqueador real — falta aplicar la migración:**
No tenemos `SUPABASE_DB_URL` ni `SUPABASE_SERVICE_ROLE_KEY` en este entorno, así
que la migración SQL está escrita pero **no aplicada** contra el Supabase que
hostea Lovable. Verificado en local: build, typecheck y landing/auth funcionan
contra el proyecto real; una cuenta de prueba se creó de punta a punta. Pero
`/dashboard`, `/agenda`, `/pacientes` van a fallar en runtime hasta que la
migración se aplique, porque las tablas no existen todavía. Dos formas de
desbloquear:
1. Pegar el contenido del `.sql` en el SQL Editor de Supabase (cero credenciales
   nuevas, la vía más simple).
2. Agregar `SUPABASE_DB_URL` al `.env` local (no compartido en el chat) para
   correr la migración por `psql`/CLI.

**Deliberadamente fuera de esta fase:** odontograma/periodontograma,
presupuestos, `treatment_plans` reales, inventario — igual que decía el punto 4
de la sección "Qué NO hacer todavía".

**Por qué primero:** notas clínicas ya cuelga de un `Paciente` — hoy ese
paciente es fake. Odontograma, presupuestos, IA de ausencias, timeline
unificado: todo lo del roadmap asume que `/pacientes/:id` es un registro real.

### Fase 2 — Historia clínica clínica completa
Con pacientes reales: odontograma versionado por pieza/superficie (tabla
`odontogram_states`, no blob — así lo pide el doc maestro para poder consultar
"piezas con caries no tratada hace 6 meses"), periodontograma, consentimientos
firmados. Se apoya en el patrón de versionado que ya existe en notas clínicas.

### Fase 3 — Dinero: presupuestos, tratamientos, caja
`treatment_plans` + `treatment_items` + catálogo de `procedures`, `quotes` con
aceptación y firma digital, pagos (online + registro manual), caja básica.
Este es el primer módulo con implicancia fiscal por país — revisar temprano
si conviene el mismo patrón de compliance que se usó en GastroCore 360
(VeriFactu para España, Openfactura para Chile) en vez de reinventar; LatAm
target inicial (CL/MX/CO/PE) tiene proveedores de facturación electrónica
distintos por país, así que esto es más trabajo de integración que de UI.

### Fase 4 — Inteligencia operativa
Predicción de ausencias con scoring, reagendamiento automático desde lista de
espera, optimización de agenda, WhatsApp como canal primario de confirmación
(el doc maestro lo marca como diferenciador #1 vs. competencia LatAm — no es
opcional para el mercado). Recién acá tiene sentido invertir en esto: antes no
hay agenda real sobre la cual predecir nada.

### Fase 5 — Inventario, marketing, BI
Consumo automático de insumos por procedimiento, campañas a "paciente perdido",
dashboards configurables. Menor urgencia — dependen de que exista actividad
real (tratamientos, citas) para tener datos que consumir.

### Fase 6 — Endurecimiento y operación
- Backups cifrados (patrón `age` + offsite ya usado en GastroCore 360,
  aplicable directo — acá hay PHI real, es requisito no opcional apenas haya
  clínicas reales usando el sistema)
- Auditoría multi-agente (patrón de 4 agentes UX/Perf/Seguridad/Correctitud que
  ya se usó en GastroCore) — recién tiene sentido correrla cuando haya código
  real que auditar en Fases 1-3, no sobre la demo actual
- Decisión Lovable sync: si se sigue editando desde el editor de Lovable en
  paralelo a este repo, hay que acordar una sola fuente de verdad para evitar
  conflictos (recomendado: local/GitHub como fuente de verdad, Lovable solo
  para prototipar UI nueva antes de portarla)
- Runner de migraciones para self-host (VPS) si se decide no depender de
  Supabase hosting de Lovable a largo plazo

### Fase 7 — Go-to-market
Ambiente de demo público con datos de ejemplo realistas (mismo patrón que
`demo_chile_data.php` de GastroCore), importadores desde Dentalink/Dentidesk/
Open Dental (diferenciador #2 del doc maestro: "la migración como producto"),
landing propia.

## 4. Qué NO hacer todavía

- No construir odontograma/presupuestos/inventario antes de que exista un
  paciente real — quedaría colgando de un fixture, doble trabajo.
- No correr auditoría de seguridad multi-agente sobre el código actual del
  fixture — no hay superficie real que auditar ahí, mejor gastar esos créditos
  después de la Fase 1-3.
- No migrar a self-host / Supabase propio todavía — no hay tráfico real que lo
  justifique y agrega fricción a la Fase 1.

## 5. Trabajo delegado en paralelo

Se despachó un agente (Plan) para diseñar el esquema técnico completo de la
Fase 1 (tablas `patients`/`appointments`, RLS, server functions, plan de
migración ruta por ruta, seed de datos). Su resultado se revisa antes de
ejecutar — evita improvisar el modelo de datos más importante del producto.
