-- Wave A · fix perf #17 auditoría — listPatients O(P×A) → O(P)
--
-- Antes: listPatients traía TODAS las citas de la clínica (limit 5000) para
-- calcular en JS la última visita + próximo control por paciente. Con volumen
-- real (300 pacientes × ~20 citas/año año 2) revienta el cap y devuelve
-- "Sin visitas" silenciosamente. Además O(P×A) en Node.
--
-- Ahora: RPC que resuelve MAX(pasada) + MIN(futura) por paciente en Postgres,
-- aprovechando el índice appointments_clinic_patient_idx que ya existe.

-- appointments.status es enum `appointment_status`, no text. Postgres exige
-- que el RETURN TABLE lo declare exacto o falla con "structure of query
-- does not match function result type".
DROP FUNCTION IF EXISTS public.list_patients_with_last_and_next_appointment(uuid);

CREATE OR REPLACE FUNCTION public.list_patients_with_last_and_next_appointment(p_clinic_id uuid)
RETURNS TABLE (
  patient_id uuid,
  last_appointment_at timestamptz,
  last_appointment_status appointment_status,
  next_appointment_at timestamptz,
  next_appointment_status appointment_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_clinic_member(p_clinic_id) THEN
    RAISE EXCEPTION 'No tienes permisos sobre esta clínica.';
  END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT a.patient_id, a.starts_at, a.status
    FROM public.appointments a
    WHERE a.clinic_id = p_clinic_id AND a.status <> 'cancelada'
  ),
  ranked AS (
    SELECT
      s.patient_id,
      s.starts_at,
      s.status,
      s.starts_at < now() AS is_past,
      ROW_NUMBER() OVER (
        PARTITION BY s.patient_id, s.starts_at < now()
        ORDER BY CASE WHEN s.starts_at < now() THEN s.starts_at END DESC,
                 CASE WHEN s.starts_at >= now() THEN s.starts_at END ASC
      ) AS rn
    FROM scoped s
  )
  SELECT
    p.id AS patient_id,
    MAX(CASE WHEN r.is_past AND r.rn = 1 THEN r.starts_at END) AS last_appointment_at,
    (array_agg(r.status) FILTER (WHERE r.is_past AND r.rn = 1))[1] AS last_appointment_status,
    MAX(CASE WHEN NOT r.is_past AND r.rn = 1 THEN r.starts_at END) AS next_appointment_at,
    (array_agg(r.status) FILTER (WHERE NOT r.is_past AND r.rn = 1))[1] AS next_appointment_status
  FROM public.patients p
  LEFT JOIN ranked r ON r.patient_id = p.id
  WHERE p.clinic_id = p_clinic_id
  GROUP BY p.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_patients_with_last_and_next_appointment(uuid) TO authenticated;
