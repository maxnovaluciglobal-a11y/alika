-- Tier 3-L (parte 1): firma manuscrita en la aprobación de un presupuesto.
-- Complementa la evidencia que ya se guardaba (accepted_by_name + accepted_ip
-- + accepted_user_agent, ver 20260822120100): ahora también la firma real del
-- paciente, capturada en pantalla al aceptar. Nullable — aceptar sin firma
-- sigue siendo válido (queda la evidencia de IP/nombre como antes). La firma
-- se guarda en el bucket privado clinical-documents que ya existe.

ALTER TABLE public.quotes
  ADD COLUMN accepted_signature_path text;

COMMENT ON COLUMN public.quotes.accepted_signature_path IS
  'Path en storage (bucket clinical-documents) de la firma manuscrita capturada al aceptar el presupuesto. Evidencia de consentimiento junto con accepted_by_name/accepted_ip/accepted_at.';
