# Runbook — mover Alika a dominio propio

Hoy todo vive en `https://alika-omega.vercel.app`. Este runbook lista **cada** lugar que hay que tocar el día que se elija el nombre y se compre el dominio, en el orden que evita cortes. Inventario hecho el 06-oct-2026 con `grep` sobre el repo; si se agrega una integración nueva, sumarla acá.

En los ejemplos, `app.NUEVO.com` es la app y `NUEVO.com` el dominio raíz. Ajustar a lo que se decida.

## Regla de oro

**No dar de baja `alika-omega.vercel.app`.** Queda como alias del mismo proyecto en Vercel (no cuesta nada), porque ya hay URLs con ese dominio afuera:

- links del portal del paciente y del portal de laboratorio ya enviados por WhatsApp (se arman con `window.location.origin` en el momento de generarlos: `portal-link-button.tsx`, `laboratorios.tsx`);
- emails de confirmación de cuenta ya enviados (`auth.tsx`, `emailRedirectTo`);
- el webhook LIVE de Stripe hasta que se cambie (paso 4).

## Orden

### 1. DNS y Vercel (sin impacto)

1. Vercel → proyecto `alika` (team `maxnovaluci-global`) → Settings → Domains → agregar `app.NUEVO.com` (y `NUEVO.com` si la landing va en la raíz).
2. Cargar en el DNS los registros que indique Vercel. Esperar el ✅ y el certificado.
3. Verificar: `curl -sI https://app.NUEVO.com/api/health` → 200, y que los headers de seguridad (CSP con nonce, HSTS) son los mismos que en el dominio viejo.

### 2. Supabase Auth (antes de anunciar nada)

Dashboard `hvfkygoguxvpmwslrccb` → Authentication → URL Configuration:

- **Site URL** → `https://app.NUEVO.com`.
- **Redirect URLs**: agregar `https://app.NUEVO.com/**` y **mantener** `https://alika-omega.vercel.app/**`.

Sin esto, Google OAuth (`auth.tsx` → `redirectTo: origin + "/auth"`) y los links de confirmación por email rebotan.

### 3. Google OAuth (proyecto personal de Google Cloud)

- OAuth consent screen: dominio autorizado `NUEVO.com`, links de privacidad y términos → `https://app.NUEVO.com/privacidad` y `/terminos`. Esto es lo que hoy muestra el dominio genérico de Vercel en la pantalla de Google.
- El _redirect URI_ autorizado es el callback de Supabase (`https://hvfkygoguxvpmwslrccb.supabase.co/auth/v1/callback`): **no cambia**.
- Recomendado aprovechar para mover el proyecto de Google Cloud a la cuenta de empresa.

### 4. Stripe

- Webhook LIVE: crear un endpoint nuevo en `https://app.NUEVO.com/api/stripe/webhook` con los mismos eventos que el actual, copiar su signing secret a `STRIPE_WEBHOOK_SECRET` en Vercel (Production) y redeployar. Recién cuando un evento real llegue OK al nuevo, desactivar el viejo.
- `success_url` / `cancel_url` / `return_url` del Checkout y del portal de facturación se arman con `window.location.origin` (`suscripcion.tsx`): se ajustan solos.
- Si para entonces ya existe la cuenta propia de Stripe, hacer las dos cosas juntas (cuenta nueva + webhook nuevo) para que Checkout deje de mostrar "DypOS".

### 5. Variables de entorno (Vercel → Production) y redeploy

| Variable         | Valor nuevo                                   | La usan                                                                                                |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `PUBLIC_APP_URL` | `https://app.NUEVO.com`                       | canonical/OG (`seo.ts`, `__root.tsx`), `sitemap.xml`, link de `/admin/leads` en el email de lead nuevo |
| `EMAIL_FROM`     | `avisos@NUEVO.com` (o un subdominio de envío) | todos los emails; **requiere el paso 6**                                                               |

### 6. Email (Resend)

- Agregar el dominio en Resend (cuenta `maxnovaluciglobal`) y cargar SPF, DKIM y DMARC en el DNS.
- Recién con el dominio verificado, cambiar `EMAIL_FROM` (paso 5) y cargar `RESEND_API_KEY` si todavía falta. Probar con `/pruebas-email` antes de que salga cualquier email real.

### 7. Lo que vive en el repo (un PR)

- `public/robots.txt` → línea `Sitemap:` (es estático, no lee `PUBLIC_APP_URL`).
- Fallbacks `"https://alika-omega.vercel.app"` en `src/lib/seo.ts` y `src/routes/__root.tsx` → nuevo dominio. Solo aplican si falta `PUBLIC_APP_URL`, pero conviene que coincidan.
- Comentario de `src/routes/api.stripe.webhook.ts` con la URL del endpoint.
- `CLAUDE.md` (tabla de ubicaciones) y el `CLAUDE.md` de negocio.

### 8. GitHub

- Settings → Secrets and variables → Actions → **Variables** → `APP_URL = https://app.NUEVO.com`. El resumen diario (`.github/workflows/daily-digest.yml`) la lee de ahí; sin la variable sigue usando el dominio viejo, que como alias también funciona.

### 9. Meta / WhatsApp (cuando se active la Cloud API)

- App de Meta → WhatsApp → Configuración → URL del webhook → `https://app.NUEVO.com/api/whatsapp-webhook` (mismo verify token).
- La verificación de negocio de Meta puede pedir el dominio propio con email del dominio: es uno de los motivos para hacer esto antes del enrolamiento.

### 10. Otros

- Sentry (si hay DSN): agregar el dominio a _Allowed Domains_ del proyecto.
- Search Console: dar de alta `NUEVO.com` y enviar el sitemap nuevo.
- Redirigir el dominio viejo al nuevo **solo** para la landing y las páginas públicas (SEO), nunca para `/portal*`, `/api/*` ni `/auth`: esos tienen que seguir respondiendo en el dominio viejo.

## Verificación final (todo en el dominio nuevo)

- [ ] Login con Google y con email/contraseña.
- [ ] Alta de cuenta nueva: llega el email de confirmación con `From` del dominio nuevo y el link abre el dominio nuevo.
- [ ] Checkout de Stripe de punta a punta (modo test o el flujo de "Comprar") y el webhook marca la suscripción.
- [ ] Un link de portal viejo (dominio anterior) sigue abriendo.
- [ ] `/sitemap.xml` y la etiqueta canonical apuntan al dominio nuevo.
- [ ] El resumen diario corre OK desde GitHub Actions.
