# Oralia

Sistema operativo cloud-first para clínicas dentales en Latinoamérica. Nacido como
prototipo en [Lovable](https://lovable.dev), en desarrollo activo desde este repo.

> El nombre de proyecto en Lovable es "Aurora Dental OS"; la marca del producto,
> en todo el código y la documentación, es **Oralia**.

## Estado actual (2026-08-11)

Prototipo navegable con auth, creación de clínica y roles reales sobre Supabase.
**Agenda, Pacientes, Dashboard y Tratamientos corren sobre datos de muestra
(`src/lib/clinic-data.ts`), todavía no sobre tablas reales** — ver
[`docs/PLAN_ACCION.md`](docs/PLAN_ACCION.md) para el detalle y las fases siguientes.

Módulos con backend real (Supabase + RLS, sin datos de muestra):
notas clínicas (versionado, revisión, auditoría), notificaciones en tiempo real,
equipo y permisos, exportación de compliance, y el subsistema de dominio/email.

Ver también [`docs/Oralia_Documento_Maestro_v1.md`](docs/Oralia_Documento_Maestro_v1.md)
para visión de producto, modelo de datos objetivo y roadmap completo.

## Desarrollo local

```sh
npm i
npm run dev
```

Necesitas un `.env` con las variables de `.env.example` (Supabase + al menos una
clave de IA: `GEMINI_API_KEY` u `OPENAI_API_KEY`).

## Stack

- TanStack Start (SSR) + React 19 + Vite 8 + TypeScript
- Tailwind 4 + shadcn/ui
- Supabase (Postgres, Auth, Storage, Realtime)
- Deploy: Vercel o self-hosting con Docker (ver `DEPLOY-VERCEL.md` / `DEPLOY-SELFHOSTING.md`)

## Build con Lovable

Este proyecto sigue conectado a [Lovable](https://lovable.dev). Ver `AGENTS.md`
antes de hacer force-push o reescribir historia en `main`: rompe el sync.
