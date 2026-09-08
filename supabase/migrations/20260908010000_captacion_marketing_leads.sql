-- Captación de leads de marketing (calculadora, checklist, benchmark).
--
-- PRIMERA tabla del schema que NO cuelga de una clínica: un dueño de clínica
-- que usa la calculadora todavía no es cliente y no tiene clinic_id. Por eso
-- los helpers is_clinic_member/has_clinic_role NO aplican acá.
--
-- Estrategia de acceso: RLS habilitada y CERO policies. Nadie con un JWT de
-- usuario puede leer ni escribir; sólo service_role (que bypassea RLS) desde
-- las server functions. Es el mismo criterio por el que appointment_requests
-- no tiene GRANT INSERT para authenticated.

create table public.marketing_leads (
  id uuid primary key default gen_random_uuid(),

  -- Contacto: al menos uno de los dos (ver constraint abajo).
  email text,
  phone text,
  phone_valid boolean,
  name text,
  clinic_name text,
  country_code text,

  source text not null,
  utm jsonb,

  -- Calificación. SOLO buckets ("margen_bucket":"bajo"), nunca cifras de la
  -- clínica: el servidor no tiene por qué saber cuánto factura alguien que
  -- todavía no es cliente.
  meta jsonb,

  -- Consentimiento: se guarda el texto literal aceptado, no sólo un booleano.
  -- Si el copy del formulario cambia, seguimos sabiendo qué aceptó cada lead.
  consent_at timestamptz not null default now(),
  consent_text text not null,
  consent_whatsapp boolean not null default false,
  unsubscribe_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  unsubscribed_at timestamptz,

  delivered_at timestamptz,
  delivery_error text,

  -- Minimización: la IP sólo sirve para rate limit, así que guardamos el hash
  -- y no el dato personal.
  ip_hash text,
  user_agent text,
  submissions_count integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketing_leads_contacto_presente
    check (email is not null or phone is not null),
  constraint marketing_leads_source_valido
    check (source in ('calculadora', 'checklist', 'benchmark')),
  constraint marketing_leads_pais_valido
    check (country_code is null or country_code in ('CL', 'MX', 'CO', 'PE', 'AR'))
);

-- Únicos parciales: el mismo dentista que vuelve hace upsert, no fila nueva.
create unique index marketing_leads_email_key
  on public.marketing_leads (lower(email)) where email is not null;
create unique index marketing_leads_phone_key
  on public.marketing_leads (phone) where phone is not null;
create index marketing_leads_created_idx
  on public.marketing_leads (created_at desc);
-- El rate limit consulta por (ip_hash, created_at): sin este índice escanea.
create index marketing_leads_ip_hash_idx
  on public.marketing_leads (ip_hash, created_at desc);

create trigger marketing_leads_set_updated_at
  before update on public.marketing_leads
  for each row execute function public.set_updated_at();

alter table public.marketing_leads enable row level security;

-- Embudo mínimo propio: la CSP prohíbe PostHog/GA y sin medición no sabemos
-- si esto convierte. Sin cookies, sin identify, sin PII.
create table public.marketing_events (
  id bigserial primary key,
  name text not null,
  props jsonb,
  session_hash text,
  created_at timestamptz not null default now(),

  constraint marketing_events_name_valido
    check (name in ('calculadora_vista', 'calculadora_usada', 'lead_enviado', 'cta_click'))
);

create index marketing_events_name_created_idx
  on public.marketing_events (name, created_at desc);

alter table public.marketing_events enable row level security;
