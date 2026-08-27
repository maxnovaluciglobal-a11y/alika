-- Auditoría 360 v2 (26-ago-2026) — ux-3: sin esto, un dentist que llama
-- getCommissionReport filtrado a su propio professionalId igual ve
-- "Sin regla configurada" aunque SÍ tenga una regla, porque
-- commission_rules_select solo deja ver la fila a owner/admin/accounting —
-- RLS filtra en silencio la fila del propio profesional también.
CREATE POLICY "commission_rules_select_own" ON public.commission_rules
  FOR SELECT TO authenticated
  USING (
    professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())
  );
