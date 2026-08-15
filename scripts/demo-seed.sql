-- Datos de la clínica demo pública ("Clínica Demo Alika"). Idempotente:
-- borra y recrea todo lo de esta clínica cada vez que se corre, así sirve
-- tanto para el seed inicial como para un futuro job de reset periódico.
-- Las fechas de citas/pagos se calculan relativas a CURRENT_DATE, así que
-- la demo siempre se ve "viva" sin importar cuándo se ejecute este script.
--
-- Corre como el rol `postgres`/`service_role` (los triggers block_demo_writes
-- dejan pasar a esos dos roles — ver migración 20260815180000).
--
-- Uso: psql "$DATABASE_URL" -f scripts/demo-seed.sql

DO $$
DECLARE
  v_clinic_id uuid := '20cea989-de9b-4a3e-852a-31347dc3fe83';
  v_owner_id uuid := '139dd209-8495-415c-b6cd-6bbc63367bad'; -- demo@alika.app
  v_branch_id uuid := '15bc36fd-a2a7-4958-b948-71d1c236780d';
  v_prof1 uuid := '4225ac34-0a93-4e43-bc3e-8257f6dc2b58'; -- Dra. Camila Herrera
  v_prof2 uuid := '420b5812-3a85-40df-94b0-912382e66018'; -- Dr. Matías Reyes
  v_spec1 uuid := '675ed864-44dc-40b7-a493-775e9a3056f5';
  v_spec2 uuid := '3a97e519-53da-4b97-938c-2c7fdc956b5e';
  v_pat1 uuid := 'a6fdec35-556f-437d-8783-bc3636ef3e89'; -- Valentina Muñoz Soto
  v_pat2 uuid := 'fcfcc97f-ba1b-439c-afb3-25dd0a8b9354'; -- Benjamín Castro Vidal
  v_pat3 uuid := 'c219edc8-fb55-4992-b6f7-1752c33a4334'; -- Isidora Fuentes León
  v_pat4 uuid := 'cc191cb0-8c46-4a3e-ab76-9a6e702d8133'; -- Tomás Espinoza Bravo
  v_proc1 uuid := '06f851d4-4383-4f87-8711-bf13ca631e3f'; -- Control y limpieza
  v_proc2 uuid := 'ddd5945d-8056-4a98-8869-67815880d864'; -- Endodoncia
  v_proc3 uuid := '49f9fdfa-1986-410e-b0e9-4dddafc39c50'; -- Control de ortodoncia
  v_quote_id uuid := gen_random_uuid();
BEGIN
  -- Borrar todo lo previo de esta clínica (cascada por FK) para poder
  -- re-correr el script sin duplicar.
  DELETE FROM public.clinics WHERE id = v_clinic_id;

  INSERT INTO public.clinics (id, name, country, currency, timezone, onboarding_completed, created_by, is_demo)
  VALUES (v_clinic_id, 'Clínica Demo Alika', 'CL', 'CLP', 'America/Santiago', true, v_owner_id, true);

  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (v_clinic_id, v_owner_id, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.branches (id, clinic_id, name, address, city, timezone)
  VALUES (v_branch_id, v_clinic_id, 'Sucursal Providencia', 'Av. Providencia 1234', 'Santiago', 'America/Santiago');

  INSERT INTO public.specialties (id, clinic_id, name, color) VALUES
    (v_spec1, v_clinic_id, 'Odontología general', '#0d9488'),
    (v_spec2, v_clinic_id, 'Ortodoncia', '#8b5cf6');

  INSERT INTO public.professionals (id, clinic_id, branch_id, specialty_id, full_name, color) VALUES
    (v_prof1, v_clinic_id, v_branch_id, v_spec1, 'Dra. Camila Herrera', '#0d9488'),
    (v_prof2, v_clinic_id, v_branch_id, v_spec2, 'Dr. Matías Reyes', '#8b5cf6');

  INSERT INTO public.procedures (id, clinic_id, code, name, category, default_price_cents, currency, duration_min, created_by) VALUES
    (v_proc1, v_clinic_id, 'CTRL-01', 'Control y limpieza', 'Prevención', 35000, 'CLP', 30, v_owner_id),
    (v_proc2, v_clinic_id, 'END-01', 'Endodoncia', 'Endodoncia', 180000, 'CLP', 90, v_owner_id),
    (v_proc3, v_clinic_id, 'ORTO-01', 'Control de ortodoncia', 'Ortodoncia', 45000, 'CLP', 30, v_owner_id);

  INSERT INTO public.patients (id, clinic_id, branch_id, primary_professional_id, full_name, document_id, birth_date, phone, email, status, created_by) VALUES
    (v_pat1, v_clinic_id, v_branch_id, v_prof1, 'Valentina Muñoz Soto', '19.234.567-8', '1992-04-11', '+56 9 6123 4501', 'valentina.munoz@demo.alika.app', 'active', v_owner_id),
    (v_pat2, v_clinic_id, v_branch_id, v_prof2, 'Benjamín Castro Vidal', '18.345.678-9', '1988-09-23', '+56 9 6123 4502', 'benjamin.castro@demo.alika.app', 'active', v_owner_id),
    (v_pat3, v_clinic_id, v_branch_id, v_prof1, 'Isidora Fuentes León', '20.456.789-0', '2001-01-30', '+56 9 6123 4503', 'isidora.fuentes@demo.alika.app', 'new', v_owner_id),
    (v_pat4, v_clinic_id, v_branch_id, v_prof2, 'Tomás Espinoza Bravo', '17.567.890-1', '1979-12-05', '+56 9 6123 4504', 'tomas.espinoza@demo.alika.app', 'active', v_owner_id);

  -- Citas: 2 completadas la semana pasada, 2 hoy, 2 esta semana a futuro.
  INSERT INTO public.appointments (clinic_id, branch_id, patient_id, professional_id, treatment_label, starts_at, ends_at, status, created_by) VALUES
    (v_clinic_id, v_branch_id, v_pat1, v_prof1, 'Control y limpieza', (CURRENT_DATE - 6) + TIME '10:00', (CURRENT_DATE - 6) + TIME '10:30', 'finalizada', v_owner_id),
    (v_clinic_id, v_branch_id, v_pat2, v_prof2, 'Control de ortodoncia', (CURRENT_DATE - 3) + TIME '15:00', (CURRENT_DATE - 3) + TIME '15:30', 'finalizada', v_owner_id),
    (v_clinic_id, v_branch_id, v_pat3, v_prof1, 'Primera consulta', CURRENT_DATE + TIME '09:30', CURRENT_DATE + TIME '10:00', 'confirmada', v_owner_id),
    (v_clinic_id, v_branch_id, v_pat4, v_prof2, 'Control de ortodoncia', CURRENT_DATE + TIME '11:00', CURRENT_DATE + TIME '11:30', 'confirmada', v_owner_id),
    (v_clinic_id, v_branch_id, v_pat1, v_prof1, 'Endodoncia', (CURRENT_DATE + 2) + TIME '16:00', (CURRENT_DATE + 2) + TIME '17:30', 'tentativa', v_owner_id),
    (v_clinic_id, v_branch_id, v_pat2, v_prof2, 'Control de ortodoncia', (CURRENT_DATE + 4) + TIME '12:00', (CURRENT_DATE + 4) + TIME '12:30', 'confirmada', v_owner_id);

  -- Odontograma: un par de piezas marcadas para que se vea contenido real.
  INSERT INTO public.odontogram_marks (clinic_id, patient_id, tooth_number, surface, condition, recorded_by) VALUES
    (v_clinic_id, v_pat1, 16, 'oclusal', 'caries', v_owner_id),
    (v_clinic_id, v_pat1, 26, 'oclusal', 'obturacion', v_owner_id),
    (v_clinic_id, v_pat2, 46, 'whole', 'endodoncia', v_owner_id);

  -- Presupuesto → aceptado (el trigger convert_accepted_quote_to_plan crea
  -- el plan + items automáticamente al pasar a 'accepted').
  INSERT INTO public.quotes (id, clinic_id, patient_id, number, status, currency, subtotal_cents, total_cents, created_by)
  VALUES (v_quote_id, v_clinic_id, v_pat1, 'DEMO-0001', 'sent', 'CLP', 215000, 215000, v_owner_id);

  INSERT INTO public.quote_items (clinic_id, quote_id, procedure_id, name_snapshot, quantity, unit_price_cents, total_cents, position) VALUES
    (v_clinic_id, v_quote_id, v_proc1, 'Control y limpieza', 1, 35000, 35000, 1),
    (v_clinic_id, v_quote_id, v_proc2, 'Endodoncia', 1, 180000, 180000, 2);

  UPDATE public.quotes SET status = 'accepted' WHERE id = v_quote_id;

  -- Marcar el primer ítem del plan recién creado como completado (para que
  -- Finanzas > producción por profesional tenga algo que mostrar).
  UPDATE public.treatment_items ti
  SET status = 'completed', completed_at = now() - interval '2 days', professional_id = v_prof1
  FROM public.treatment_plans tp
  WHERE ti.plan_id = tp.id AND tp.quote_id = v_quote_id AND ti.name_snapshot = 'Control y limpieza';

  INSERT INTO public.payments (clinic_id, patient_id, amount_cents, currency, method, paid_at, notes, created_by)
  VALUES (v_clinic_id, v_pat1, 35000, 'CLP', 'debit_card', now() - interval '2 days', 'Pago control y limpieza', v_owner_id);
END $$;
