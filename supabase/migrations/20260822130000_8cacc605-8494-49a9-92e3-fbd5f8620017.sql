-- Audit finding product-2 (impacto medio, esfuerzo bajo): la plantilla
-- review_request pide una reseña pero no da un link directo de un click a
-- Google (práctica estándar de la categoría — Podium/Birdeye/NiceJob sí lo
-- dan). Agrega el campo por sucursal para guardar ese link.
--
-- Nullable a propósito, sin default: muchas sucursales todavía no van a
-- tenerlo cargado y eso es válido (regla 11 del CLAUDE.md — placeholder
-- nullable en vez de fabricar un valor). La UI y el copy del mensaje deben
-- tratar el caso null como "sin link", no como texto vacío feo.
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS google_review_url text;

COMMENT ON COLUMN public.branches.google_review_url IS
  'Link directo de reseña de Google (place review link) para esta sucursal. Nullable: opcional, cargado por el staff en configuración de sucursal.';
