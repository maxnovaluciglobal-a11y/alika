-- Enriquece el seed de la clínica demo pública (reset_demo_clinic, migración
-- 20260815190000) para que un prospecto que entra a /demo vea una clínica
-- que se parece a una real: 2 sucursales, 4 profesionales, 10 pacientes,
-- arancel de 8 prestaciones, agenda de 3 semanas con todos los estados,
-- notas clínicas asistidas por IA, odontograma y periodontograma, convenio
-- con cobertura, presupuestos en distintos estados, mensajería, inventario
-- con alertas de stock y laboratorio con órdenes de trabajo.
--
-- Probado primero insertando exactamente estas mismas filas a mano contra
-- la clínica demo real vía el cliente de servicio (mismo patrón que otras
-- verificaciones E2E de este repo) y confirmado en el navegador contra
-- producción — dashboard, agenda, inventario, laboratorios y 2 fichas de
-- paciente, todo sin errores de consola — antes de escribir esta versión
-- en SQL. Reemplaza por completo el cuerpo de la función anterior
-- (CREATE OR REPLACE, misma firma, mismos IDs de clínica/dueño/sucursal 1/
-- especialidad 1-2/profesional 1-2/paciente 1-4/procedimiento 1-3 que ya
-- usaba — no se inventan de nuevo para no romper nada que ya los referencie).

CREATE OR REPLACE FUNCTION public.reset_demo_clinic()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  INSERT INTO public.messages (clinic_id, patient_id, channel, direction, status, recipient, body, template_kind, sent_at, sent_by) VALUES
    (v_clinic_id, v_pat_valentina, 'whatsapp', 'outbound', 'delivered', '+56961234501',
     'Hola Valentina, te recordamos tu cita de Control y limpieza mañana a las 10:00. Para confirmar respondé SÍ. — Clínica Demo Alika',
     'appointment_reminder', now() - interval '9 days', v_owner_id),
    (v_clinic_id, v_pat_josefina, 'whatsapp', 'outbound', 'read', '+56961234505',
     'Hola Josefina, te comparto el presupuesto DEMO-0002 por $180.000. Cualquier duda me decís. — Clínica Demo Alika',
     'quote_sent', now() - interval '6 days', v_owner_id),
    (v_clinic_id, v_pat_benjamin, 'whatsapp', 'outbound', 'sent', '+56961234502',
     'Hola Benjamín, en unas horas es tu cita de Instalación de brackets a las 10:00 en Sucursal Providencia. ¡Te esperamos!',
     'appointment_reminder', now() - interval '1 days', v_owner_id);

  -- Inventario, con 2 ítems deliberadamente bajo el mínimo (demuestra la alerta).
  INSERT INTO public.inventory_items (clinic_id, name, unit, current_stock, min_stock, cost_cents, created_by) VALUES
    (v_clinic_id, 'Guantes de nitrilo (caja x100)', 'caja', 12, 5, 8500, v_owner_id),
    (v_clinic_id, 'Anestesia lidocaína 2%', 'caja', 3, 5, 32000, v_owner_id),
    (v_clinic_id, 'Resina compuesta A2', 'unidad', 8, 3, 18500, v_owner_id),
    (v_clinic_id, 'Fresas diamantadas surtidas', 'unidad', 25, 10, 2200, v_owner_id),
    (v_clinic_id, 'Hilo de sutura 4-0', 'unidad', 15, 5, 3100, v_owner_id),
    (v_clinic_id, 'Alginato para impresiones', 'kg', 2, 2, 15000, v_owner_id),
    (v_clinic_id, 'Brackets metálicos (kit)', 'kit', 6, 3, 45000, v_owner_id),
    (v_clinic_id, 'Barreras de campo (rollo)', 'rollo', 20, 8, 4200, v_owner_id);

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
END;
$$;

REVOKE ALL ON FUNCTION public.reset_demo_clinic() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_demo_clinic() TO service_role;
