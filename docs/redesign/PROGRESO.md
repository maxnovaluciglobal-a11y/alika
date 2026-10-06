# Rediseño Alika — progreso (checkpoint para retomar)

Plan: [`PLAN_EJECUCION.md`](./PLAN_EJECUCION.md). Si la sesión se cortó: `git checkout` de la última rama listada abajo y seguir con el primer ítem sin tildar.

## Fase 1 — Sistema visual único · rama `redesign/fase-1` ✅

- [x] Tokens nuevos en `styles.css` + mapping shadcn + dark
- [x] Fuentes en `__root.tsx`
- [x] `button` / `badge` / `card`
- [x] Reemplazo de clay/ink/mint/bone en `src/` (grep = 0)
- [x] Gates (typecheck, lint, tests, build, visual) + commit

## Fase 2 — Landing · rama `redesign/fase-2` ✅

- [x] Nav + hero con pantalla "Hoy" en HTML
- [x] Pilotos + calculadora embebida + tres resultados
- [x] Testimonio + precios con moneda + cierre wa.me
- [x] Tuteo en el sitio público + evento `demo_click`
- [x] Gates + commit

## Fase 3 — Navegación · rama `redesign/fase-3` ✅

- [x] `navGroups` a 6 destinos + Ajustes
- [x] Hubs `ajustes`, `mensajes`, `reportes`
- [x] ⌘K arriba del sidebar
- [x] Gates + commit

## Fase 4 — Hoy por rol · rama `redesign/fase-4` ✅

- [x] Dashboard nuevo por rol
- [x] `status-strip.tsx` reemplaza los 5 banners
- [x] Gates + commit

## Fase 5 — Ficha y móvil · rama `redesign/fase-5`

- [ ] Cabecera fija + pestañas en la ficha
- [ ] Estados con texto
- [ ] Barra inferior móvil + cola de confirmación
- [ ] Gates + commit

## Registro

- 06-oct: handoff copiado a `docs/design_handoff_alika_rediseno/`; plan y línea base escritos.
- 06-oct: Fase 1 cerrada. Nota: las pantallas autenticadas no se verificaron visualmente (el demo escribe un lead en prod); revisar con login real.
- 06-oct: Fase 2 cerrada. Lighthouse móvil con brotli: 98/100/100/100 (prod actual: 55). `demo_click` = `cta_click {cta:"demo"}` (el CHECK de marketing_events no admite nombres nuevos sin migración). Testimonio y logos ocultos hasta tener permiso; `VITE_SALES_WHATSAPP` pendiente de Walter.
- 06-oct: Fase 3 cerrada. Modelo en `src/lib/access/navegacion.ts` (+7 tests: ≤7 entradas por rol, permisos = beforeLoad). Ninguna ruta se movió → no hicieron falta redirects. ⌘K real: páginas + `buscarPacientes` (con permiso en servidor).
- 06-oct: Fase 4 cerrada. KPIs por rol según permisos reales ("por cobrar" solo con finance:view, igual que el servidor). StatusStrip elige uno de los banners existentes; selector de simulación movido a /ajustes.
