-- product-2 (continuación): Walter confirmó que las clínicas existentes en
-- el Supabase real hoy son solo datos de prueba propios (no hay clientes
-- reales con templates ya editados a mano todavía) — así que a diferencia de
-- lo que decía la migración 20260822130100, sí conviene backfillear
-- review_request para que también tengan {link_resena} disponible.
--
-- Idempotente (WHERE ... NOT LIKE) y acotado: solo agrega el placeholder al
-- final si todavía no está — no pisa ningún otro cambio que el body pueda
-- tener.
UPDATE public.message_templates
SET body = body || '{link_resena}'
WHERE kind = 'review_request'
  AND body NOT LIKE '%{link_resena}%';
