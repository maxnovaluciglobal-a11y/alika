# Rediseño Alika — progreso (checkpoint para retomar)

Plan: [`PLAN_EJECUCION.md`](./PLAN_EJECUCION.md). Si la sesión se cortó: `git checkout` de la última rama listada abajo y seguir con el primer ítem sin tildar.

## Fase 1 — Sistema visual único · rama `redesign/fase-1` ✅

- [x] Tokens nuevos en `styles.css` + mapping shadcn + dark
- [x] Fuentes en `__root.tsx`
- [x] `button` / `badge` / `card`
- [x] Reemplazo de clay/ink/mint/bone en `src/` (grep = 0)
- [x] Gates (typecheck, lint, tests, build, visual) + commit

## Fase 2 — Landing · rama `redesign/fase-2`

- [ ] Nav + hero con pantalla "Hoy" en HTML
- [ ] Pilotos + calculadora embebida + tres resultados
- [ ] Testimonio + precios con moneda + cierre wa.me
- [ ] Tuteo en el sitio público + evento `demo_click`
- [ ] Gates + commit

## Fase 3 — Navegación · rama `redesign/fase-3`

- [ ] `navGroups` a 6 destinos + Ajustes
- [ ] Hubs `ajustes`, `mensajes`, `reportes`
- [ ] ⌘K arriba del sidebar
- [ ] Gates + commit

## Fase 4 — Hoy por rol · rama `redesign/fase-4`

- [ ] Dashboard nuevo por rol
- [ ] `status-strip.tsx` reemplaza los 5 banners
- [ ] Gates + commit

## Fase 5 — Ficha y móvil · rama `redesign/fase-5`

- [ ] Cabecera fija + pestañas en la ficha
- [ ] Estados con texto
- [ ] Barra inferior móvil + cola de confirmación
- [ ] Gates + commit

## Registro

- 06-oct: handoff copiado a `docs/design_handoff_alika_rediseno/`; plan y línea base escritos.
- 06-oct: Fase 1 cerrada. Nota: las pantallas autenticadas no se verificaron visualmente (el demo escribe un lead en prod); revisar con login real.
