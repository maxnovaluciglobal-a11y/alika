# Runbook — mover Alika a dominio propio

> **Estado (09-oct-2026): hecho con `esmalia.com`** (la app vive en la raíz, no en `app.`).
>
> - Cloudflare (registrador y DNS): `A esmalia.com → 76.76.21.21` y `CNAME www → cname.vercel-dns.com`, ambos _DNS only_. Resend: `resend._domainkey` (TXT), `send` y `rsend` (CNAME, _DNS only_), región São Paulo. Email Routing de Cloudflare: MX `route1-3.mx.cloudflare.net`, SPF `include:_spf.mx.cloudflare.net`, catch-all `*@esmalia.com → maxnovaluciglobal@gmail.com`. DMARC `p=none` con reportes a Cloudflare.
> - Vercel: dominios `esmalia.com` y `www.esmalia.com` en el proyecto `alika`; `PUBLIC_APP_URL=https://esmalia.com`, `EMAIL_FROM=Esmalia <hola@esmalia.com>`, `ALIKA_STAFF_EMAILS`, `LIFECYCLE_EMAIL_REDIRECT_TO`. GitHub: variable `APP_URL=https://esmalia.com`.
> - Supabase Auth: Site URL `https://esmalia.com`; Redirect URLs `https://esmalia.com/**`, `https://alika-omega.vercel.app/**`, `http://localhost:8080/**` (más las dos `/auth` previas).
> - Stripe: **sin cambios a propósito** (el webhook sigue en `alika-omega`, que no se redirige en `/api/*`).
> - Vercel también tiene `RESEND_API_KEY` (clave `esmalia-prod`), `EMAIL_UNSUBSCRIBE_SECRET`, `VITE_SALES_WHATSAPP` y `LIFECYCLE_EMAILS_ENABLED=true` (en modo de prueba: todo va a `LIFECYCLE_EMAIL_REDIRECT_TO`).
> - Supabase Auth: las 6 plantillas de correo con la marca Esmalia, generadas con `node scripts/plantillas-auth-supabase.mjs` (salen de `src/lib/email/plantillas-auth.ts`). Recuperar contraseña e invitación apuntan a `/auth/nueva-clave` con `token_hash`. SMTP propio (`smtp.resend.com:465`, usuario `resend`, remitente `hola@esmalia.com`): completo salvo la contraseña, que pega Walter.
> - Pendiente: la pantalla de consentimiento de Google OAuth (el proyecto de Google Cloud no está en las cuentas de Chrome); sacar `LIFECYCLE_EMAIL_REDIRECT_TO` cuando Walter apruebe cómo se ven los correos.

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

#### Recuperación de contraseña (`/auth/nueva-clave`, oct-2026)

"¿Olvidaste tu contraseña?" en `/auth` llama a `resetPasswordForEmail` con `redirectTo: origin + "/auth/nueva-clave"`. Supabase solo respeta ese `redirectTo` si está en **Redirect URLs**; si no, manda el enlace a la Site URL (el código lo desvía igual a `/auth/nueva-clave` desde `__root.tsx`, pero conviene no depender de eso).

**Hoy, antes de anunciar la función** (Authentication → URL Configuration → Redirect URLs):

- `https://alika-omega.vercel.app/auth/nueva-clave` (si ya está `https://alika-omega.vercel.app/**`, queda cubierta).
- Para probar en local: `http://localhost:8080/auth/nueva-clave`.

**El día del dominio:** sumar `https://esmalia.com/auth/nueva-clave` (o `https://app.esmalia.com/...`, según dónde viva la app; cubierto si se carga `https://<dominio>/**`) y **mantener** la de `alika-omega.vercel.app`: los enlaces ya enviados apuntan ahí y vencen solos en una hora.

**Plantilla "Reset Password"** (Authentication → Emails → Templates): la de fábrica está en inglés y sale de `noreply@mail.app.supabase.io`, con un límite de envío muy bajo. Cuando esté el SMTP propio con Resend (paso 6), configurarlo en Authentication → Emails → SMTP Settings y reescribir la plantilla con la marca Esmalia y en tuteo neutro (sin voseo, sin signos de exclamación). Sugerido: asunto "Crea tu contraseña nueva de Esmalia" y el enlace como `{{ .SiteURL }}/auth/nueva-clave?token_hash={{ .TokenHash }}&type=recovery`: con `token_hash` el enlace funciona aunque se abra en otro navegador o en la app de correo (la pantalla ya acepta ese formato, además del de fábrica `{{ .ConfirmationURL }}`). Con `{{ .SiteURL }}` la Site URL tiene que ser el dominio vigente.

Verificación: pedir un enlace para una cuenta propia de prueba, abrirlo, poner la contraseña nueva y comprobar que entra al panel. Un enlace usado dos veces tiene que mostrar "Este enlace ya no sirve".

### 3. Google OAuth (proyecto personal de Google Cloud)

- OAuth consent screen: dominio autorizado `NUEVO.com`, links de privacidad y términos → `https://app.NUEVO.com/privacidad` y `/terminos`. Esto es lo que hoy muestra el dominio genérico de Vercel en la pantalla de Google.
- El _redirect URI_ autorizado es el callback de Supabase (`https://hvfkygoguxvpmwslrccb.supabase.co/auth/v1/callback`): **no cambia**.
- Recomendado aprovechar para mover el proyecto de Google Cloud a la cuenta de empresa.

### 4. Stripe

- Webhook LIVE: crear un endpoint nuevo en `https://app.NUEVO.com/api/stripe/webhook` con los mismos eventos que el actual, copiar su signing secret a `STRIPE_WEBHOOK_SECRET` en Vercel (Production) y redeployar. Recién cuando un evento real llegue OK al nuevo, desactivar el viejo.
- `success_url` / `cancel_url` / `return_url` del Checkout y del portal de facturación se arman con `window.location.origin` (`suscripcion.tsx`): se ajustan solos.
- Si para entonces ya existe la cuenta propia de Stripe, hacer las dos cosas juntas (cuenta nueva + webhook nuevo) para que Checkout deje de mostrar "DypOS".

### 5. Variables de entorno (Vercel → Production) y redeploy

| Variable                    | Valor nuevo                                   | La usan                                                                                                |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `PUBLIC_APP_URL`            | `https://app.NUEVO.com`                       | canonical/OG (`seo.ts`, `__root.tsx`), `sitemap.xml`, link de `/admin/leads` en el email de lead nuevo |
| `EMAIL_FROM`                | `avisos@NUEVO.com` (o un subdominio de envío) | todos los emails; **requiere el paso 6**                                                               |
| `PUBLIC_APP_URL` (otra vez) | —                                             | además, los enlaces y el logo de los correos de ciclo de vida (`src/lib/email/`)                       |

### 6. Email (Resend)

- Agregar el dominio en Resend (cuenta `maxnovaluciglobal`) y cargar SPF, DKIM y DMARC en el DNS.
- Recién con el dominio verificado, cambiar `EMAIL_FROM` (paso 5) y cargar `RESEND_API_KEY` si todavía falta. Probar con `/pruebas-email` antes de que salga cualquier email real.

### 6b. Correos de ciclo de vida a la clínica (ver `docs/CORREOS.md`)

Bienvenida, fin de prueba (T-3 y T-0), suscripción activa, pago fallido y "Tu semana en la clínica". Están programados y **apagados**: no sale nada hasta el último paso de esta lista. Ninguno va a pacientes.

1. **Migración** (antes de mergear el PR que los trae, porque el backup diario ya incluye la tabla): `psql "postgresql://postgres.hvfkygoguxvpmwslrccb@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" -f supabase/migrations/20261012000000_lifecycle_emails.sql` y verificar con `select count(*) from lifecycle_emails;` → 0.
2. **Resend**: dominio verificado (paso 6), `RESEND_API_KEY` y `EMAIL_FROM` cargadas (ej. `Esmalia <hola@NUEVO.com>`). Opcional `EMAIL_REPLY_TO` si las respuestas tienen que ir a otro buzón: los correos dicen "responde este correo".
3. **Secreto de baja**: `EMAIL_UNSUBSCRIBE_SECRET` = `openssl rand -base64 48` (Vercel → Production). Sin él, el reporte semanal no sale (los transaccionales sí).
4. **Modo de prueba primero**: `LIFECYCLE_EMAIL_REDIRECT_TO = <correo de Walter>` y `LIFECYCLE_EMAILS_ENABLED = true`. Redeploy. Todo llega a esa casilla con el asunto `[PRUEBA → destinatario real]`.
   - Disparar a mano: GitHub → Actions → "Correos de ciclo de vida" → _Run workflow_ (o `curl -H "Authorization: Bearer $CRON_SECRET" https://app.NUEVO.com/api/lifecycle-emails`). El reporte semanal solo sale un lunes entre 8:00 y 11:59 hora de la clínica.
   - Crear una clínica de prueba con el onboarding → llega la bienvenida.
   - Revisar en Gmail y en Outlook (web y móvil): logo, botón, tablas, enlace de baja.
   - Ojo: lo enviado en modo de prueba **cuenta como enviado** en `lifecycle_emails` (misma clave). Para repetir una prueba: `delete from lifecycle_emails where redirected_to is not null;`.
5. **Encender**: borrar `LIFECYCLE_EMAIL_REDIRECT_TO` y redeploy. Mirar los logs de Vercel (`[lifecycle-email]`) y la tabla `lifecycle_emails` la primera semana.
6. **Apagar en caso de problema**: `LIFECYCLE_EMAILS_ENABLED = false` (o borrarla) y redeploy. El endpoint responde `{"habilitado":false}` sin tocar la base.

### 7. Lo que vive en el repo (un PR)

- `public/robots.txt` → línea `Sitemap:` (es estático, no lee `PUBLIC_APP_URL`).
- Fallbacks `"https://alika-omega.vercel.app"` en `src/lib/seo.ts` y `src/routes/__root.tsx` → nuevo dominio. Solo aplican si falta `PUBLIC_APP_URL`, pero conviene que coincidan.
- Comentario de `src/routes/api.stripe.webhook.ts` con la URL del endpoint.
- `CLAUDE.md` (tabla de ubicaciones) y el `CLAUDE.md` de negocio.

### 8. GitHub

- Settings → Secrets and variables → Actions → **Variables** → `APP_URL = https://app.NUEVO.com`. El resumen diario (`.github/workflows/daily-digest.yml`) y los correos de ciclo de vida (`.github/workflows/lifecycle-emails.yml`) la leen de ahí; sin la variable siguen usando el dominio viejo, que como alias también funciona. Los dos usan el mismo secret `CRON_SECRET`, que ya existe.

### 9. Meta / WhatsApp (cuando se active la Cloud API)

- App de Meta → WhatsApp → Configuración → URL del webhook → `https://app.NUEVO.com/api/whatsapp-webhook` (mismo verify token).
- La verificación de negocio de Meta puede pedir el dominio propio con email del dominio: es uno de los motivos para hacer esto antes del enrolamiento.

### 10. Otros

- Sentry (si hay DSN): agregar el dominio a _Allowed Domains_ del proyecto.
- Search Console: dar de alta `NUEVO.com` y enviar el sitemap nuevo.
- Redirigir el dominio viejo al nuevo **solo** para la landing y las páginas públicas (SEO), nunca para `/portal*`, `/api/*` ni `/auth`: esos tienen que seguir respondiendo en el dominio viejo.

## Verificación final (todo en el dominio nuevo)

- [ ] Login con Google y con email/contraseña.
- [ ] "¿Olvidaste tu contraseña?": el enlace del correo abre `/auth/nueva-clave` en el dominio nuevo y permite guardar la contraseña.
- [ ] Alta de cuenta nueva: llega el email de confirmación con `From` del dominio nuevo y el link abre el dominio nuevo.
- [ ] Checkout de Stripe de punta a punta (modo test o el flujo de "Comprar") y el webhook marca la suscripción.
- [ ] Un link de portal viejo (dominio anterior) sigue abriendo.
- [ ] `/sitemap.xml` y la etiqueta canonical apuntan al dominio nuevo.
- [ ] El resumen diario corre OK desde GitHub Actions.
- [ ] El workflow "Correos de ciclo de vida" responde 200 y, en modo de prueba, llegan las muestras a la casilla de Walter con el logo cargado desde el dominio nuevo.
