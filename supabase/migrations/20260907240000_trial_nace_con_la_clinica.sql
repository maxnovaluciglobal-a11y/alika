-- El trial de 14 días que la landing promete desde siempre no existía: nada
-- creaba la fila en `subscriptions` salvo el webhook de Stripe, así que toda
-- clínica quedaba con sub === null y acceso ilimitado gratis para siempre.
--
-- Todo el andamiaje (isSubscriptionActive, trialDaysLeft, TrialBanner, el
-- gate del router) ya existía y estaba muerto por falta de esta fila.
--
-- Es un trigger y no un default por la misma razón que moneda_desde_la_clinica:
-- un trigger que escribe siempre hace imposible que un camino de alta se
-- olvide de crear el trial.

create or replace function public.crear_trial_de_la_clinica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (clinic_id, status, trial_end)
  values (new.id, 'trialing', now() + interval '14 days')
  on conflict (clinic_id) do nothing;
  return new;
end;
$$;

revoke all on function public.crear_trial_de_la_clinica() from public, anon;

create trigger clinics_crear_trial
  after insert on public.clinics
  for each row execute function public.crear_trial_de_la_clinica();

-- Las clínicas EXISTENTES no se tocan a propósito: hoy operan con sub === null
-- y convertirlas a trial es una decisión comercial, no técnica.
