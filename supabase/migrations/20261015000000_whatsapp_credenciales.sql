-- Credenciales de WhatsApp por clínica (Tech Provider de Meta).
--
-- Al terminar el Embedded Signup, Meta entrega un token de negocio para la
-- cuenta de WhatsApp de esa clínica; con él se registra el número, se
-- suscribe el webhook, se crean las plantillas y se envía. También se
-- guarda el PIN de verificación en dos pasos del número (hace falta para
-- volver a registrarlo). Los dos van cifrados con AES-256-GCM por la app
-- (clave WHATSAPP_CREDENTIALS_KEY, fuera de la base).
--
-- RLS activada SIN políticas: ningún rol de la app (anon, authenticated)
-- puede leer ni escribir; solo el service role desde el servidor.

create table if not exists public.whatsapp_credentials (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  waba_id text not null,
  business_token_enc text not null,
  registration_pin_enc text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_credentials enable row level security;
revoke all on public.whatsapp_credentials from anon, authenticated;

drop trigger if exists whatsapp_credentials_updated_at on public.whatsapp_credentials;
create trigger whatsapp_credentials_updated_at
  before update on public.whatsapp_credentials
  for each row execute function public.set_updated_at();

comment on table public.whatsapp_credentials is
  'Token de negocio y PIN de WhatsApp por clínica, cifrados por la app. Solo service role.';
