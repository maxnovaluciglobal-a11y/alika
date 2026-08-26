-- Tier 2-G (parte 1, plan Dentidesk): liga el motivo de la cita al catálogo
-- de procedimientos que ya existe en Finanzas, en vez de quedar solo como
-- texto libre. Nullable y ON DELETE SET NULL: seguir sin elegir un
-- procedimiento del catálogo (texto libre puro) sigue siendo válido — esto
-- es una sugerencia estructurada, no una obligación.

ALTER TABLE public.appointments
  ADD COLUMN procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL;
