-- La demo puede mostrar la pantalla de efectividad (F5).
--
-- Hallazgo que motivó esto: /efectividad se veía vacía en la clínica demo
-- justo en sus dos métricas estrella, y NO era un bug de la pantalla. Eran dos
-- cosas distintas del seed:
--   (a) las citas pasadas quedaban en 'confirmada', que no es un desenlace —
--       nadie marcó si el paciente vino— así que se excluían con razón;
--   (b) los recordatorios sembrados no llevaban `appointment_id`, que es de
--       donde se deduce a qué cita se le avisó. El emisor real SÍ lo setea
--       (`messaging.functions.ts:274,373`) y `listPendingReminders` depende de
--       eso para deduplicar: el hueco era del seed, no del producto.
--
-- Se reemplaza `reset_demo_clinic()` agregando un bloque al final. Los cortes
-- son deterministas para que la demo cuente la misma historia en cada reset, y
-- las tasas son verosímiles (ausentismo global ~15%) en vez de espectaculares:
-- una demo que promete un efecto irreal se cae en la primera reunión.

CREATE OR REPLACE FUNCTION public.reset_demo_clinic()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_clinic_id uuid := '20cea989-de9b-4a3e-852a-31347dc3fe83';
  v_owner_id uuid := '139dd209-8495-415c-b6cd-6bbc63367bad'; -- demo@alika.app
  v_branch1 uuid := '15bc36fd-a2a7-4958-b948-71d1c236780d'; -- Providencia
  v_branch2 uuid := 'fdb43d6b-d729-4b05-8ade-4d1fc4c8775c'; -- Las Condes
  v_spec1 uuid := '675ed864-44dc-40b7-a493-775e9a3056f5'; -- Odontología general
  v_spec2 uuid := '3a97e519-53da-4b97-938c-2c7fdc956b5e'; -- Ortodoncia
  v_spec3 uuid := '60cab2bb-f95c-4bc2-8b34-842220b9edd8'; -- Endodoncia
  v_prof1 uuid := '4225ac34-0a93-4e43-bc3e-8257f6dc2b58'; -- Dra. Camila Herrera (general, Providencia)
  v_prof2 uuid := '420b5812-3a85-40df-94b0-912382e66018'; -- Dr. Matías Reyes (ortodoncia, Providencia)
  v_prof3 uuid := 'f9d50f69-f388-4c70-b8fa-a696c836d02d'; -- Dra. Fernanda Rojas (endodoncia, Las Condes)
  v_prof4 uuid := '0a8686ac-b0f0-45cd-a979-fa771556e18b'; -- Dr. Ignacio Soto (general, Las Condes)
  v_proc_ctrl uuid := '06f851d4-4383-4f87-8711-bf13ca631e3f'; -- Control y limpieza
  v_proc_endo uuid := 'ddd5945d-8056-4a98-8869-67815880d864'; -- Endodoncia
  v_proc_orto uuid := '49f9fdfa-1986-410e-b0e9-4dddafc39c50'; -- Control de ortodoncia
  v_proc_brackets uuid := 'be5bd813-3f48-4d46-bafc-167c0308668c';
  v_proc_extraccion uuid := 'a1e64c2d-0af9-4ecb-a6ff-729dd2d9e43a';
  v_proc_blanqueamiento uuid := '1b4ba87b-06f5-4837-8dc8-a43f28297d9e';
  v_proc_resina uuid := '9c7b685f-f0f5-4545-a436-707ab9fbb256';
  v_proc_corona uuid := '06deafd2-b7ab-4d3d-962f-ee0bdf0e5c29';
  v_pat_valentina uuid := 'a6fdec35-556f-437d-8783-bc3636ef3e89';
  v_pat_benjamin uuid := 'fcfcc97f-ba1b-439c-afb3-25dd0a8b9354';
  v_pat_isidora uuid := 'c219edc8-fb55-4992-b6f7-1752c33a4334';
  v_pat_tomas uuid := 'cc191cb0-8c46-4a3e-ab76-9a6e702d8133';
  v_pat_josefina uuid := '48bde616-c68f-40e7-96a2-c24a4284d884';
  v_pat_agustin uuid := '3cdeb639-b2eb-41e7-be29-f891bd33d03a';
  v_pat_martina uuid := '883710d6-0a45-40f9-af00-3e9a3bb7cb99';
  v_pat_diego uuid := 'b1be0ba9-21ef-4974-ba7c-507cbee62d43';
  v_pat_antonia uuid := 'c71a5018-16d5-46a0-9b70-4eb34847a4b8';
  v_pat_sebastian uuid := '16313759-44d2-46c9-84cb-5899a606de34';
  v_agreement uuid := 'd2a2c010-2895-4df5-a931-cfa05de54cb0';
  v_lab uuid := 'e51d03e5-03e5-4a95-b3b6-0d852c79ff43';
  v_perio_chart uuid := '9d52109c-d039-4bad-8962-2c88a470896d';
  v_quote_valentina uuid := '12cce1ab-1aef-4219-afc9-b127a343bf3a';
  v_quote_josefina uuid := '733619ca-54eb-4e86-a62b-cbeadd4aafbd';
  v_quote_benjamin uuid := 'aa216cff-d8f1-4d35-8f68-2b3a00dc390e';
  v_quote_isidora uuid := '842430b0-cc2a-4a6e-af81-a89c9371c910';
  v_quote_agustin uuid := '3721f72f-3c96-41e5-957a-e503108e4c57';
  v_note_valentina uuid := '3389572e-31f2-4b74-8e88-9081cce6b752';
  v_note_benjamin uuid := '16615b68-c7de-4664-b4e4-f12791ca0a08';
  v_note_josefina uuid := '644aff70-f2a2-4bc2-b9c8-1821b6979e96';
  v_note_tomas uuid := 'e8ea2fa9-c171-459f-b6d9-3a66925eab3c';
  v_ver_valentina uuid := '98207264-8ea5-4f36-b1a7-fed579fbd0c5';
  v_ver_benjamin uuid := '1c0c2aeb-ae18-462b-9d50-e60991e740f6';
  v_ver_josefina uuid := 'da7f76d0-721f-413b-ae21-88073c9325ca';
  v_ver_tomas uuid := 'a998d9e4-d257-48be-86d6-5b7e3f6a1971';
  v_wh_general uuid;
  v_wh_condes uuid := '7a1e5c90-4f2b-4a3d-9c81-5b0e2d7f3a11';
  v_item_guantes uuid := '2c9f4b71-8e05-4d6a-b3f2-1a7c9e04d582';
  v_item_anestesia uuid := 'b4d81f2a-6c37-4e59-8b1d-0f3a6e295c74';
  v_item_resina uuid := '5e7a0c39-1b84-42fd-9a6e-c8d13f507b26';
  v_item_fresas uuid := '9f2b6d14-3a75-4c08-be91-72d5a0e83f4c';
  v_item_sutura uuid := 'a3c50e87-2d19-4b6f-83ac-e17b940d652f';
  v_item_alginato uuid := 'd816f4b2-95c0-4a73-b2e8-3f60c179ad45';
  v_item_brackets uuid := '6b0d92e5-7f43-41a8-95c2-8e4a1d07f3b9';
  v_item_barreras uuid := 'c72e18a0-4b96-4d35-a7f1-90b6e2c45d83';
  v_plan_valentina uuid := 'e04a7d63-8c21-4f97-b5d0-16a3e8b29c47';
  v_plan_josefina uuid;
  v_today date := CURRENT_DATE;
BEGIN
  DELETE FROM public.clinics WHERE id = v_clinic_id;

  INSERT INTO public.clinics (id, name, country, currency, timezone, onboarding_completed, created_by, is_demo)
  VALUES (v_clinic_id, 'Clínica Demo Alika', 'CL', 'CLP', 'America/Santiago', true, v_owner_id, true);
  -- handle_new_clinic() (trigger AFTER INSERT en clinics) ya deja sembrados
  -- clinic_members (owner) y las 13 plantillas de mensajería por su cuenta.

  INSERT INTO public.branches (id, clinic_id, name, address, city, timezone) VALUES
    (v_branch1, v_clinic_id, 'Sucursal Providencia', 'Av. Providencia 1234', 'Santiago', 'America/Santiago'),
    (v_branch2, v_clinic_id, 'Sucursal Las Condes', 'Av. Apoquindo 4500', 'Santiago', 'America/Santiago');

  INSERT INTO public.specialties (id, clinic_id, name, color) VALUES
    (v_spec1, v_clinic_id, 'Odontología general', '#0d9488'),
    (v_spec2, v_clinic_id, 'Ortodoncia', '#8b5cf6'),
    (v_spec3, v_clinic_id, 'Endodoncia', '#f97316');

  INSERT INTO public.professionals (id, clinic_id, branch_id, specialty_id, full_name, color) VALUES
    (v_prof1, v_clinic_id, v_branch1, v_spec1, 'Dra. Camila Herrera', '#0d9488'),
    (v_prof2, v_clinic_id, v_branch1, v_spec2, 'Dr. Matías Reyes', '#8b5cf6'),
    (v_prof3, v_clinic_id, v_branch2, v_spec3, 'Dra. Fernanda Rojas', '#f97316'),
    (v_prof4, v_clinic_id, v_branch2, v_spec1, 'Dr. Ignacio Soto', '#0ea5e9');

  INSERT INTO public.procedures (id, clinic_id, code, name, category, default_price_cents, duration_min, created_by) VALUES
    (v_proc_ctrl, v_clinic_id, 'CTRL-01', 'Control y limpieza', 'Prevención', 35000, 30, v_owner_id),
    (v_proc_endo, v_clinic_id, 'END-01', 'Endodoncia', 'Endodoncia', 180000, 90, v_owner_id),
    (v_proc_orto, v_clinic_id, 'ORTO-01', 'Control de ortodoncia', 'Ortodoncia', 45000, 30, v_owner_id),
    (v_proc_brackets, v_clinic_id, 'ORTO-02', 'Instalación de brackets', 'Ortodoncia', 850000, 60, v_owner_id),
    (v_proc_extraccion, v_clinic_id, 'CIR-01', 'Extracción simple', 'Cirugía', 55000, 30, v_owner_id),
    (v_proc_blanqueamiento, v_clinic_id, 'EST-01', 'Blanqueamiento dental', 'Estética', 120000, 60, v_owner_id),
    (v_proc_resina, v_clinic_id, 'OPE-01', 'Resina / obturación', 'Operatoria', 48000, 45, v_owner_id),
    (v_proc_corona, v_clinic_id, 'PRO-01', 'Corona dental', 'Prótesis', 250000, 60, v_owner_id);
  -- moneda_desde_la_clinica (BEFORE INSERT) fija currency='CLP' desde
  -- clinics.currency — no se pasa acá a propósito (regla #14 del CLAUDE.md).

  INSERT INTO public.patients (id, clinic_id, branch_id, primary_professional_id, full_name, document_id, birth_date, phone, email, status, created_by) VALUES
    (v_pat_valentina, v_clinic_id, v_branch1, v_prof1, 'Valentina Muñoz Soto', '19.234.567-8', '1992-04-11', '+56 9 6123 4501', 'valentina.munoz@demo.alika.app', 'active', v_owner_id),
    (v_pat_benjamin, v_clinic_id, v_branch1, v_prof2, 'Benjamín Castro Vidal', '18.345.678-9', '1988-09-23', '+56 9 6123 4502', 'benjamin.castro@demo.alika.app', 'active', v_owner_id),
    (v_pat_isidora, v_clinic_id, v_branch1, v_prof1, 'Isidora Fuentes León', '20.456.789-0', '2001-01-30', '+56 9 6123 4503', 'isidora.fuentes@demo.alika.app', 'new', v_owner_id),
    (v_pat_tomas, v_clinic_id, v_branch1, v_prof2, 'Tomás Espinoza Bravo', '17.567.890-1', '1979-12-05', '+56 9 6123 4504', 'tomas.espinoza@demo.alika.app', 'active', v_owner_id),
    (v_pat_josefina, v_clinic_id, v_branch2, v_prof3, 'Josefina Vargas Contreras', '16.678.901-2', '1995-06-18', '+56 9 6123 4505', 'josefina.vargas@demo.alika.app', 'active', v_owner_id),
    (v_pat_agustin, v_clinic_id, v_branch2, v_prof4, 'Agustín Morales Peña', '15.789.012-3', '1985-03-02', '+56 9 6123 4506', 'agustin.morales@demo.alika.app', 'active', v_owner_id),
    (v_pat_martina, v_clinic_id, v_branch2, v_prof4, 'Martina Silva Torres', '21.890.123-4', '2003-11-27', '+56 9 6123 4507', 'martina.silva@demo.alika.app', 'new', v_owner_id),
    (v_pat_diego, v_clinic_id, v_branch1, v_prof1, 'Diego Fernández Rojas', '14.901.234-5', '1972-08-14', '+56 9 6123 4508', 'diego.fernandez@demo.alika.app', 'inactive', v_owner_id),
    (v_pat_antonia, v_clinic_id, v_branch1, v_prof2, 'Antonia Pizarro Núñez', '19.012.345-6', '1998-02-09', '+56 9 6123 4509', 'antonia.pizarro@demo.alika.app', 'active', v_owner_id),
    (v_pat_sebastian, v_clinic_id, v_branch2, v_prof3, 'Sebastián Guzmán Leiva', '13.123.456-7', '1990-07-21', '+56 9 6123 4510', 'sebastian.guzman@demo.alika.app', 'active', v_owner_id);

  -- Agenda: -9 a +10 días, todos los estados, ambas sucursales.
  INSERT INTO public.appointments (clinic_id, branch_id, patient_id, professional_id, treatment_label, starts_at, ends_at, status, created_by) VALUES
    (v_clinic_id, v_branch1, v_pat_valentina, v_prof1, 'Control y limpieza', v_today - 9 + TIME '10:00', v_today - 9 + TIME '10:30', 'finalizada', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_benjamin, v_prof2, 'Control de ortodoncia', v_today - 8 + TIME '15:00', v_today - 8 + TIME '15:30', 'finalizada', v_owner_id),
    (v_clinic_id, v_branch2, v_pat_josefina, v_prof3, 'Endodoncia', v_today - 7 + TIME '11:00', v_today - 7 + TIME '12:30', 'finalizada', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_diego, v_prof1, 'Extracción simple', v_today - 6 + TIME '09:30', v_today - 6 + TIME '10:00', 'ausente', v_owner_id),
    (v_clinic_id, v_branch2, v_pat_agustin, v_prof4, 'Resina / obturación', v_today - 5 + TIME '16:00', v_today - 5 + TIME '16:45', 'finalizada', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_antonia, v_prof2, 'Control de ortodoncia', v_today - 4 + TIME '10:30', v_today - 4 + TIME '11:00', 'cancelada', v_owner_id),
    (v_clinic_id, v_branch2, v_pat_martina, v_prof4, 'Primera consulta', v_today - 3 + TIME '09:00', v_today - 3 + TIME '09:30', 'finalizada', v_owner_id),
    (v_clinic_id, v_branch2, v_pat_sebastian, v_prof3, 'Control y limpieza', v_today - 2 + TIME '14:00', v_today - 2 + TIME '14:30', 'finalizada', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_tomas, v_prof2, 'Control de ortodoncia', v_today - 1 + TIME '15:30', v_today - 1 + TIME '16:00', 'finalizada', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_valentina, v_prof1, 'Blanqueamiento dental', v_today + TIME '09:00', v_today + TIME '10:00', 'confirmada', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_isidora, v_prof1, 'Primera consulta', v_today + TIME '11:00', v_today + TIME '11:30', 'confirmada', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_benjamin, v_prof2, 'Instalación de brackets', v_today + 1 + TIME '10:00', v_today + 1 + TIME '11:00', 'confirmada', v_owner_id),
    (v_clinic_id, v_branch2, v_pat_josefina, v_prof3, 'Control post endodoncia', v_today + 1 + TIME '12:00', v_today + 1 + TIME '12:30', 'confirmada', v_owner_id),
    (v_clinic_id, v_branch2, v_pat_agustin, v_prof4, 'Corona dental', v_today + 2 + TIME '16:30', v_today + 2 + TIME '17:30', 'confirmada', v_owner_id),
    (v_clinic_id, v_branch2, v_pat_martina, v_prof4, 'Resina / obturación', v_today + 3 + TIME '09:30', v_today + 3 + TIME '10:15', 'tentativa', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_antonia, v_prof2, 'Control de ortodoncia', v_today + 3 + TIME '11:00', v_today + 3 + TIME '11:30', 'confirmada', v_owner_id),
    (v_clinic_id, v_branch2, v_pat_sebastian, v_prof3, 'Extracción simple', v_today + 4 + TIME '15:00', v_today + 4 + TIME '15:30', 'tentativa', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_tomas, v_prof2, 'Control de ortodoncia', v_today + 5 + TIME '15:30', v_today + 5 + TIME '16:00', 'confirmada', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_valentina, v_prof1, 'Endodoncia', v_today + 6 + TIME '16:00', v_today + 6 + TIME '17:30', 'tentativa', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_isidora, v_prof1, 'Control y limpieza', v_today + 7 + TIME '10:00', v_today + 7 + TIME '10:30', 'tentativa', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_benjamin, v_prof2, 'Control de ortodoncia', v_today + 8 + TIME '15:00', v_today + 8 + TIME '15:30', 'tentativa', v_owner_id),
    (v_clinic_id, v_branch2, v_pat_josefina, v_prof3, 'Control y limpieza', v_today + 9 + TIME '11:00', v_today + 9 + TIME '11:30', 'tentativa', v_owner_id),
    (v_clinic_id, v_branch1, v_pat_diego, v_prof1, 'Control y limpieza', v_today + 10 + TIME '09:30', v_today + 10 + TIME '10:00', 'tentativa', v_owner_id);

  INSERT INTO public.odontogram_marks (clinic_id, patient_id, tooth_number, surface, condition, recorded_by) VALUES
    (v_clinic_id, v_pat_valentina, 16, 'oclusal', 'caries', v_owner_id),
    (v_clinic_id, v_pat_valentina, 26, 'oclusal', 'obturacion', v_owner_id),
    (v_clinic_id, v_pat_benjamin, 46, 'whole', 'endodoncia', v_owner_id),
    (v_clinic_id, v_pat_josefina, 36, 'whole', 'endodoncia', v_owner_id),
    (v_clinic_id, v_pat_josefina, 37, 'oclusal', 'caries', v_owner_id),
    (v_clinic_id, v_pat_agustin, 14, 'mesial', 'obturacion', v_owner_id),
    (v_clinic_id, v_pat_agustin, 46, 'whole', 'corona', v_owner_id),
    (v_clinic_id, v_pat_diego, 18, 'whole', 'ausente', v_owner_id),
    (v_clinic_id, v_pat_diego, 48, 'whole', 'ausente', v_owner_id),
    (v_clinic_id, v_pat_antonia, 11, 'vestibular', 'sano', v_owner_id);

  INSERT INTO public.periodontal_charts (id, clinic_id, patient_id, notes, recorded_by)
  VALUES (v_perio_chart, v_clinic_id, v_pat_sebastian, 'Sondaje inicial, leve inflamación gingival generalizada.', v_owner_id);

  INSERT INTO public.periodontal_measurements (clinic_id, chart_id, tooth_number, point, pocket_depth_mm, bleeding, mobility, furcation) VALUES
    (v_clinic_id, v_perio_chart, 16, 'mv', 3, true, NULL, NULL),
    (v_clinic_id, v_perio_chart, 16, 'dv', 2, false, NULL, NULL),
    (v_clinic_id, v_perio_chart, 26, 'mv', 4, true, NULL, NULL),
    (v_clinic_id, v_perio_chart, 36, 'whole', NULL, NULL, 1, NULL),
    (v_clinic_id, v_perio_chart, 46, 'whole', NULL, NULL, 0, 1);

  -- Notas clínicas SOAP firmadas — no hay trigger que cree la versión sola
  -- (la app siempre inserta ambas filas, ver clinical-notes.functions.ts),
  -- así que acá también hay que insertar las dos por nota.
  INSERT INTO public.clinical_notes (id, clinic_id, patient_ref, patient_name, title, content, summary, status, created_by) VALUES
    (v_note_valentina, v_clinic_id, v_pat_valentina::text, 'Valentina Muñoz Soto', 'Control y limpieza',
     E'S: Paciente sin molestias, refiere sensibilidad leve al frío en pieza 1.6.\nO: Placa bacteriana moderada. Pieza 1.6 con caries oclusal incipiente. Pieza 2.6 con obturación en buen estado.\nA: Caries oclusal 1.6, indicación de obturación. Resto de la boca en buen estado periodontal.\nP: Profilaxis realizada. Se agenda resina para pieza 1.6. Se refuerza técnica de cepillado.',
     'Profilaxis + diagnóstico de caries en 1.6, se agenda obturación.', 'signed', v_owner_id),
    (v_note_benjamin, v_clinic_id, v_pat_benjamin::text, 'Benjamín Castro Vidal', 'Control de ortodoncia',
     E'S: Paciente refiere molestia leve tras el último ajuste, ya cedió.\nO: Alineación progresando según lo planificado. Sin lesiones en mucosa.\nA: Evolución favorable del tratamiento de ortodoncia, mes 4 de 18.\nP: Ajuste de arco realizado. Próximo control en 4 semanas.',
     'Control de ortodoncia mes 4, evolución favorable.', 'signed', v_owner_id),
    (v_note_josefina, v_clinic_id, v_pat_josefina::text, 'Josefina Vargas Contreras', 'Endodoncia pieza 3.6',
     E'S: Dolor pulsátil de 3 días de evolución en pieza 3.6, cede parcialmente con analgésicos.\nO: Pieza 3.6 con caries profunda, prueba de vitalidad positiva y dolorosa. Radiografía sin lesión periapical evidente.\nA: Pulpitis irreversible pieza 3.6.\nP: Se inicia tratamiento de endodoncia. Instrumentación de los 3 conductos, medicación intraconducto. Se cita para obturación de conductos en 7 días.',
     'Endodoncia 3.6 iniciada por pulpitis irreversible, continúa en próxima cita.', 'signed', v_owner_id),
    (v_note_tomas, v_clinic_id, v_pat_tomas::text, 'Tomás Espinoza Bravo', 'Control de ortodoncia',
     E'S: Sin molestias.\nO: Buena higiene oral, brackets en buen estado.\nA: Evolución favorable.\nP: Ajuste de rutina. Continúa control mensual.',
     'Control de rutina, sin novedades.', 'signed', v_owner_id);

  INSERT INTO public.clinical_note_versions (id, note_id, clinic_id, version, title, content, summary, ai_assisted, ai_action, author_id) VALUES
    (v_ver_valentina, v_note_valentina, v_clinic_id, 1, 'Control y limpieza',
     E'S: Paciente sin molestias, refiere sensibilidad leve al frío en pieza 1.6.\nO: Placa bacteriana moderada. Pieza 1.6 con caries oclusal incipiente. Pieza 2.6 con obturación en buen estado.\nA: Caries oclusal 1.6, indicación de obturación. Resto de la boca en buen estado periodontal.\nP: Profilaxis realizada. Se agenda resina para pieza 1.6. Se refuerza técnica de cepillado.',
     'Profilaxis + diagnóstico de caries en 1.6, se agenda obturación.', true, 'draft', v_owner_id),
    (v_ver_benjamin, v_note_benjamin, v_clinic_id, 1, 'Control de ortodoncia',
     E'S: Paciente refiere molestia leve tras el último ajuste, ya cedió.\nO: Alineación progresando según lo planificado. Sin lesiones en mucosa.\nA: Evolución favorable del tratamiento de ortodoncia, mes 4 de 18.\nP: Ajuste de arco realizado. Próximo control en 4 semanas.',
     'Control de ortodoncia mes 4, evolución favorable.', true, 'draft', v_owner_id),
    (v_ver_josefina, v_note_josefina, v_clinic_id, 1, 'Endodoncia pieza 3.6',
     E'S: Dolor pulsátil de 3 días de evolución en pieza 3.6, cede parcialmente con analgésicos.\nO: Pieza 3.6 con caries profunda, prueba de vitalidad positiva y dolorosa. Radiografía sin lesión periapical evidente.\nA: Pulpitis irreversible pieza 3.6.\nP: Se inicia tratamiento de endodoncia. Instrumentación de los 3 conductos, medicación intraconducto. Se cita para obturación de conductos en 7 días.',
     'Endodoncia 3.6 iniciada por pulpitis irreversible, continúa en próxima cita.', true, 'draft', v_owner_id),
    (v_ver_tomas, v_note_tomas, v_clinic_id, 1, 'Control de ortodoncia',
     E'S: Sin molestias.\nO: Buena higiene oral, brackets en buen estado.\nA: Evolución favorable.\nP: Ajuste de rutina. Continúa control mensual.',
     'Control de rutina, sin novedades.', true, 'draft', v_owner_id);

  -- Convenio (Isapre) con cobertura + 2 pacientes afiliados.
  INSERT INTO public.agreements (id, clinic_id, name, kind, contact_name, contact_phone, created_by)
  VALUES (v_agreement, v_clinic_id, 'Isapre Consalud', 'isapre', 'Mesa de ayuda prestadores', '+56 2 2411 2000', v_owner_id);

  INSERT INTO public.agreement_coverage (clinic_id, agreement_id, procedure_id, coverage_pct) VALUES
    (v_clinic_id, v_agreement, v_proc_ctrl, 50),
    (v_clinic_id, v_agreement, v_proc_resina, 30);

  UPDATE public.patients SET agreement_id = v_agreement, agreement_member_id = 'CNS-88213' WHERE id = v_pat_agustin;
  UPDATE public.patients SET agreement_id = v_agreement, agreement_member_id = 'CNS-77410' WHERE id = v_pat_martina;

  -- Presupuestos en distintos estados de embudo: aceptado con pago+ítem
  -- completado (Valentina, Josefina), enviado sin resolver (Benjamín),
  -- borrador (Isidora), rechazado (Agustín).
  INSERT INTO public.quotes (id, clinic_id, patient_id, number, status, subtotal_cents, total_cents, created_by)
  VALUES (v_quote_valentina, v_clinic_id, v_pat_valentina, 'DEMO-0001', 'sent', 215000, 215000, v_owner_id);
  INSERT INTO public.quote_items (clinic_id, quote_id, procedure_id, name_snapshot, quantity, unit_price_cents, total_cents, position) VALUES
    (v_clinic_id, v_quote_valentina, v_proc_ctrl, 'Control y limpieza', 1, 35000, 35000, 1),
    (v_clinic_id, v_quote_valentina, v_proc_endo, 'Endodoncia', 1, 180000, 180000, 2);
  UPDATE public.quotes SET status = 'accepted' WHERE id = v_quote_valentina;
  UPDATE public.treatment_items ti
    SET status = 'completed', completed_at = now() - interval '2 days', professional_id = v_prof1
    FROM public.treatment_plans tp
    WHERE ti.plan_id = tp.id AND tp.quote_id = v_quote_valentina AND ti.name_snapshot = 'Control y limpieza';
  INSERT INTO public.payments (clinic_id, patient_id, amount_cents, method, paid_at, notes, created_by)
  VALUES (v_clinic_id, v_pat_valentina, 35000, 'debit_card', now() - interval '2 days', 'Pago control y limpieza', v_owner_id);

  INSERT INTO public.quotes (id, clinic_id, patient_id, number, status, subtotal_cents, total_cents, created_by)
  VALUES (v_quote_josefina, v_clinic_id, v_pat_josefina, 'DEMO-0002', 'sent', 180000, 180000, v_owner_id);
  INSERT INTO public.quote_items (clinic_id, quote_id, procedure_id, name_snapshot, quantity, unit_price_cents, total_cents, position)
  VALUES (v_clinic_id, v_quote_josefina, v_proc_endo, 'Endodoncia', 1, 180000, 180000, 1);
  UPDATE public.quotes SET status = 'accepted' WHERE id = v_quote_josefina;
  INSERT INTO public.payments (clinic_id, patient_id, amount_cents, method, paid_at, notes, created_by)
  VALUES (v_clinic_id, v_pat_josefina, 90000, 'transfer', now() - interval '6 days', 'Abono endodoncia (50%)', v_owner_id);

  INSERT INTO public.quotes (id, clinic_id, patient_id, number, status, subtotal_cents, total_cents, created_by)
  VALUES (v_quote_benjamin, v_clinic_id, v_pat_benjamin, 'DEMO-0003', 'sent', 850000, 850000, v_owner_id);
  INSERT INTO public.quote_items (clinic_id, quote_id, procedure_id, name_snapshot, quantity, unit_price_cents, total_cents, position)
  VALUES (v_clinic_id, v_quote_benjamin, v_proc_brackets, 'Instalación de brackets', 1, 850000, 850000, 1);

  INSERT INTO public.quotes (id, clinic_id, patient_id, number, status, subtotal_cents, total_cents, created_by)
  VALUES (v_quote_isidora, v_clinic_id, v_pat_isidora, 'DEMO-0004', 'draft', 48000, 48000, v_owner_id);
  INSERT INTO public.quote_items (clinic_id, quote_id, procedure_id, name_snapshot, quantity, unit_price_cents, total_cents, position)
  VALUES (v_clinic_id, v_quote_isidora, v_proc_resina, 'Resina / obturación', 1, 48000, 48000, 1);

  INSERT INTO public.quotes (id, clinic_id, patient_id, number, status, subtotal_cents, total_cents, created_by)
  VALUES (v_quote_agustin, v_clinic_id, v_pat_agustin, 'DEMO-0005', 'sent', 250000, 250000, v_owner_id);
  INSERT INTO public.quote_items (clinic_id, quote_id, procedure_id, name_snapshot, quantity, unit_price_cents, total_cents, position)
  VALUES (v_clinic_id, v_quote_agustin, v_proc_corona, 'Corona dental', 1, 250000, 250000, 1);
  UPDATE public.quotes SET status = 'rejected' WHERE id = v_quote_agustin;

  -- Mensajería: historial de WhatsApp enviados.
  -- `created_at` va EXPLÍCITO y no solo `sent_at`: el default de created_at es
  -- now(), así que sin esto los tres recordatorios "viejos" quedaban como el
  -- mensaje MÁS NUEVO de cada hilo y /conversaciones mostraba toda la demo
  -- como ya respondida — el contrario exacto de lo que tiene que enseñar.
  INSERT INTO public.messages (clinic_id, patient_id, channel, direction, status, recipient, body, template_kind, created_at, sent_at, sent_by) VALUES
    (v_clinic_id, v_pat_valentina, 'whatsapp', 'outbound', 'delivered', '+56961234501',
     'Hola Valentina, te recordamos tu cita de Control y limpieza mañana a las 10:00. Para confirmar respondé SÍ. — Clínica Demo Alika',
     'appointment_reminder', now() - interval '1 days 3 hours', now() - interval '1 days 3 hours', v_owner_id),
    (v_clinic_id, v_pat_josefina, 'whatsapp', 'outbound', 'read', '+56961234505',
     'Hola Josefina, te comparto el presupuesto DEMO-0002 por $180.000. Cualquier duda me decís. — Clínica Demo Alika',
     'quote_sent', now() - interval '6 days', now() - interval '6 days', v_owner_id),
    (v_clinic_id, v_pat_benjamin, 'whatsapp', 'outbound', 'sent', '+56961234502',
     'Hola Benjamín, en unas horas es tu cita de Instalación de brackets a las 10:00 en Sucursal Providencia. ¡Te esperamos!',
     'appointment_reminder', now() - interval '2 days', now() - interval '2 days', v_owner_id);

  -- Mensajes ENTRANTES: sin esto la bandeja de /conversaciones se ve vacía en
  -- la demo, que es justo la pantalla que muestra por qué Alika no es solo un
  -- historial de envíos. Se siembran tres situaciones distintas a propósito:
  --   · Valentina  → escribió hace 2h y nadie contestó: SIN RESPONDER, ventana de 24h ABIERTA.
  --   · Benjamín   → dos mensajes seguidos sin respuesta: muestra el contador de racha.
  --   · Tomás      → escribió hace 3 días y la clínica ya respondió: ventana CERRADA, hilo resuelto.
  INSERT INTO public.messages (clinic_id, patient_id, channel, direction, status, recipient, body, created_at) VALUES
    (v_clinic_id, v_pat_valentina, 'whatsapp', 'inbound', 'delivered', '56961234501',
     'Hola! Sí, ahí voy. Una consulta: ¿puedo llevar a mi hijo o mejor lo dejo?', now() - interval '2 hours'),
    (v_clinic_id, v_pat_benjamin, 'whatsapp', 'inbound', 'delivered', '56961234502',
     'Buenas, se me complicó el horario de mañana', now() - interval '5 hours'),
    (v_clinic_id, v_pat_benjamin, 'whatsapp', 'inbound', 'delivered', '56961234502',
     '¿Habrá algo por la tarde esta semana?', now() - interval '4 hours');

  INSERT INTO public.messages (clinic_id, patient_id, channel, direction, status, recipient, body, created_at, sent_at, sent_by) VALUES
    (v_clinic_id, v_pat_tomas, 'whatsapp', 'inbound', 'delivered', '56961234504',
     '¿Atienden los sábados?', now() - interval '3 days 2 hours', NULL, NULL),
    (v_clinic_id, v_pat_tomas, 'whatsapp', 'outbound', 'read', '56961234504',
     'Hola Tomás, sí: sábados de 9:00 a 14:00 en Sucursal Providencia. ¿Te reservo una hora?',
     now() - interval '3 days 1 hour', now() - interval '3 days 1 hour', v_owner_id);

  -- El inventario se siembra más abajo, con bodegas y movimientos reales:
  -- el bloque que estaba acá escribía `current_stock` directo y dejaba
  -- `inventory_stock` vacío, o sea el total del ítem sin respaldo en ninguna
  -- bodega. Se movió, no se perdió.

  -- Laboratorio: 1 laboratorio, 2 órdenes de trabajo.
  INSERT INTO public.labs (id, clinic_id, name, contact_phone, created_by)
  VALUES (v_lab, v_clinic_id, 'Laboratorio Dental Andes', '+56 2 2555 4000', v_owner_id);

  INSERT INTO public.lab_orders (clinic_id, lab_id, lab_name_snapshot, patient_id, professional_id, description, tooth_numbers, status, sent_on, due_on, received_on, cost_cents, created_by) VALUES
    (v_clinic_id, v_lab, 'Laboratorio Dental Andes', v_pat_agustin, v_prof4, 'Corona de porcelana pieza 4.6', ARRAY[46]::smallint[], 'enviado', v_today - 1, v_today + 6, NULL, 95000, v_owner_id),
    (v_clinic_id, v_lab, 'Laboratorio Dental Andes', v_pat_benjamin, v_prof2, 'Placas de contención ortodoncia', NULL, 'recibido', v_today - 10, NULL, v_today - 2, 42000, v_owner_id);

  -- Lista de espera.
  INSERT INTO public.waitlist_entries (clinic_id, branch_id, patient_id, full_name, reason, created_by) VALUES
    (v_clinic_id, v_branch1, NULL, 'Camila Reyes Ortiz', 'Control y limpieza', v_owner_id),
    (v_clinic_id, v_branch2, v_pat_sebastian, 'Sebastián Guzmán Leiva', 'Extracción simple, prefiere horario de tarde', v_owner_id);

  -- ═══ BOXES ══════════════════════════════════════════════════════════════
  -- Sin esto la agenda muestra "(Sin box asignado)" bajo cada profesional.
  INSERT INTO public.operatories (clinic_id, branch_id, name) VALUES
    (v_clinic_id, v_branch1, 'Box 1'),
    (v_clinic_id, v_branch2, 'Box A');

  -- ═══ ANAMNESIS ══════════════════════════════════════════════════════════
  -- Alimenta el ícono de alerta de alergias en la agenda y en la ficha: es
  -- de lo primero que mira recepción antes de que el paciente entre al box.
  INSERT INTO public.patient_medical_history (clinic_id, patient_id, allergies, chronic_medications, conditions, notes, updated_by) VALUES
    (v_clinic_id, v_pat_valentina, ARRAY['Penicilina'], ARRAY[]::text[], ARRAY[]::text[], 'Reacción cutánea documentada en 2019.', v_owner_id),
    (v_clinic_id, v_pat_agustin, ARRAY['Látex','AINEs'], ARRAY['Losartán 50mg'], ARRAY['Hipertensión'], 'Usar guantes de nitrilo. Controlar presión antes de anestesia.', v_owner_id),
    (v_clinic_id, v_pat_tomas, ARRAY[]::text[], ARRAY['Metformina 850mg'], ARRAY['Diabetes tipo 2'], 'Citar en la mañana; controlar glicemia previa.', v_owner_id);

  -- ═══ MEDIOS DE PAGO CON RETENCIÓN ═══════════════════════════════════════
  -- seed_clinic_payment_methods ya dejó los 5 por defecto; acá se les pone la
  -- retención real del adquirente para que /medios-de-pago y el neto de
  -- finanzas muestren la diferencia entre lo cobrado y lo que llega al banco.
  UPDATE public.payment_methods SET retention_pct = 2.95 WHERE clinic_id = v_clinic_id AND legacy_key = 'credit_card';
  UPDATE public.payment_methods SET retention_pct = 1.20 WHERE clinic_id = v_clinic_id AND legacy_key = 'debit_card';

  -- ═══ GASTOS ═════════════════════════════════════════════════════════════
  INSERT INTO public.expenses (clinic_id, branch_id, category, description, supplier, amount_cents, incurred_on, created_by) VALUES
    (v_clinic_id, v_branch1, 'Arriendo', 'Arriendo mensual Providencia', 'Inmobiliaria Cordillera', 1850000, v_today - 5, v_owner_id),
    (v_clinic_id, v_branch1, 'Insumos clínicos', 'Reposición de guantes y anestesia', 'Dental Supply Chile', 287000, v_today - 4, v_owner_id),
    (v_clinic_id, v_branch2, 'Laboratorio', 'Corona de porcelana pieza 4.6', 'Laboratorio Dental Andes', 95000, v_today - 3, v_owner_id),
    (v_clinic_id, NULL, 'Servicios básicos', 'Luz, agua e internet', 'Varios', 164000, v_today - 2, v_owner_id),
    (v_clinic_id, NULL, 'Marketing', 'Campaña de Instagram — captación', 'Meta Platforms', 120000, v_today - 1, v_owner_id);

  -- ═══ COMISIONES ═════════════════════════════════════════════════════════
  -- Dos modelos a la vez: porcentaje sobre lo producido y monto fijo por
  -- tratamiento. El panel de /comisiones no tiene nada que mostrar sin esto.
  INSERT INTO public.commission_rules (clinic_id, professional_id, kind, percent_bps, fixed_cents, updated_by) VALUES
    (v_clinic_id, v_prof1, 'percent', 4000, 0, v_owner_id),
    (v_clinic_id, v_prof2, 'percent', 3500, 0, v_owner_id),
    (v_clinic_id, v_prof3, 'percent', 4500, 0, v_owner_id),
    (v_clinic_id, v_prof4, 'fixed', 0, 25000, v_owner_id);

  -- ═══ INVENTARIO MULTI-BODEGA ════════════════════════════════════════════
  -- El stock NO se escribe a mano: los ítems arrancan en 0 y se cargan con
  -- movimientos reales, que es lo único que mantiene el invariante
  -- `inventory_items.current_stock == SUM(inventory_stock.current_stock)`.
  -- Sembrar el total directo dejaría las bodegas vacías y el semáforo
  -- mintiendo — el mismo descuadre que se arregló el 07-sep.
  INSERT INTO public.warehouses (id, clinic_id, name, branch_id, position)
  VALUES (v_wh_condes, v_clinic_id, 'Bodega Las Condes', v_branch2, 1);
  SELECT id INTO v_wh_general FROM public.warehouses
   WHERE clinic_id = v_clinic_id AND name = 'Bodega general' LIMIT 1;

  INSERT INTO public.inventory_items (id, clinic_id, name, unit, current_stock, min_stock, cost_cents, created_by) VALUES
    (v_item_guantes, v_clinic_id, 'Guantes de nitrilo (caja x100)', 'caja', 0, 5, 8500, v_owner_id),
    (v_item_anestesia, v_clinic_id, 'Anestesia lidocaína 2%', 'caja', 0, 5, 32000, v_owner_id),
    (v_item_resina, v_clinic_id, 'Resina compuesta A2', 'unidad', 0, 3, 18500, v_owner_id),
    (v_item_fresas, v_clinic_id, 'Fresas diamantadas surtidas', 'unidad', 0, 10, 2200, v_owner_id),
    (v_item_sutura, v_clinic_id, 'Hilo de sutura 4-0', 'unidad', 0, 5, 3100, v_owner_id),
    (v_item_alginato, v_clinic_id, 'Alginato para impresiones', 'kg', 0, 2, 15000, v_owner_id),
    (v_item_brackets, v_clinic_id, 'Brackets metálicos (kit)', 'kit', 0, 3, 45000, v_owner_id),
    (v_item_barreras, v_clinic_id, 'Barreras de campo (rollo)', 'rollo', 0, 8, 4200, v_owner_id);

  -- Entradas repartidas entre las dos bodegas. Anestesia y alginato quedan
  -- deliberadamente en el mínimo o debajo: la alerta de stock tiene que
  -- tener algo real que mostrar.
  INSERT INTO public.inventory_movements (clinic_id, item_id, kind, quantity, warehouse_id, reason, recorded_by, recorded_at) VALUES
    (v_clinic_id, v_item_guantes,    'entrada', 8,  v_wh_general, 'Compra inicial',       v_owner_id, now() - interval '20 days'),
    (v_clinic_id, v_item_guantes,    'entrada', 4,  v_wh_condes,  'Traslado a Las Condes',v_owner_id, now() - interval '18 days'),
    (v_clinic_id, v_item_anestesia,  'entrada', 3,  v_wh_general, 'Compra inicial',       v_owner_id, now() - interval '20 days'),
    (v_clinic_id, v_item_resina,     'entrada', 6,  v_wh_general, 'Compra inicial',       v_owner_id, now() - interval '20 days'),
    (v_clinic_id, v_item_resina,     'entrada', 2,  v_wh_condes,  'Compra inicial',       v_owner_id, now() - interval '20 days'),
    (v_clinic_id, v_item_fresas,     'entrada', 25, v_wh_general, 'Compra inicial',       v_owner_id, now() - interval '20 days'),
    (v_clinic_id, v_item_sutura,     'entrada', 15, v_wh_general, 'Compra inicial',       v_owner_id, now() - interval '20 days'),
    (v_clinic_id, v_item_alginato,   'entrada', 2,  v_wh_general, 'Compra inicial',       v_owner_id, now() - interval '20 days'),
    (v_clinic_id, v_item_brackets,   'entrada', 6,  v_wh_general, 'Compra inicial',       v_owner_id, now() - interval '20 days'),
    (v_clinic_id, v_item_barreras,   'entrada', 12, v_wh_general, 'Compra inicial',       v_owner_id, now() - interval '20 days'),
    (v_clinic_id, v_item_barreras,   'entrada', 8,  v_wh_condes,  'Compra inicial',       v_owner_id, now() - interval '20 days'),
    -- Consumo real de las últimas semanas.
    (v_clinic_id, v_item_guantes,    'salida',  2,  v_wh_general, 'Consumo del mes',      v_owner_id, now() - interval '6 days'),
    (v_clinic_id, v_item_fresas,     'salida',  4,  v_wh_general, 'Consumo del mes',      v_owner_id, now() - interval '4 days');

  -- ═══ RECETA DE INSUMOS POR PRESTACIÓN ═══════════════════════════════════
  -- Lo que hace que el costo de un tratamiento no sea una estimación: cada
  -- procedimiento descuenta sus insumos solo al completarse.
  INSERT INTO public.procedure_supplies (clinic_id, procedure_id, item_id, quantity, created_by) VALUES
    (v_clinic_id, v_proc_ctrl,     v_item_guantes,  0.02, v_owner_id),
    (v_clinic_id, v_proc_ctrl,     v_item_barreras, 0.10, v_owner_id),
    (v_clinic_id, v_proc_resina,   v_item_resina,   1.00, v_owner_id),
    (v_clinic_id, v_proc_resina,   v_item_fresas,   0.50, v_owner_id),
    (v_clinic_id, v_proc_resina,   v_item_anestesia,0.10, v_owner_id),
    (v_clinic_id, v_proc_endo,     v_item_anestesia,0.25, v_owner_id),
    (v_clinic_id, v_proc_endo,     v_item_fresas,   2.00, v_owner_id),
    (v_clinic_id, v_proc_brackets, v_item_brackets, 1.00, v_owner_id),
    (v_clinic_id, v_proc_extraccion, v_item_anestesia, 0.20, v_owner_id),
    (v_clinic_id, v_proc_extraccion, v_item_sutura,    1.00, v_owner_id);

  -- ═══ CONTEO FÍSICO ══════════════════════════════════════════════════════
  -- Un conteo con diferencia real: es lo que alimenta la recalibración de la
  -- receta sugerida (si la merma se repite, la receta estaba mal medida).
  INSERT INTO public.inventory_counts (clinic_id, item_id, warehouse_id, theoretical_quantity, counted_quantity, notes, counted_by, counted_at) VALUES
    (v_clinic_id, v_item_fresas,  v_wh_general, 21, 19, 'Conteo mensual — 2 fresas descartadas por desgaste.', v_owner_id, now() - interval '2 days'),
    (v_clinic_id, v_item_guantes, v_wh_general, 6,  6,  'Conteo mensual — sin diferencia.',                    v_owner_id, now() - interval '2 days');

  -- ═══ PLAN DE TRATAMIENTO ════════════════════════════════════════════════
  -- El puente odontograma → presupuesto → plan → ejecución, que es la
  -- columna vertebral clínica del producto y no aparecía en la demo.
  -- Con fases, cobertura del convenio y el copago del paciente separados.
  -- El plan NO se inserta: `quote_accept_creates_plan` ya lo crea solo al
  -- aceptar el presupuesto, que es el camino real del producto. Sembrar uno
  -- a mano choca con `treatment_plans_quote_unico` y, peor, muestra una demo
  -- por un camino que ningún usuario recorre. Acá solo se lo enriquece con
  -- lo que el trigger no puede saber: fases, quién ejecuta, qué ya se hizo y
  -- cómo se reparte entre convenio y paciente.
  SELECT id INTO v_plan_valentina FROM public.treatment_plans
   WHERE clinic_id = v_clinic_id AND quote_id = v_quote_valentina LIMIT 1;

  IF v_plan_valentina IS NOT NULL THEN
    UPDATE public.treatment_plans
       SET name = 'Rehabilitación cuadrante superior derecho',
           started_at = now() - interval '8 days'
     WHERE id = v_plan_valentina;

    -- Fase, profesional y reparto convenio/paciente sobre lo que ya existe.
    -- El 60/40 sale de la cobertura del convenio sembrado más arriba.
    UPDATE public.treatment_items
       SET professional_id = v_prof1,
           phase_label = 'Fase 1 — Higiene y operatoria',
           phase_position = 1,
           coverage_cents = round(price_cents * 0.60),
           patient_cents = price_cents - round(price_cents * 0.60)
     WHERE plan_id = v_plan_valentina;

    -- La primera prestación ya se hizo: sin al menos un ítem completado, el
    -- avance del plan y el panel de desempeño se ven siempre en cero.
    -- Los 3 días son a propósito: /comisiones filtra por `completed_at` dentro
    -- del mes en curso, y con 8 días el trabajo caía en el mes anterior y el
    -- panel mostraba las reglas de comisión con producción $0.
    UPDATE public.treatment_items
       SET status = 'completed', completed_at = now() - interval '3 days', completed_by = v_owner_id
     WHERE plan_id = v_plan_valentina
       AND id = (SELECT id FROM public.treatment_items WHERE plan_id = v_plan_valentina ORDER BY position LIMIT 1);

    -- Dos fases más, para que el plan muestre progresión real y no una lista.
    INSERT INTO public.treatment_items (clinic_id, plan_id, procedure_id, name_snapshot, tooth_number, status, price_cents, position, professional_id, phase_label, phase_position, coverage_cents, patient_cents) VALUES
      (v_clinic_id, v_plan_valentina, v_proc_resina, 'Resina / obturación', 17, 'in_progress', 48000, 10, v_prof1, 'Fase 2 — Operatoria', 2, 28800, 19200),
      (v_clinic_id, v_plan_valentina, v_proc_corona, 'Corona dental',       15, 'pending',    250000, 11, v_prof1, 'Fase 3 — Prótesis',   3, 150000, 100000);
  END IF;

  -- ═══ PRODUCCIÓN DE LOS OTROS PROFESIONALES ══════════════════════════════
  -- Sin trabajo completado por más de un profesional, /comisiones y el panel
  -- de desempeño muestran una sola fila con números y tres en cero, que es
  -- peor que no mostrarlos: parece que el módulo no funciona.
  SELECT id INTO v_plan_josefina FROM public.treatment_plans
   WHERE clinic_id = v_clinic_id AND quote_id = v_quote_josefina LIMIT 1;

  IF v_plan_josefina IS NOT NULL THEN
    UPDATE public.treatment_items
       SET professional_id = v_prof3,
           status = 'completed',
           completed_at = now() - interval '5 days',
           completed_by = v_owner_id,
           phase_label = 'Fase única — Endodoncia',
           phase_position = 1
     WHERE plan_id = v_plan_josefina;

    INSERT INTO public.treatment_items (clinic_id, plan_id, procedure_id, name_snapshot, tooth_number, status, price_cents, position, professional_id, completed_at, completed_by, phase_label, phase_position) VALUES
      (v_clinic_id, v_plan_josefina, v_proc_orto,   'Control de ortodoncia', NULL, 'completed',  45000, 20, v_prof2, now() - interval '6 days', v_owner_id, 'Seguimiento', 2),
      (v_clinic_id, v_plan_josefina, v_proc_ctrl,   'Control y limpieza',    NULL, 'completed',  35000, 21, v_prof4, now() - interval '2 days', v_owner_id, 'Seguimiento', 2),
      (v_clinic_id, v_plan_josefina, v_proc_resina, 'Resina / obturación',   36,   'completed',  48000, 22, v_prof4, now() - interval '1 day',  v_owner_id, 'Seguimiento', 2);
  END IF;

  -- ═══ CAPTACIÓN POR WHATSAPP ═════════════════════════════════════════════
  -- Desconocidos que escribieron al número de la clínica. Es la pantalla
  -- /whatsapp, y sin filas se ve como si la función no existiera.
  INSERT INTO public.whatsapp_leads (clinic_id, phone, name, first_message, status, auto_replied_at, created_at) VALUES
    (v_clinic_id, '56961239001', 'Carolina R.', 'Hola! Vi su Instagram, ¿cuánto sale una limpieza?', 'new',       now() - interval '3 hours', now() - interval '3 hours'),
    (v_clinic_id, '56961239002', NULL,          '¿Atienden Isapre Colmena?',                          'contacted', now() - interval '2 days',  now() - interval '2 days');

  -- ═══ SOLICITUDES DE HORA DESDE EL PORTAL ════════════════════════════════
  INSERT INTO public.appointment_requests (clinic_id, patient_id, preferred_date, reason, priority, source, status) VALUES
    (v_clinic_id, v_pat_martina,   v_today + 4, 'Me duele una muela del juicio, si se puede en la tarde.', 'alta',  'portal', 'pending'),
    (v_clinic_id, v_pat_sebastian, v_today + 9, 'Control de rutina.',                                      'baja',  'portal', 'pending');

  -- ═══ CONSENTIMIENTO DE WHATSAPP ═════════════════════════════════════════
  -- `wa_opt_in` tiene default false, así que sin esto los 10 pacientes de la
  -- demo se ven "sin opt-in" y ninguno recibe recordatorios: la mitad del
  -- producto queda apagada en la pantalla que lo tiene que mostrar. Una
  -- clínica real toma el consentimiento en la ficha de ingreso.
  UPDATE public.patients
     SET wa_opt_in = true, wa_opt_in_at = created_at
   WHERE clinic_id = v_clinic_id;

  -- Uno dado de baja de verdad, para que el caso exista en la demo. Se elige
  -- un paciente SIN conversación abierta: mostrar el cartel rojo sobre un
  -- hilo activo sugeriría que se le está escribiendo a alguien que pidió que
  -- no le escriban.
  UPDATE public.patients
     SET wa_opt_in = false, wa_opt_out_at = now() - interval '11 days'
   WHERE id = v_pat_diego;

  -- ═══ HORARIOS DE LOS PROFESIONALES ══════════════════════════════════════
  -- Sin esto el dashboard muestra "Ocupación: Sin datos" — el cálculo son
  -- horas agendadas sobre horas DECLARADAS, y sin horario declarado no hay
  -- denominador. También es lo que valida la agenda al crear una cita fuera
  -- de horario, así que sembrarlo hace honesta esa validación en la demo.
  --
  -- Los horarios son PARCIALES y distintos por profesional, no 45h semanales
  -- para los cuatro: un endodoncista no atiende toda la semana en una sola
  -- clínica, y declarar disponibilidad que nadie tiene hunde la ocupación a
  -- un número que hace ver la clínica vacía. Incluye sábado por la mañana,
  -- que es lo que dice la propia auto-respuesta de la demo y donde el seed
  -- ya tenía citas agendadas.
  INSERT INTO public.professional_schedules (clinic_id, professional_id, day_of_week, start_time, end_time) VALUES
    -- Dra. Camila Herrera — general, jornada completa (1=lunes … 6=sábado).
    (v_clinic_id, v_prof1, 1, '09:00', '18:00'),
    (v_clinic_id, v_prof1, 2, '09:00', '18:00'),
    (v_clinic_id, v_prof1, 3, '09:00', '18:00'),
    (v_clinic_id, v_prof1, 4, '09:00', '18:00'),
    (v_clinic_id, v_prof1, 6, '09:00', '14:00'),
    -- Dr. Matías Reyes — ortodoncia, martes y jueves.
    (v_clinic_id, v_prof2, 2, '09:00', '17:00'),
    (v_clinic_id, v_prof2, 4, '09:00', '17:00'),
    (v_clinic_id, v_prof2, 6, '09:00', '14:00'),
    -- Dra. Fernanda Rojas — endodoncia, miércoles y viernes por la tarde.
    (v_clinic_id, v_prof3, 3, '11:00', '19:00'),
    (v_clinic_id, v_prof3, 5, '11:00', '19:00'),
    -- Dr. Ignacio Soto — general en Las Condes, mañanas.
    (v_clinic_id, v_prof4, 1, '09:00', '14:00'),
    (v_clinic_id, v_prof4, 2, '09:00', '14:00'),
    (v_clinic_id, v_prof4, 3, '09:00', '14:00'),
    (v_clinic_id, v_prof4, 4, '09:00', '14:00'),
    (v_clinic_id, v_prof4, 5, '09:00', '14:00');

  -- ═══ AGENDA LLENA ═══════════════════════════════════════════════════════
  -- Las 23 citas escritas a mano llevan los estados y los vínculos con notas
  -- y presupuestos, pero dejan la agenda casi vacía: cinco columnas con una
  -- cita cada una no se parece a una clínica en funcionamiento, y la
  -- ocupación del dashboard queda en un dígito.
  --
  -- Esto la rellena SIN pisar nada: solo inserta en un hueco si el
  -- profesional no tiene ya una cita que se solape, y solo dentro del horario
  -- que ese profesional realmente declaró arriba. El `% 3 <> 0` deja huecos
  -- a propósito — una agenda 100% llena tampoco es real, y sin huecos no se
  -- ve dónde entraría un paciente nuevo.
  INSERT INTO public.appointments (clinic_id, branch_id, patient_id, professional_id, treatment_label, starts_at, ends_at, status, created_by)
  SELECT v_clinic_id, p.branch_id, pac.id, p.id,
         proc.name,
         (dia + slot) AT TIME ZONE 'America/Santiago',
         (dia + slot + (proc.duration_min || ' minutes')::interval) AT TIME ZONE 'America/Santiago',
         CASE WHEN (dia + slot) AT TIME ZONE 'America/Santiago' < now() THEN 'finalizada'::public.appointment_status
              WHEN (extract(day from dia)::int + slot_i) % 4 = 0 THEN 'tentativa'::public.appointment_status
              ELSE 'confirmada'::public.appointment_status END,
         v_owner_id
    FROM public.professionals p
    CROSS JOIN LATERAL (
      -- La serie va en espacio de DATE, no de timestamptz, y la hora local se
      -- interpreta recién al final con AT TIME ZONE.
      --
      -- Con `date_trunc('day', now()) - interval '9 days'` esto quedaba
      -- corrido UNA HORA: restarle a un timestamptz un intervalo de unidades
      -- de tiempo resta duración ABSOLUTA, y el 6 de septiembre Chile cambia
      -- la hora. El resultado eran dos familias de horarios separadas por 60
      -- minutos (09:30 y 10:30, 17:00 y 18:00), la mitad de ellas fuera del
      -- horario declarado del profesional.
      -- No existe generate_series(date, date, int): se genera el offset
      -- entero y se suma a la fecha, que además deja explícito el rango.
      SELECT (v_today - 9 + n)::date AS dia FROM generate_series(0, 18) AS n
    ) d
    CROSS JOIN LATERAL (
      SELECT s AS slot, row_number() OVER () AS slot_i
        FROM unnest(ARRAY['09:30','11:00','12:30','15:30','17:00']::interval[]) AS s
    ) sl
    CROSS JOIN LATERAL (
      -- Paciente y prestación deterministas: el mismo hueco siempre da la
      -- misma fila, así dos resets seguidos producen la misma demo.
      SELECT id FROM public.patients
       WHERE clinic_id = v_clinic_id
       ORDER BY md5(p.id::text || d.dia::text || sl.slot::text || id::text)
       LIMIT 1
    ) pac
    CROSS JOIN LATERAL (
      SELECT name, duration_min FROM public.procedures
       WHERE clinic_id = v_clinic_id
       ORDER BY md5(p.id::text || d.dia::text || sl.slot::text || id::text)
       LIMIT 1
    ) proc
   WHERE p.clinic_id = v_clinic_id
     -- Solo dentro del horario declarado por ESE profesional ese día.
     AND EXISTS (
       SELECT 1 FROM public.professional_schedules ps
        WHERE ps.professional_id = p.id
          AND ps.day_of_week = extract(isodow FROM d.dia)::int
          AND sl.slot >= ps.start_time - interval '0 min'
          AND sl.slot + (proc.duration_min || ' minutes')::interval <= ps.end_time
     )
     -- Huecos a propósito.
     AND (extract(doy from d.dia)::int + sl.slot_i) % 3 <> 0
     -- Nunca encima de una cita que ya existe.
     AND NOT EXISTS (
       SELECT 1 FROM public.appointments a
        WHERE a.professional_id = p.id
          AND a.starts_at < (d.dia + sl.slot + (proc.duration_min || ' minutes')::interval) AT TIME ZONE 'America/Santiago'
          AND a.ends_at > (d.dia + sl.slot) AT TIME ZONE 'America/Santiago'
     );

  -- ═══ TIEMPOS REALES DE ATENCIÓN ═════════════════════════════════════════
  -- `arrived_at` y `started_at` en las citas ya finalizadas: es lo único que
  -- convierte "Espera promedio" de "Sin datos" en un número. Se generan con
  -- esperas dispares (5 a 20 min) para que el promedio no sea sospechosamente
  -- redondo.
  UPDATE public.appointments
     SET arrived_at = starts_at - interval '10 minutes',
         started_at = starts_at + ((id::text ~ '^[0-7]')::int * interval '5 minutes') + interval '5 minutes'
   WHERE clinic_id = v_clinic_id AND status = 'finalizada';

  -- ═══ ACOMODAR LAS CITAS ESCRITAS A MANO AL HORARIO ═════════════════════
  -- Las 23 citas del bloque de arriba usan offsets `v_today ± N`, así que su
  -- DÍA DE LA SEMANA cambia en cada reset diario: hoy caen en martes, mañana
  -- en miércoles. Por eso no se pueden dejar fijas para que respeten un
  -- horario por día de semana — no hay edición que sirva más de 24 horas.
  --
  -- Esto las corre al día más cercano (±1 a ±3) donde ese profesional sí
  -- atiende en ese horario y no pisa otra cita. Si no encuentra ninguno la
  -- deja donde está: mejor una cita fuera de horario que una encima de otra.
  -- (Va como CTE y no como `UPDATE ... FROM LATERAL`: en un UPDATE la tabla
  -- objetivo no es visible lateralmente desde el FROM.)
  WITH desalineadas AS (
    SELECT a.id, a.professional_id, a.starts_at, a.ends_at
      FROM public.appointments a
     WHERE a.clinic_id = v_clinic_id
       AND NOT EXISTS (
         SELECT 1 FROM public.professional_schedules ps
          WHERE ps.professional_id = a.professional_id
            AND ps.day_of_week = extract(isodow FROM a.starts_at)::int
            AND a.starts_at::time >= ps.start_time
            AND a.ends_at::time <= ps.end_time)
  ), corridas AS (
    SELECT d.id, m.delta
      FROM desalineadas d
      CROSS JOIN LATERAL (
        SELECT x AS delta
          FROM unnest(ARRAY[1,-1,2,-2,3,-3]) AS x
         WHERE EXISTS (
                 SELECT 1 FROM public.professional_schedules ps
                  WHERE ps.professional_id = d.professional_id
                    AND ps.day_of_week = extract(isodow FROM d.starts_at + (x || ' days')::interval)::int
                    AND (d.starts_at + (x || ' days')::interval)::time >= ps.start_time
                    AND (d.ends_at   + (x || ' days')::interval)::time <= ps.end_time)
           AND NOT EXISTS (
                 SELECT 1 FROM public.appointments o
                  WHERE o.professional_id = d.professional_id AND o.id <> d.id
                    AND o.starts_at < d.ends_at   + (x || ' days')::interval
                    AND o.ends_at   > d.starts_at + (x || ' days')::interval)
         ORDER BY abs(x) LIMIT 1
      ) AS m
  )
  UPDATE public.appointments a
     SET starts_at = a.starts_at + (c.delta || ' days')::interval,
         ends_at   = a.ends_at   + (c.delta || ' days')::interval
    FROM corridas c
   WHERE a.id = c.id;

  -- ═══ EL PACIENTE AVISÓ QUE VIENE ════════════════════════════════════════
  -- Eje separado del visto bueno del profesional (migración 20260907160000).
  -- Se marcan citas futuras para que la agenda muestre las 4 combinaciones
  -- posibles: aceptada+avisó, aceptada+sin avisar, tentativa+avisó, ninguna.
  UPDATE public.appointments a
     SET patient_confirmed_at = now() - interval '4 hours',
         patient_confirmed_via = 'whatsapp'
   WHERE a.clinic_id = v_clinic_id
     AND a.starts_at > now()
     AND a.id IN (
       SELECT id FROM public.appointments
        WHERE clinic_id = v_clinic_id AND starts_at > now()
        ORDER BY starts_at LIMIT 2
     );

  -- ═══ EL DUEÑO DE LA DEMO ES TAMBIÉN UN PROFESIONAL ══════════════════════
  -- Sin esto /mi-agenda está vacía para quien entra a la demo: no hay ningún
  -- profesional asociado a su usuario, así que no tiene "su" agenda.
  UPDATE public.professionals SET user_id = v_owner_id WHERE id = v_prof1;


  -- ═══ EFECTIVIDAD (F5): la demo tiene que poder MOSTRAR esa pantalla ══════
  -- Sin esto /efectividad se ve vacía justo en sus dos métricas estrella, por
  -- dos razones distintas que costó separar: (a) las citas pasadas quedaban en
  -- 'confirmada', que NO es un desenlace —nadie marcó si el paciente vino— así
  -- que la pantalla las excluía con razón; y (b) los recordatorios sembrados no
  -- llevaban `appointment_id`, que es de donde se deduce a qué cita se le avisó.
  -- El emisor real SÍ lo setea (messaging.functions.ts), o sea que el hueco era
  -- del seed, no del producto.
  --
  -- Los porcentajes de /efectividad sólo aparecen a partir de 20 casos por
  -- grupo, así que los cortes de abajo están elegidos para que ambos lados de
  -- las dos comparaciones crucen ese piso. Las tasas son verosímiles para una
  -- clínica dental (ausentismo global ~15%), no espectaculares: una demo que
  -- promete un efecto irreal se cae en la primera reunión.

  -- (a) Toda cita pasada termina con desenlace. El corte por `row_number` es
  --     determinista, así que la demo cuenta la misma historia en cada reset.
  WITH pasadas AS (
    SELECT id,
           row_number() OVER (ORDER BY starts_at) AS n,
           count(*) OVER ()                       AS total
      FROM public.appointments
     WHERE clinic_id = v_clinic_id
       AND starts_at < now()
       AND status <> 'cancelada'
  ), plan AS (
    SELECT id,
           n <= floor(total * 0.58) AS con_recordatorio,
           -- ~11% de ausencias con recordatorio, ~25% sin él.
           CASE WHEN n <= floor(total * 0.58)
                THEN (n % 9 = 0)
                ELSE (n % 4 = 0)
           END AS falto
      FROM pasadas
  )
  UPDATE public.appointments a
     SET status     = CASE WHEN p.falto THEN 'ausente'::public.appointment_status
                           ELSE 'finalizada'::public.appointment_status END,
         arrived_at = CASE WHEN p.falto THEN NULL
                           ELSE coalesce(a.arrived_at, a.starts_at - interval '6 minutes') END,
         started_at = CASE WHEN p.falto THEN NULL
                           ELSE coalesce(a.started_at, a.starts_at + interval '3 minutes') END
    FROM plan p
   WHERE a.id = p.id;

  -- (b) El recordatorio que efectivamente se mandó, ENLAZADO a su cita. Es el
  --     `appointment_id` lo que permite responder "¿a esta cita le avisamos?".
  INSERT INTO public.messages
    (clinic_id, patient_id, appointment_id, channel, direction, status, recipient,
     body, template_kind, created_at, sent_at, sent_by)
  SELECT v_clinic_id, a.patient_id, a.id, 'whatsapp', 'outbound', 'delivered',
         coalesce(p.phone, '+56900000000'),
         'Hola ' || split_part(p.full_name, ' ', 1) || ', te recordamos tu cita de ' ||
         coalesce(a.treatment_label, 'atención') || '. Para confirmar respondé SÍ. — Clínica Demo Alika',
         'appointment_reminder',
         a.starts_at - interval '2 days',
         a.starts_at - interval '2 days',
         v_owner_id
    FROM (
      SELECT id, patient_id, treatment_label, starts_at,
             row_number() OVER (ORDER BY starts_at) AS n,
             count(*) OVER ()                       AS total
        FROM public.appointments
       WHERE clinic_id = v_clinic_id AND starts_at < now() AND status <> 'cancelada'
    ) a
    JOIN public.patients p ON p.id = a.patient_id
   WHERE a.n <= floor(a.total * 0.58);

  -- (c) De los que recibieron recordatorio, la mayoría avisó que venía. Así la
  --     comparación "¿sirve que el paciente avise?" tiene los dos lados con
  --     muestra suficiente, en vez de un grupo vacío.
  --
  --     ⚠️ A propósito se reparte sobre las citas con recordatorio SIN mirar si
  --     el paciente vino. Marcar el aviso sólo en las 'finalizada' daría "0% de
  --     ausencias entre los que avisaron", que es tautológico: el 0 saldría de
  --     cómo se armó el seed, no de la realidad. Alguien confirma y igual no
  --     aparece, y una demo que esconde eso promete un efecto que el producto
  --     no puede cumplir.
  UPDATE public.appointments a
     SET patient_confirmed_at  = a.starts_at - interval '1 day',
         patient_confirmed_via = 'whatsapp'
    FROM (
      SELECT a2.id,
             row_number() OVER (ORDER BY a2.starts_at) AS n,
             count(*) OVER ()                          AS total
        FROM public.appointments a2
       WHERE a2.clinic_id = v_clinic_id
         AND a2.starts_at < now()
         AND a2.status IN ('finalizada', 'ausente')
         AND EXISTS (
           SELECT 1 FROM public.messages m
            WHERE m.appointment_id = a2.id AND m.direction = 'outbound'
              AND m.template_kind = 'appointment_reminder'
         )
    ) s
   WHERE a.id = s.id
     AND s.n <= floor(s.total * 0.80);

  -- (d) Mensajes entrantes con la mezcla que ve una clínica de verdad. La
  --     pantalla mide cuántos resuelve Alika sola: si todos fueran pedidos de
  --     hora, la cobertura daría 100% y sería propaganda, no una medición.
  --     Acá entran también un "gracias", una consulta de precio y una foto —
  --     que NO son automatizables y por eso la pantalla no los cuenta como
  --     oportunidad perdida.
  INSERT INTO public.messages
    (clinic_id, patient_id, channel, direction, status, recipient, body, created_at)
  SELECT v_clinic_id, p.id, 'whatsapp', 'inbound', 'delivered',
         coalesce(p.phone, '+56900000000'), t.body,
         now() - (t.horas || ' hours')::interval
    FROM (VALUES
      ('Hola, quiero hora para el jueves en la tarde', 120),
      ('¿tienen hora para el próximo lunes?', 118),
      ('Necesito un turno para un control', 116),
      ('Quisiera sacar hora para limpieza', 114),
      ('¿hay hora mañana por la mañana?', 112),
      ('quiero hora el 23 de septiembre', 110),
      ('Necesito cambiar mi hora del viernes', 108),
      ('sí', 106),
      ('Ok, ahí voy', 104),
      ('dale, confirmado', 102),
      ('si si', 100),
      ('Ahí voy', 98),
      ('ok', 96),
      ('BAJA', 94),
      ('Gracias!!', 92),
      ('¿cuánto sale una limpieza?', 90),
      ('Buenas tardes, una consulta', 88),
      ('Ya hice la transferencia', 86),
      ('¿atienden convenio Fonasa?', 84),
      ('Me quedó doliendo la muela', 82),
      ('Perfecto, muchas gracias', 80),
      ('¿dónde queda la sucursal?', 78)
    ) AS t(body, horas)
    CROSS JOIN LATERAL (
      SELECT id, phone FROM public.patients
       WHERE clinic_id = v_clinic_id AND phone IS NOT NULL
       ORDER BY md5(id::text || t.body) LIMIT 1
    ) p;

  -- (e) Las respuestas del equipo, para que la mediana de respuesta exista.
  --     Se contesta la mayoría pero no todo: dejar algunos hilos abiertos es
  --     lo que hace visible el "siguen sin responder" de la pantalla.
  INSERT INTO public.messages
    (clinic_id, patient_id, channel, direction, status, recipient, body, created_at, sent_at, sent_by)
  SELECT v_clinic_id, m.patient_id, 'whatsapp', 'outbound', 'delivered', m.recipient,
         'Hola, gracias por escribir. Te confirmamos en seguida. — Clínica Demo Alika',
         m.created_at + interval '40 minutes',
         m.created_at + interval '40 minutes',
         v_owner_id
    FROM (
      SELECT patient_id, recipient, created_at,
             row_number() OVER (ORDER BY created_at) AS n
        FROM public.messages
       WHERE clinic_id = v_clinic_id AND direction = 'inbound'
         AND created_at < now() - interval '12 hours'
    ) m
   WHERE m.n % 4 <> 0;

  -- (f) Pedidos de hora llegados por WhatsApp (F4). Algunos ya se agendaron.
  INSERT INTO public.appointment_requests
    (clinic_id, patient_id, preferred_date, reason, source, status, created_at)
  SELECT v_clinic_id, p.id,
         (current_date + (t.dias || ' days')::interval)::date,
         t.motivo, 'whatsapp', t.estado,
         now() - interval '3 days'
    FROM (VALUES
      ('Hola, quiero hora para el jueves en la tarde', 3, 'scheduled'),
      ('¿tienen hora para el próximo lunes?', 7, 'scheduled'),
      ('Necesito un turno para un control', 5, 'pending'),
      ('Quisiera sacar hora para limpieza', 9, 'pending')
    ) AS t(motivo, dias, estado)
    CROSS JOIN LATERAL (
      SELECT id FROM public.patients
       WHERE clinic_id = v_clinic_id AND phone IS NOT NULL
       ORDER BY md5(id::text || t.motivo) LIMIT 1
    ) p;

END;
$$;
