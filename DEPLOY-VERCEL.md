# Oralia en Vercel — variables de entorno

Guía completa de las variables que necesita el proyecto al desplegarse en Vercel:
qué son, ejemplos de valores, si son de **cliente** (build-time, viajan al navegador)
o de **servidor** (runtime, nunca salen del backend), y dónde configurarlas.

---

## 1. Dónde se configuran

Todas se cargan en el mismo sitio:

**Vercel → tu proyecto → Settings → Environment Variables**

Para cada variable eliges:

| Campo | Qué poner |
|---|---|
| **Key** | Nombre exacto (distingue mayúsculas) |
| **Value** | El valor |
| **Environments** | `Production`, `Preview`, `Development` (marca las que apliquen) |
| **Sensitive** | Actívalo en todos los secretos de servidor (service role, API keys) |

Después de crear o cambiar una variable hay que **volver a desplegar**
(Deployments → ⋯ → Redeploy). Vercel no reinyecta variables en un build existente.

Para desarrollo local: `vercel env pull .env.local`, o copia `.env.example` a `.env`.

---

## 2. Cliente vs servidor (regla clave)

- **`VITE_*` = cliente.** Vite las incrusta en el bundle del navegador **durante el
  build**. Son públicas: cualquiera puede leerlas desde el navegador. Nunca pongas
  aquí una clave secreta. Si cambian, hay que reconstruir.
- **Sin prefijo `VITE_` = servidor.** Solo existen en runtime dentro de las server
  functions y rutas de servidor (`process.env.X`), leídas **dentro del handler**.
  Nunca llegan al navegador.

En Vercel ambas se declaran en la misma pantalla; la diferencia la marca el prefijo.

---

## 3. Variables de cliente (build-time, públicas)

| Variable | Ejemplo | Para qué sirve |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://abcdefghijkl.supabase.co` | Endpoint del backend que usa el navegador |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_2AbTDQeXrz...` | Clave pública del cliente; la seguridad real la impone RLS |
| `VITE_SUPABASE_PROJECT_ID` | `abcdefghijkl` | Referencia del proyecto (utilidades y scripts) |

Marca las tres en `Production`, `Preview` y `Development`. **No** las marques como
Sensitive: Vercel oculta el valor incluso para el build y quedan vacías en el bundle.

---

## 4. Variables de servidor (runtime, secretas)

| Variable | Ejemplo | Para qué sirve | ¿Obligatoria? |
|---|---|---|---|
| `SUPABASE_URL` | `https://abcdefghijkl.supabase.co` | Mismo endpoint, usado desde el servidor | Sí |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_2AbTDQeXrz...` | Lecturas públicas en SSR con RLS aplicada | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_9Kd...` (o JWT `eyJhbGci...`) | Operaciones privilegiadas que saltan RLS. **Solo servidor, siempre Sensitive** | Sí |
| `SUPABASE_DB_URL` | `postgresql://postgres:CLAVE@db.abcdefghijkl.supabase.co:5432/postgres` | Migraciones y backups (CLI, no la app) | Opcional |

### Inteligencia artificial (notas clínicas, resúmenes, extracción estructurada)

| Variable | Ejemplo | Notas |
|---|---|---|
| `LOVABLE_API_KEY` | `lov_...` | Solo funciona dentro del hosting de Lovable. **Fuera de Lovable no sirve**: en Vercel usa una clave propia |
| `GEMINI_API_KEY` | `AIzaSyD...` | Clave propia de Google AI Studio; alternativa recomendada en Vercel |
| `OPENAI_API_KEY` | `sk-proj-...` | Alternativa si prefieres OpenAI |

Las funciones de IA requieren al menos una de estas claves; sin ninguna, los
asistentes de notas devuelven error de configuración.

### Email (avisos de revisión clínica, pruebas de entregabilidad)

| Variable | Ejemplo | Notas |
|---|---|---|
| `EMAIL_FROM` | `avisos@notificaciones.tuclinica.com` | Remitente; debe pertenecer al dominio verificado con SPF/DKIM/DMARC |
| `RESEND_API_KEY` | `re_ABc123...` | Proveedor de envío fuera de Lovable |
| `EMAIL_SANDBOX` | `true` | Bloquea envíos reales durante la validación. Déjalo en `true` en Preview |
| `EMAIL_SANDBOX_REDIRECT_TO` | `qa@tuclinica.com` | Dirección a la que se redirige todo en sandbox |

### URL pública

| Variable | Ejemplo | Notas |
|---|---|---|
| `PUBLIC_APP_URL` | `https://oralia.tuclinica.com` | Enlaces absolutos en emails y retornos de OAuth. En Preview usa la URL de despliegue |

---

## 5. Valores recomendados por entorno

| Variable | Production | Preview | Development |
|---|---|---|---|
| `VITE_SUPABASE_*` / `SUPABASE_*` | proyecto productivo | proyecto de staging | proyecto local o de staging |
| `EMAIL_SANDBOX` | `false` (solo tras validar el dominio) | `true` | `true` |
| `PUBLIC_APP_URL` | dominio propio | URL del deployment | `http://localhost:3000` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sensitive | Sensitive | Sensitive |

---

## 6. Configuración del proyecto en Vercel

El repositorio ya incluye `vercel.json`, así que **no hace falta tocar nada** en la UI:

| Ajuste | Valor (ya definido en `vercel.json`) |
|---|---|
| Framework Preset | Other (`framework: null`) |
| Install Command | `npm install` |
| Build Command | `npm run build:vercel` (`NITRO_PRESET=vercel vite build`) |
| Output Directory | `.vercel/output` (Build Output API que genera Nitro) |
| Node.js Version | 22.x (fijada en `.nvmrc` y en `engines`) |

Cómo funciona: `vite.config.ts` pasa el preset de Nitro desde `NITRO_PRESET`; con
`vercel` el build produce la función de servidor en `.vercel/output/functions/__server.func`
y los estáticos en `.vercel/output/static`. Vercel los sirve directamente: SSR, server
functions y rutas de API funcionan sin configuración extra de rutas ni reescrituras.
Si no defines `NITRO_PRESET`, Nitro autodetecta la plataforma (en Vercel también
resuelve `vercel`), y dentro de Lovable el preset sigue siendo el propio de la plataforma.

`HOST`, `PORT` y `NITRO_PRESET=node-server` son propios del despliegue en VPS/Docker
(ver `DEPLOY-SELFHOSTING.md`). Vercel gestiona el puerto y el runtime.

---

## 7. Verificación tras el despliegue

1. La app carga y el login funciona → las `VITE_SUPABASE_*` se inyectaron en el build.
2. Un listado de pacientes carga en SSR → `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` están bien.
3. Generar una nota con IA responde → la clave de IA está configurada.
4. **Pruebas de email** registra un envío → email configurado; si aparece
   `domain_not_configured`, falta remitente o verificación DNS.
5. Errores como `supabaseUrl is required` o `Invalid API key` indican una variable
   ausente o un redeploy pendiente tras cambiarla.

---

## 8. Checklist mínima para producción

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY      (Sensitive)
GEMINI_API_KEY  u  OPENAI_API_KEY   (Sensitive)
EMAIL_FROM
RESEND_API_KEY                 (Sensitive)
EMAIL_SANDBOX
EMAIL_SANDBOX_REDIRECT_TO
PUBLIC_APP_URL
```

Nunca commitees valores reales: `.env.example` documenta los nombres, los valores
viven solo en Vercel.
