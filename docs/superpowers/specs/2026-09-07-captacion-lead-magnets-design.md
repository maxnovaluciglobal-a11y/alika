# Captación: lead magnets + trial de 14 días — Diseño

**Fecha:** 2026-09-07 · **Estado:** diseño aprobado, pendiente de ejecución
**Plan de ejecución:** `docs/superpowers/plans/2026-09-07-captacion-lead-magnets-plan.md`

---

## 1. Qué problema resuelve

Alika no tiene forma de captar un contacto. Hoy la superficie pública (`/`, `/faq`, `/demo`,
`/software-dental-latam`, `/docs/*`, `/nosotros`) **no tiene un solo formulario**: el único canal
es un `mailto:maxnovaluciglobal@gmail.com` repetido en 5 lugares. Un dentista que visita el sitio,
lo encuentra interesante y no está listo para registrarse, se va sin dejar rastro y no hay manera
de volver a hablarle.

Además, la landing promete un trial de 14 días que **no existe en el código**, y el andamiaje para
implementarlo ya está construido y sin usar.

Este trabajo entrega tres cosas, en orden de dependencia:

1. **Cimientos de captación** — dónde se guarda un lead y cómo entra sin abrir un agujero.
2. **Las herramientas** — la calculadora y el checklist que justifican dejar el contacto.
3. **El trial de 14 días** — cumplir la promesa que la landing ya hace.

---

## 2. Estado verificado del terreno

Todo lo de esta sección fue verificado leyendo el código en el commit `e18ebc0`, no inferido.

### 2.1 Lo que NO existe (y hay que construir)

| Pieza                                    | Verificación                                                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formulario de captura público            | `grep "<form"` en `src/routes/` → 2 resultados: `auth.tsx:195` (login) y `conversaciones.tsx:390` (dentro de la app). Cero en la superficie pública. |
| Tabla de lead sin clínica                | Las 57 tablas cuelgan de `clinics.id`. `whatsapp_leads.clinic_id` es `NOT NULL`.                                                                     |
| Escritura anónima en DB                  | **Cero policies `TO anon`, cero grants a `anon`.** `anon` está _revocado_ de los helpers de seguridad (migración `20260726161930`).                  |
| Analítica de producto                    | No hay PostHog/GA/GTM/Vercel Analytics. Los CTAs son `<a href>` sin instrumentar. **Hoy no se puede medir ninguna conversión.**                      |
| Antiabuso de formulario                  | No hay honeypot, CAPTCHA ni doble opt-in en todo el repo.                                                                                            |
| Envío de email a un desconocido          | `sendEmail()` existe (`email.server.ts:33`) pero exige `RESEND_API_KEY`; los dos únicos callers exigen `patientId` o `professionalId`.               |
| Costo directo / margen por procedimiento | `grep "margen                                                                                                                                        | margin | utilidad | rentabilidad"`en`src/` → cero ocurrencias de negocio. |
| Benchmarks de industria                  | `grep BENCHMARK` → 3 hits, todos en documentación aspiracional, ninguno en código.                                                                   |
| Tasa de no-show                          | El enum `appointment_status` tiene `'ausente'`, pero el panel de desempeño no lo mide.                                                               |

### 2.2 Bloqueantes que no dependen del código

- **`RESEND_API_KEY` y `EMAIL_FROM` no existen en Vercel producción.** Verificado con
  `vercel env ls production`: están `PORTAL_TOKEN_SECRET`, `CRON_SECRET`, Stripe y Supabase
  completos, y `NUMVERIFY_API_KEY`. Email no. **Alika no puede enviar un solo correo hoy.**
- **No hay dominio propio.** `SITE_URL` cae a `https://alika-omega.vercel.app` (`seo.ts:7`).
  Cadena de bloqueo: `comprar dominio → verificar en Resend → RESEND_API_KEY → entregar por email`.
  Mandar marketing desde un `vercel.app` va a spam de forma sistemática.

### 2.3 Restricciones de plataforma que condicionan el diseño

**La CSP prohíbe toda herramienta de marketing de terceros.** Desde el 06-sep la política se genera
por request con nonce en `router.tsx:34-49`: `script-src 'self' 'nonce-…'` y
`connect-src 'self' + *.supabase.co + *.sentry.io`. Consecuencia:

> Calendly, Typeform, HubSpot, Mailchimp, ConvertKit, GTM, Google Analytics y PostHog Cloud
> **no cargan**, ni por `<script>` ni por `fetch`. `form-action 'self'` también bloquea un
> `<form action="https://externo">`.

Relajar la CSP no es opción barata: `script-src 'self'` ya tumbó producción entera el 2026-08-15.
**Todo lo que se construya acá es same-origin o no funciona.**

**`public/` es CDN abierto.** Un PDF ahí es descargable por cualquiera que adivine la URL, sin
rate limit y sin posibilidad de condicionarlo a haber dejado el contacto. Para gatear un archivo
hay que servirlo desde un handler propio (patrón `sitemap[.]xml.ts:58-63`) o desde Storage con
URL firmada.

### 2.4 Lo que SÍ existe y se reusa

**Fórmulas financieras reales, puras y testeadas** (sin dependencia de Supabase, importables en
una página pública):

| Fórmula                                                  | Ubicación                              |
| -------------------------------------------------------- | -------------------------------------- |
| `netAfterRetention(amountCents, retentionPct)`           | `finance.ts:77`                        |
| `repartirCobertura(lineTotal, coverage, qty)`            | `finance.ts:156`                       |
| `resultCents = (netCents ?? totalCents) − expensesCents` | `finance-reports.functions.ts:231`     |
| `conversionRate = aceptados / (aceptados + rechazados)`  | `finance-reports.functions.ts:300`     |
| `tasaAsistencia`, `ocupacionPct`                         | `finance-reports.functions.ts:475-526` |
| `formatMoney` / `toCents` / `fromCents` / `pasoDeMoneda` | `finance.ts:508-603`                   |
| `MoneyInput` (habla cents, `currency` obligatoria)       | `src/components/money-input.tsx`       |
| `normalizeToWaMe` / `buildWaMeUrl`                       | `messaging.ts:163`                     |
| `validatePhoneNumber` (Numverify, nunca bloquea)         | `phoneValidation.ts:23`                |

**El andamiaje del trial, entero y muerto:** `subscriptions` tiene PK `clinic_id` (1:1 con la
clínica) con `status` y `trial_end`; `isSubscriptionActive()`, `trialDaysLeft()`, `TrialBanner` y
el gate del router ya saben leer un trial. **Nadie inserta la fila** — nada la crea al nacer la
clínica, sólo el webhook de Stripe. Por eso `sub === null` es el estado por defecto de toda
clínica y el acceso es ilimitado y gratuito para siempre.

**El patrón de escritura sin sesión**, con dos precedentes en producción (portal del paciente y
webhook de WhatsApp):

```
server function SIN requireSupabaseAuth
  → identidad probada por token/firma propia (no por JWT de Supabase)
  → escritura con supabaseAdmin (service_role, bypassea RLS)
  → filtros explícitos en el código
  → la tabla NO tiene GRANT INSERT para authenticated
```

`appointment_requests` es el molde exacto: `GRANT SELECT, UPDATE ... TO authenticated`, **sin
INSERT** (migración `20260814140000:35-36`).

**Rate limiting en dos capas:** en memoria por IP (`rate-limit.server.ts`, 60 req/min en `/api/`,
180 en `/_serverFn/`; _por instancia serverless_, documentado) y en DB contando filas
(`portal.functions.ts:366-381`, 3 solicitudes/paciente/24h). La segunda es la que sobrevive
reinicios y es consistente entre instancias.

### 2.5 Tensiones de producto que este diseño respeta

1. **La landing promete DOS veces "sin dar tu mail"** (`index.tsx:430` y `:654`). Es un
   diferenciador real contra Dentalink y Clinera, que exigen formulario. **La promesa es sobre la
   demo**, y se mantiene intacta: la demo sigue abierta y sin formulario.
2. **El documento maestro dice "sin llamada de ventas"** (recomendación 10: clínica operando en
   menos de 30 minutos desde el registro). El diseño no fuerza una demostración; ofrece valor y
   deja el contacto como intercambio voluntario.
3. **El documento maestro ya pedía esto**: recomendación 7 ("benchmarks anónimos de la industria
   por país") y 9 ("benchmarking de aranceles, demanda y rentabilidad por región, con
   consentimiento explícito"). El benchmark no es un agregado de marketing: estaba en la
   estrategia.

---

## 3. Decisiones tomadas

| #   | Decisión                   | Elegido                                                                                    |
| --- | -------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Qué mide la calculadora    | **P&L de la clínica + fugas recuperables**. No incluye margen por procedimiento.           |
| 2   | Cuándo se pide el contacto | **Resultado primero, contacto después.** El cálculo se ve completo sin dar nada.           |
| 3   | Canal de captura           | **Los dos**: WhatsApp (se usa ya) y email (queda guardado, se activa al cargar Resend).    |
| 4   | Gating                     | **Trial real de 14 días; demo pública intacta.** Se bloquean informes, nunca la operación. |

### Decisiones derivadas (no consultadas, se siguen de las anteriores)

- **No se construye margen por procedimiento** en este trabajo. Se registra como hueco conocido
  del producto (§7).
- **No se usa ninguna herramienta de terceros** (CSP). Formulario propio, endpoint propio,
  analítica propia.
- **Los benchmarks se muestran sólo donde haya fuente citable.** Donde no la haya, se muestra el
  número sin juicio de valor. Ver §5.2.4 y §8.

---

## 4. Principios de diseño

Estos principios salen de auditar lo que DypOS hizo bien y lo que le salió mal. Son las reglas que
gobiernan las decisiones chicas durante la implementación.

1. **No prometas en el lead magnet lo que el producto no entrega.** Si la calculadora muestra un
   indicador, el dentista tiene que encontrar ese mismo indicador dentro de Alika. Los rangos y
   fórmulas del lead magnet son los mismos del producto.
2. **Cumplimiento legal nunca se paywallea.** DypOS dejó la facturación fiscal fuera del gate por
   principio. En Alika el equivalente es más fuerte: historia clínica, notas firmadas y
   consentimientos informados **nunca** se bloquean. Son obligación de custodia del profesional.
3. **Operar siempre abierto; entender se activa.** El trial bloquea informes, no el trabajo diario.
4. **Buckets, nunca valores, en la analítica.** Se registra `margen_bucket: "bajo"`, jamás
   `margen: 4.2`. Son números de una clínica de salud.
5. **Un ratio anormalmente bueno no es "sano".** El semáforo tiene cuatro estados, no tres:
   `bajo` es informativo (azul), no verde — un costo de insumos del 3% significa que están midiendo
   mal, no que van bien.
6. **Ningún CTA de desbloqueo sin el mecanismo que desbloquea.** DypOS tiene hoy un botón
   "Recomendado" que agenda una llamada y no desbloquea nada: `onboarding_call_at` se lee en tres
   lugares y **no se escribe en ninguno** (verificado). No repetir.
7. **La UI no miente sobre la entrega.** Si el email falla, no decir "te lo mandamos". Mostrar el
   recurso en pantalla siempre, y el envío como extra.
8. **El contenido se versiona.** Nada de binarios huérfanos: el checklist de DypOS es un PDF sin
   HTML fuente ni script generador; para cambiar una coma hay que rehacerlo.

---

## 5. Arquitectura

### 5.1 Pieza 1 — Cimientos de captación

#### 5.1.1 Tabla `marketing_leads`

Primera tabla del schema que **no cuelga de una clínica**. Los helpers de RLS
(`is_clinic_member`, `has_clinic_role`, `can_manage_clinic`) asumen `clinic_id` y no aplican acá,
así que necesita su propia estrategia de acceso.

```sql
create table public.marketing_leads (
  id uuid primary key default gen_random_uuid(),

  -- Contacto. Al menos uno de los dos.
  email text,
  phone text,                    -- normalizado con normalizeToWaMe, sin '+'
  phone_valid boolean,           -- Numverify, null = no se pudo determinar
  name text,
  clinic_name text,
  country_code text,             -- CL | MX | CO | PE | AR (de COUNTRIES)

  -- Origen
  source text not null,          -- 'calculadora' | 'checklist' | 'benchmark'
  utm jsonb,                     -- source/medium/campaign/term/content + referrer

  -- Calificación: SOLO buckets, nunca cifras de la clínica
  meta jsonb,

  -- Consentimiento (§5.1.5)
  consent_at timestamptz not null default now(),
  consent_text text not null,    -- copia literal del texto aceptado
  unsubscribe_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  unsubscribed_at timestamptz,

  -- Entrega
  delivered_at timestamptz,
  delivery_error text,

  -- Técnicos (minimización: hash, no IP cruda)
  ip_hash text,
  user_agent text,
  submissions_count integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketing_leads_contacto_presente
    check (email is not null or phone is not null)
);

create unique index marketing_leads_email_key on public.marketing_leads (lower(email))
  where email is not null;
create unique index marketing_leads_phone_key on public.marketing_leads (phone)
  where phone is not null;
create index marketing_leads_created_idx on public.marketing_leads (created_at desc);
create index marketing_leads_ip_hash_idx on public.marketing_leads (ip_hash, created_at desc);

alter table public.marketing_leads enable row level security;
-- Sin GRANT a authenticated y sin policies: sólo service_role escribe y lee.
```

**Decisiones y su porqué:**

- **Índices únicos parciales sobre email y phone** → el mismo dentista que vuelve a usar la
  calculadora hace _upsert_, no una fila nueva. DypOS no tiene dedupe y genera duplicados +
  segundo email en cada recarga.
- **Índice sobre `ip_hash`** → el rate limit en DB lo usa. DypOS hace `WHERE ip = ?` sin índice.
- **`ip_hash` en vez de IP cruda** → minimización de datos. La IP sólo sirve para rate limit; el
  hash cumple esa función sin guardar un dato personal identificable.
- **`meta jsonb` en vez de texto** → consultable. DypOS guarda `"margen 4% · prime 73%"` en un
  `VARCHAR(255)` que hay que parsear a ojo. Con `jsonb` se puede filtrar "clínicas con margen bajo
  y muchos presupuestos sin cerrar" en SQL.
- **`consent_text` guarda la copia literal** → si el texto del formulario cambia, se sabe qué
  aceptó exactamente cada lead. Es la diferencia entre tener consentimiento y decir que se tiene.
- **RLS habilitada sin policies** → nadie con un JWT de usuario puede leer ni escribir. Sólo
  `service_role`. Es el mismo criterio que hace que `appointment_requests` no tenga
  `GRANT INSERT`.
- **La tabla NO va al trigger `block_demo_writes`** — no es una tabla de clínica, la demo no la
  toca.
- **La tabla SÍ va a `scripts/backup-tables.mjs`** — el test `backup-tables-sync.test.ts` parsea
  todos los `CREATE TABLE public.*` y **falla el CI nombrando la que falte**. Ya se olvidaron dos
  veces.

#### 5.1.2 Quién lee los leads

Alika no tiene concepto de "staff de la empresa": todos los roles son de clínica. Crear uno es
sobreingeniería para este trabajo.

**Solución:** una server function `listMarketingLeads` con `requireSupabaseAuth` que además
verifica que el email del usuario esté en `ALIKA_STAFF_EMAILS` (env var, lista separada por
comas). Sin la env var, la función devuelve error para todos. Lectura con `supabaseAdmin`.

Es el mismo espíritu que el gate `super_admin` de DypOS (que existe porque `demo_leads` no tiene
`restaurant_id` y un owner cualquiera vería los leads de todo el SaaS), resuelto sin agregar un rol
al schema.

#### 5.1.3 Server function `submitMarketingLead`

Sin `requireSupabaseAuth` — es el séptimo endpoint público del repo. Escribe con `supabaseAdmin`.

**Validación (Zod):**

```
email?      → z.string().email().max(254).optional()
phone?      → string, normalizado con normalizeToWaMe (defaultCountryCode por countryCode, NO "56")
name?       → max 120, trim
clinicName? → max 120, trim
countryCode → z.enum(["CL","MX","CO","PE","AR"])   // de COUNTRIES
source      → z.enum(["calculadora","checklist","benchmark"])
consent     → z.literal(true)                       // rechaza si no es exactamente true
consentText → string, max 500
meta        → objeto de buckets, whitelist de claves
utm         → objeto, whitelist de claves, cada valor max 100
company     → z.string().max(0)                     // HONEYPOT: debe venir vacío
+ al menos uno de email/phone (refine)
```

**Defensas, en orden:**

1. **Honeypot `company`** — si viene con contenido, devolver `{ok: true}` **fingiendo éxito** y no
   insertar. No darle señal al bot.
2. **Rate limit en DB por `ip_hash`** — máximo 5 en la última hora. Se hace con
   `select count(*) head:true` contra la propia tabla, igual que
   `portal.functions.ts:366-381`. **En DB, no en memoria**, porque la capa en memoria es por
   instancia serverless y no sirve como control real.
3. **Validación de formato solamente.** _No_ se hace lookup de MX ni DNS desde el endpoint público:
   el precedente de la casa es explícito — a `verificarDnsEmail` **le pusieron auth** justamente
   porque "era el único endpoint sin middleware y se prestaba a DoH-resolver gratuito y DoS"
   (`dns-email.functions.ts:16-31`). No reintroducir ese agujero.
4. **Numverify best-effort** para el teléfono: con timeout, nunca bloquea, `phone_valid = null` si
   falla. Igual que en el alta de pacientes.
5. **Upsert** por email (o por phone si no hay email), incrementando `submissions_count` y
   pisando `meta` con el resultado más reciente.

**Lo que el endpoint NO acepta nunca:** las cifras crudas del P&L de la clínica. Sólo los buckets
(§5.2.5). El servidor no tiene por qué saber cuánto factura una clínica que todavía no es cliente.

#### 5.1.4 Analítica mínima propia

PostHog está prohibido por CSP y no hay ninguna alternativa instalada. Sin medición no se puede
saber si esto convierte, así que se construye lo mínimo: `POST /api/ev` (same-origin, cubierto por
el rate limiter existente de `/api/`) que inserta en `marketing_events`:

```sql
create table public.marketing_events (
  id bigserial primary key,
  name text not null,           -- whitelist de 4 nombres
  props jsonb,                  -- sólo buckets y strings cortos, whitelist de claves
  session_hash text,            -- hash efímero, no cookie, no identifica persona
  created_at timestamptz not null default now()
);
```

Cuatro eventos, no más: `calculadora_vista`, `calculadora_usada` (con buckets),
`lead_enviado`, `cta_click` (con destino). Con eso se calcula la tasa de conversión del embudo, que
es lo único que hace falta decidir si la pieza sirve.

**Sin cookies, sin `identify()`, sin PII.** Si esto crece, se evalúa un PostHog self-hosted; no
antes.

#### 5.1.5 Consentimiento y bajas

DypOS resuelve el consentimiento con una línea de copy. Para Alika, con datos de profesionales de
la salud en LatAm, no alcanza:

- **Checkbox no premarcado**, obligatorio, con el texto del consentimiento visible al lado.
- **`consent_at` + `consent_text`** guardados en la fila.
- **`unsubscribe_token`** generado siempre, y ruta pública `/baja/$token` que setea
  `unsubscribed_at`. Existe desde el día 1, aunque todavía no se mande un solo mail.
- **Enlace al aviso de privacidad** (`/privacidad`, ya existe) desde el formulario.
- Consentimiento **separado** para email y para WhatsApp: aceptar recibir un informe por mail no es
  aceptar que te escriban por WhatsApp.

#### 5.1.6 Ley 21.719 de Chile — requisitos confirmados

Texto oficial leído desde la API de LeyChile (`idNorma=1209272`). **Publicada el 13-dic-2024;
entra en vigencia el 1 de diciembre de 2026** (art. primero transitorio: "el día primero del mes
vigésimo cuarto posterior a la publicación"). Faltan menos de tres meses, así que el formulario
tiene que nacer cumpliendo, no adaptarse después.

_Esto no es asesoría legal: sirve para diseñar el formulario, no para firmar el cumplimiento._

| Exigencia                                                                                                                                                                                                                                                                                      | Artículo                     | Qué implica en el formulario                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Consentimiento **libre, informado y específico en cuanto a su finalidad**, previo e inequívoco, por acto afirmativo                                                                                                                                                                            | Art. 12                      | Checkbox no premarcado. Una finalidad declarada por cada uso.                                                                      |
| **La carga de la prueba es del responsable**: "corresponde al responsable probar que contó con el consentimiento"                                                                                                                                                                              | Art. 12 inc. final           | Guardar timestamp, versión del texto aceptado y evidencia del acto. Es la razón por la que `consent_text` guarda la copia literal. |
| Revocación por medios "similares o equivalentes", **expeditos, fidedignos, gratuitos y permanentemente disponibles**                                                                                                                                                                           | Art. 12                      | Si el alta es un click, la baja también. `unsubscribe_token` + `/baja/$token` desde el día 1.                                      |
| **Aviso de privacidad con 12 ítems**, permanentemente accesible: política con **fecha y versión**, responsable, contacto, categorías, destinatarios, finalidades, **base de legitimidad**, medidas de seguridad, derechos, transferencias internacionales, **período de conservación**, origen | Art. 14 ter                  | `/privacidad` existe pero **hay que auditarla contra los 12 ítems**.                                                               |
| Informar **decisiones automatizadas y elaboración de perfiles**                                                                                                                                                                                                                                | Art. 14 ter l) y Art. 8° bis | **Aplica a este diseño**: guardamos buckets para calificar leads, y eso es elaboración de perfiles. Hay que declararlo.            |
| Oposición **incondicional** al marketing directo, sin contra-argumento posible                                                                                                                                                                                                                 | Art. 8° b)                   | La baja no se discute ni se retiene.                                                                                               |
| Minimización: sólo los datos "estrictamente necesarios" por defecto                                                                                                                                                                                                                            | Art. 14 quáter               | El teléfono va **opcional y con finalidad propia declarada**, no como campo obligatorio.                                           |
| Consentimiento **como única contraprestación** es la excepción válida a la presunción de "no libre"                                                                                                                                                                                            | Art. 12                      | Una calculadora gratis a cambio del contacto cae en la excepción — conviene decirlo explícito en el copy.                          |

**WhatsApp comercial:** el número pedido "para enviarte el resultado" no habilita prospección — es
otra finalidad. Checkbox **separado y opcional**: _"Quiero recibir novedades comerciales por
WhatsApp"_. Ya está en el diseño (`consent_whatsapp`).

> ⚠️ Pendiente de verificar: el art. 28 B de la Ley 19.496 (comunicaciones promocionales por email),
> que sigue vigente — la 21.719 sólo suprime el art. 15 bis de esa ley. Revisar antes de definir el
> flujo de email (Fase 4).

---

### 5.2 Pieza 2 — Las herramientas

#### 5.2.1 Ruta y ubicación

`/calculadora-rentabilidad-dental` — pública, indexable, en el sitemap con prioridad 0.8, enlazada
desde `/software-dental-latam` (la página GEO recién construida) y desde el footer.

Al agregarla hay que tocar, además del archivo de ruta:

- `src/routes/sitemap[.]xml.ts:25-37` (array `entries`, a mano)
- `src/components/site-chrome.tsx:39-45` — el tipo `FooterLink` tiene la unión de rutas **cerrada**;
  TypeScript falla sin actualizarla.
- `canonicalHead("/…")` de `src/lib/seo.ts` en el `head()`.

#### 5.2.2 Estructura del cálculo — dos bloques

**Bloque A — P&L de la clínica** (lo que pediste). Inputs mensuales, con `MoneyInput` y moneda
elegida por país:

| Input                            | Nota                                                    |
| -------------------------------- | ------------------------------------------------------- |
| Ingresos del mes                 | Todo lo facturado                                       |
| Honorarios de profesionales      | En LatAm suele ser % de producción — el costo principal |
| Sueldos del equipo de apoyo      | Recepción, asistentes                                   |
| Insumos y materiales clínicos    |                                                         |
| Laboratorio dental               |                                                         |
| Arriendo y gastos fijos          | Servicios, software, contador                           |
| Otros gastos variables           | Marketing, mantención                                   |
| % de retención de medios de pago | Default 0; el ejemplo real del producto es 2,95%        |

**Salida A:**

- Ingreso neto tras retención → **`netAfterRetention()` textual del producto**
- Utilidad y margen % → `resultCents = neto − gastos`, el mismo criterio de `getFinanceSummary`
- Distribución: cada rubro como % de ingresos
- Punto de equilibrio → costos fijos / ratio de contribución

**Bloque B — Fugas recuperables** (el gancho diferencial). Tres preguntas más:

| Input                              | Cálculo                                     | Por qué está                                                                   |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| Citas al mes + % de ausencias      | `citas × %ausencia × ticket promedio`       | Es la métrica satélite #1 del doc maestro y el dolor que Alika ataca           |
| Presupuestos emitidos + % aceptado | `emitidos × (referencia − actual) × ticket` | `conversionRate` es una métrica real del producto (`getQuoteConversionReport`) |
| Retención de medios de pago        | Ya calculada en el bloque A                 | Es plata que se va sin que nadie la mire; Alika la muestra hoy                 |

**Salida B:** "Estás dejando $X al mes en sillones vacíos y $Y en presupuestos que nadie siguió."

Los tres números salen de indicadores que **el producto sí calcula**, cumpliendo el principio 1.

#### 5.2.3 Coherencia con el producto

Cada indicador de la calculadora tiene su pantalla dentro de Alika, y eso se dice explícitamente en
el resultado ("esto lo ves actualizado en el panel de desempeño"):

| Indicador de la calculadora | Pantalla en Alika                             |
| --------------------------- | --------------------------------------------- |
| Ingreso neto tras retención | `/finanzas` (`getFinanceSummary`, `netCents`) |
| Resultado del período       | `/finanzas`                                   |
| Conversión de presupuestos  | `/finanzas` (`getQuoteConversionReport`)      |
| Ausencias / asistencia      | Panel de desempeño (`tasaAsistencia`)         |
| Ocupación de agenda         | Panel de desempeño (`ocupacionPct`)           |

#### 5.2.4 Semáforo y benchmarks — regla de honestidad

Cuatro estados: `sano` (verde) · `bajo` (azul, informativo) · `atención` (ámbar) · `alto` (rojo).
Cada uno con su ícono propio, no sólo color.

**El semáforo se enciende únicamente para los indicadores donde exista una fuente citable.** Para
los demás se muestra el número sin juicio ("tu costo de laboratorio es 9% de los ingresos") y se
ofrece comparación contra el objetivo que el propio dentista se fije.

Nota metodológica desplegable al pie, encuadrando los rangos como **referencia de industria**, con
la fuente y el año a la vista, y nunca como "promedio de N clínicas" — no existe esa base todavía.
La frase de DypOS que conviene conservar: _"Úsalos como brújula, no como sentencia."_

**Qué se puede mostrar y qué no — investigación cerrada (07-sep-2026):**

| Indicador                                      | Qué se puede afirmar                                                                                                                                 | Fuente                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Ausentismo / no-show**                       | ✅ **Semáforo habilitado. 10-30%, default 15%.** Media 15,2%, mediana 12,9% en revisión sistemática; 14,3% en estudio pediátrico sobre 7.379 visitas | Literatura revisada por pares (PubMed). Es el único indicador con respaldo académico real                             |
| **Overhead total y margen**                    | ✅ **Semáforo habilitado, sólo como referencia EE.UU.** ≈58% de overhead sin remunerar al dueño; ≈24% de margen del dueño sobre facturación bruta    | ADA Health Policy Institute, _2026 Survey of Dental Practice_ (ejercicio 2025), n=423/367. Dataset descargado y leído |
| **Ticket por visita**                          | ✅ Referencia EE.UU.: promedio US$576, mediana US$481                                                                                                | ADA HPI 2026, tabla 9, n=242. Ojo: es _por visita_ y _facturado_, no cobrado                                          |
| **% personal, insumos, laboratorio, arriendo** | 🔴 **PROHIBIDO mostrar con semáforo.** Ver abajo                                                                                                     | —                                                                                                                     |
| **Aceptación de presupuestos**                 | ⚠️ **Sin semáforo.** El 61% que circula es de 2016 y no se pudo verificar contra el informe original                                                 | Dental Economics/Levin 2016, vía DentistryIQ                                                                          |
| **Collection rate**                            | ⚠️ **Sin semáforo.** El "98% objetivo" es consenso de consultoras, sin muestra publicada                                                             | —                                                                                                                     |
| **Cualquier indicador para LatAm**             | 🔴 **No existe.** Sin dato confiable en Chile, México, Colombia, Perú ni Argentina                                                                   | Gremios, estadística oficial y literatura revisados: nada                                                             |

> 🔴 **Advertencia que hay que respetar sí o sí.** Las cifras por categoría que circulan por todos
> lados (25-30% personal, 5-6% insumos, 6-8% laboratorio, 6-7% arriendo) **se atribuyen al "ADA HPI"
> y esa atribución es falsa**: el ADA publica totales agregados y **no publica desglose por
> categoría**. Verificado descargando y leyendo el dataset. Usarlas citando al ADA sería publicar
> una fuente inventada en una herramienta pública. Si se quieren usar, es como "regla de
> consultores", sin respaldo institucional — y entonces no merecen semáforo.

**Regla operativa que se sigue de esto:**

1. El semáforo se enciende **sólo** en ausentismo, overhead total y margen.
2. Los indicadores con referencia de EE.UU. se muestran **etiquetados como tales**, con una nota de
   que no son transferibles a LatAm: el mix de seguros, el costo laboral y el de laboratorio son
   estructuralmente distintos.
3. El resto se muestra **sin juicio de valor**, y el visitante fija su propio objetivo.
4. **La ausencia de benchmark LatAm se dice en voz alta**, y es una razón honesta para pedirle el
   dato al usuario. Con el tiempo, y con consentimiento, eso construye el benchmark que hoy no
   existe — que es exactamente la recomendación 9 del documento maestro.

#### 5.2.5 Buckets que viajan al servidor

Lo único que sale del navegador:

```ts
meta = {
  margen_bucket: "perdida" | "bajo" | "medio" | "alto" | "na",
  ausencias_bucket: "bajo" | "medio" | "alto" | "na",
  conversion_bucket: "baja" | "media" | "alta" | "na",
  retencion_declarada: boolean, // si configuró % de medios de pago
  pais: "CL" | "MX" | "CO" | "PE" | "AR",
};
```

Nunca los montos. El cálculo entero ocurre en el cliente y no viaja.

#### 5.2.6 Arquitectura del código

**El cálculo va en un módulo puro con tests, separado de la UI.** DypOS tiene 896 líneas en un solo
archivo sin un solo test de sus fórmulas de dinero — y la auditoría del 04-sep encontró 3 bugs de
dinero en código recién construido de Alika. Estructura:

```
src/lib/marketing/calculadora.ts          ← funciones puras, sin React, sin Supabase
tests/calculadora-rentabilidad.test.ts    ← tests de las fórmulas (no tocan Postgres)
src/routes/calculadora-rentabilidad-dental.tsx  ← UI
```

Reglas de la casa que aplican con fuerza acá:

- `currency` **obligatoria** en toda función de dinero. CLP, COP y PYG tienen factor 1; MXN, PEN y
  ARS tienen 100. Una calculadora que hardcodee `/100` muestra números 100× mal en tres de los
  cinco países.
- `??` y nunca `||` para caer a un default: `0` es un valor legítimo en cada uno de estos inputs.
- Placeholders nullable, "Sin datos" en vez de `0` fabricado.

Accesibilidad: panel de resultados con `aria-live="polite"` y `aria-atomic="true"` (lo hace bien
DypOS), inputs `type="text"` + `inputMode="numeric"`, `tabular-nums`, y el estado del semáforo
comunicado por ícono además de color.

SEO/GEO: JSON-LD `WebApplication` + `BreadcrumbList` + **`FAQPage`** repitiendo las fórmulas — es la
mitad del valor de la página frente a buscadores generativos. Usar `faqJsonLdScript()` de
`seo.ts:63`, y respetar el gotcha documentado en `seo.ts:18-24` (el shape de `head().scripts` **no**
anida bajo `attrs`).

#### 5.2.7 El checklist: "15 fugas de dinero de una clínica dental"

**HTML versionado en el repo, no un PDF huérfano.** Se publica como página pública indexable
(`/recursos/fugas-clinica-dental`) usando el shell `LegalPage` que ya existe
(`src/components/legal-page.tsx`), y un script reproducible genera el PDF desde ese mismo HTML.

Ventaja doble sobre DypOS: es lead magnet **y** contenido SEO/GEO, y para corregir una palabra se
edita un `.tsx`, no se rehace un binario.

Aplicando results-first: **la página se lee gratis y completa**. El contacto se pide sólo para
llevarse el PDF, que se sirve desde un handler propio (no desde `public/`, que no se puede gatear).

Cada fuga es un problema del dueño que Alika resuelve, escrito sin nombrar la feature. Candidatas,
todas ancladas en módulos que existen: sillón vacío por ausencias · presupuestos aceptados que
nadie agendó · presupuestos enviados sin seguimiento · retención de medios de pago que nadie mira ·
convenios liquidados de memoria · laboratorio sin trazabilidad de costo ni fecha · insumos que se
consumen sin descontarse · stock sin conteo físico · comisiones calculadas a mano · historia
clínica en papel · recordatorios que dependen de que alguien se acuerde · pacientes que no vuelven
y nadie los llama.

#### 5.2.8 El benchmark

**No es un lead magnet aparte: es una capa dentro de la calculadora.** Mostrar dónde cae cada
indicador contra el rango de referencia, con la fuente visible.

El benchmark propio (el del doc maestro, recomendación 9) se construye con el tiempo y con
consentimiento explícito — no se puede prometer hoy porque no hay base. Cuando exista, la frase
cambia de "rango de referencia de la industria" a "comparado con N clínicas", y no antes.

---

### 5.3 Pieza 3 — El trial de 14 días

#### 5.3.1 Encender el andamiaje

```sql
-- Trigger AFTER INSERT ON clinics: la fila nace con la clínica.
create or replace function public.crear_trial_de_la_clinica() ...
  insert into public.subscriptions (clinic_id, status, trial_end)
  values (new.id, 'trialing', now() + interval '14 days')
  on conflict (clinic_id) do nothing;
```

Es la misma lección que `moneda_desde_la_clinica`: **un trigger que escribe siempre hace imposible
el olvido**, mientras que depender de que alguien inserte la fila garantiza que algún camino de
alta no lo haga.

Los 14 días viven en **una constante única** compartida (`TRIAL_DAYS`), no hardcodeados en dos
lugares como en DypOS (`SignupController.php:135` y `RestaurantController.php:43`).

**Las clínicas existentes no se tocan.** El trigger es `AFTER INSERT`; las clínicas piloto que hoy
operan con `sub === null` siguen igual. Convertirlas es una decisión comercial, no técnica, y se
hace a mano cuando se decida.

#### 5.3.2 Bug a corregir primero

```ts
export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub) return false;
  if (sub.status !== "trialing" && sub.status !== "active") return false;
  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) <= new Date()) return false;
  return true; // ← un trial con trial_end vencido y current_period_end null llega acá
}
```

**`isSubscriptionActive()` no mira `trial_end`.** Si se crea la fila `trialing` sin arreglar esto,
el trial vence en la fecha y el gate nunca dispara. Hay que contemplar `trialEnd` antes de que el
trigger exista, o el resto no funciona.

#### 5.3.3 Qué se bloquea y qué no

**Nunca se bloquea** (principio 2):

| Siempre abierto                                                       | Motivo                                           |
| --------------------------------------------------------------------- | ------------------------------------------------ |
| `clinical:view` / `clinical:write`, `/consentimientos`, `/compliance` | Obligación legal de custodia de la ficha clínica |
| `agenda:*`, `patients:*`, `/mi-agenda`                                | Operación diaria y el "aha" del producto         |
| `/tratamientos`, `/aranceles`                                         | Sin arancel no se puede presupuestar             |
| Exportar los datos                                                    | La landing lo promete como badge de confianza    |
| `/suscripcion`                                                        | Si no, loop infinito (DypOS lo resolvió igual)   |

**Se activa al día 15** — el insight, no el registro: `/finanzas`, `/comisiones`, `/gastos`,
`/medios-de-pago`, `/inventario`, `/laboratorios`, `/convenios`, y el panel de desempeño del
dashboard. Registrar un pago sigue funcionando; _ver el informe del mes_ es lo que se desbloquea.

`finance:view` lo tienen sólo `owner`, `admin` y `accounting`, así que el gate no toca al dentista
ni a recepción en su trabajo diario.

#### 5.3.4 Cómo se implementa el gate

Función pura, testeable sin DB, al estilo `isTrialLocked()` de DypOS:

```ts
export function trialInformesBloqueados(sub: Subscription | null): boolean {
  if (!sub) return false; // clínicas viejas: sin cambio
  if (sub.status !== "trialing") return false;
  if (sub.stripeSubscriptionId) return false; // ya puso tarjeta
  return !!sub.trialEnd && new Date(sub.trialEnd) <= new Date();
}
```

- **No se toca el redirect general** del router (`_clinic/route.tsx:70`), que sigue aplicando sólo a
  suscripciones `past_due`/`canceled`. El trial vencido **no expulsa** de la app.
- Las rutas de informes renderizan una **pantalla de desbloqueo** en lugar de su contenido.
- **Par en el servidor obligatorio** (regla 15 de la casa: el JWT vive en `localStorage`, cualquier
  miembro puede llamar una server function directo). El helper `requireFinanceView`
  (`finance-reports.functions.ts`) es el lugar natural para sumar el chequeo.

#### 5.3.5 La pantalla de desbloqueo

Copiando lo que DypOS hace bien y arreglando lo que hace mal:

- **Grilla de dos columnas: "Abierto en tu prueba" vs "Se activa al suscribirte."** Nunca esconder
  qué hay del otro lado — convierte mejor y no se siente trampa.
- Título personalizado según la pantalla que intentó abrir.
- Salida sin fricción: "Seguir usando Alika" vuelve a la agenda.
- **Sólo se ofrecen vías que funcionan de punta a punta.** Si se agrega "agendar una llamada", el
  mecanismo que efectivamente desbloquea tiene que existir antes que el botón (principio 6).

#### 5.3.6 El banner

`TrialBanner` ya renderiza días restantes y se pone urgente a ≤3 días. Hoy, con `sub === null`,
muestra _"Tienes acceso completo… primeros 14 días sin cargo"_ — un mensaje que se contradice a sí
mismo y que sigue igual el día 200. Con la fila creada, el banner empieza a decir la verdad solo.

---

## 6. Orden de ejecución

El orden está gobernado por dependencias reales, no por preferencia:

1. **Fase 0 — Cimientos.** Migración + server function + honeypot + rate limit + consentimiento +
   analítica mínima. Sin esto, cualquier herramienta que se construya no capta nada.
2. **Fase 1 — Calculadora.** Módulo puro con tests → UI → SEO → captura results-first.
3. **Fase 2 — Trial de 14 días.** No depende de las fases 0 ni 1; se puede hacer en paralelo, o
   primero si se prefiere entregar valor antes. Empieza por el fix de `isSubscriptionActive`.
4. **Fase 3 — Checklist.** Reusa toda la fase 0. Barato una vez que existen los cimientos.
5. **Fase 4 — Email.** Bloqueada por la compra del dominio y `RESEND_API_KEY`. El código queda
   listo y se enciende sin tocar nada más.

---

## 7. Lo que este trabajo NO hace

Explícito para que nadie lo asuma incluido:

- **No construye margen ni costo por procedimiento.** Las piezas existen
  (`procedure_supplies.quantity` × `applyYield` × `inventory_items.cost_cents` +
  `procedures.lab_cost_cents`) y falta la línea que las multiplica, pero es un hueco del producto,
  no de la captación. Queda registrado como deuda conocida.
- **No revive `precioPromedioPonderado()`** (`finance.ts:384`), escrita y testeada, que hoy no llama
  nadie.
- **No agrega tasa de no-show al panel de desempeño**, aunque el enum `'ausente'` exista y la
  calculadora sí la use como input del visitante.
- **No toca la demo pública.** Sigue abierta, completa y sin formulario.
- **No cambia el copy "sin dar tu mail"** de la landing: sigue siendo verdad.
- **No instala PostHog ni ninguna herramienta de terceros** (CSP).
- **No relaja la CSP** bajo ninguna circunstancia.
- **No convierte las clínicas piloto existentes a trial.**
- **No manda un solo email** hasta que exista dominio propio y `RESEND_API_KEY`.

---

## 8. Riesgos, bloqueantes y decisiones abiertas

| #   | Asunto                                       | Estado                                                                                                                                                                                                                                       |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Benchmarks con fuente citable**            | ✅ Cerrado (§5.2.4). Semáforo sólo en ausentismo, overhead y margen. **Cero datos para LatAm.** Las cifras por categoría atribuidas al ADA son una atribución falsa: no usarlas.                                                             |
| 2   | **Ley 21.719 (Chile)**                       | ✅ Cerrado (§5.1.6). **Entra en vigencia el 1-dic-2026** — menos de 3 meses. La carga de la prueba del consentimiento es nuestra. Falta auditar `/privacidad` contra los 12 ítems del art. 14 ter y verificar el art. 28 B de la Ley 19.496. |
| 2b  | **Perfilamiento declarado**                  | Guardar buckets para calificar leads **es elaboración de perfiles** (art. 8° bis y 14 ter l). Hay que declararlo en el aviso de privacidad. No es opcional.                                                                                  |
| 3   | **Dominio propio + `RESEND_API_KEY`**        | 🔴 Bloqueante de Walter. Bloquea sólo la Fase 4. Todo lo demás avanza sin esto.                                                                                                                                                              |
| 4   | **Sesión concurrente en el repo**            | ⚠️ Durante esta investigación apareció el commit `2b9d411` desde otra sesión. Quien ejecute esto **debe verificar el estado de `main` antes de empezar**, no asumir el que describe este documento.                                          |
| 5   | **El CI corre contra la base de producción** | ⚠️ Un test que dependa de una columna nueva deja el CI rojo hasta que alguien aplique la migración a mano. Los tests de la calculadora son de lógica pura y no tocan Postgres, a propósito.                                                  |
| 6   | **Rate limit en memoria es por instancia**   | Conocido y documentado en `rate-limit.server.ts:1-10`. Por eso el control real del formulario va en DB.                                                                                                                                      |
| 7   | **Numverify usa HTTP, no HTTPS**             | `phoneValidation.ts:33` — la API key viaja en claro. Es server-side, riesgo acotado, pero es deuda real preexistente. No se resuelve acá.                                                                                                    |

---

## 9. Cómo se verifica que funcionó

Ningún punto se da por hecho sin evidencia:

- **Migración**: aplicada al Supabase real y verificada consultando `pg_policies` y
  `information_schema`, no sólo por el archivo versionado.
- **Endpoint**: probado con curl real — honeypot lleno → `ok` sin fila; sin consentimiento → 422;
  sexto envío en una hora → 429; envío válido → fila con `consent_at` y `meta`; segundo envío del
  mismo email → `submissions_count = 2`, no fila nueva.
- **Fórmulas**: tests unitarios que fallan antes de escribir la implementación, incluyendo al menos
  un caso en moneda de cero decimales (CLP) y uno con decimales (MXN).
- **Trial**: verificado creando una clínica de prueba, comprobando que nace con `trial_end`,
  moviendo `trial_end` al pasado y confirmando que los informes se bloquean **y la agenda no**.
  Datos de prueba borrados después.
- **Accesibilidad**: verificada con navegación por teclado y con el resultado anunciado por lector
  de pantalla.
- **Página pública**: verificada en un preview deploy real, no sólo en local — el CSP y los headers
  de `vercel.json` no se prueban en el dev server.
