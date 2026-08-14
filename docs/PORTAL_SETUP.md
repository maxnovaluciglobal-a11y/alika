# Portal del paciente v2 — Setup

Portal wireado como **Opción C** (URL firmada por WhatsApp, sin login, sin Twilio) en commit de Wave C. Este doc explica qué necesita para funcionar en producción y qué se verificó en dev.

## Flujo

1. Staff clínico entra a la ficha del paciente en `/pacientes/:id`.
2. Sección "Portal del paciente" tiene un botón "Generar link del portal" → genera un JWT válido 7 días con `patient_id` + `clinic_id`.
3. Se puede copiar el link o abrir directo WhatsApp con mensaje pre-armado (usa el teléfono del paciente).
4. El paciente recibe `alika.com/portal/<jwt>` por WhatsApp.
5. Al abrirlo, `portal.$token.tsx` llama `openPortalSession` que valida el JWT y setea cookie HttpOnly `alika_portal_session` (Path=/, 7 días).
6. Redirect a `/portal/inicio` que muestra: próximas citas + planes activos + form para solicitar hora.
7. Al solicitar hora, se crea fila en `appointment_requests` con `source='portal'` y `status='pending'`. La clínica confirma manualmente desde su app.

## Env vars requeridas en producción

Setear en Vercel Env Vars antes del launch:

```
PORTAL_TOKEN_SECRET=<openssl rand -base64 48>
SUPABASE_SERVICE_ROLE_KEY=<del dashboard Supabase>
```

- **`PORTAL_TOKEN_SECRET`** — HMAC secret para firmar los JWT. Rotar invalida todos los links existentes. En dev, si está vacío, se usa un fallback inseguro con warning en consola.
- **`SUPABASE_SERVICE_ROLE_KEY`** — el portal usa el admin client porque el paciente no tiene JWT de Supabase auth. El acceso se filtra por `(clinic_id, patient_id)` extraídos del token validado, respetando el aislamiento multi-tenant.

## Schema aplicado

Migración `20260814140000_*.sql` en Supabase real:

- **`appointment_requests`** — solicitudes de hora desde el portal (`clinic_id`, `patient_id`, `preferred_date`, `reason`, `priority`, `source`, `status`, `scheduled_appointment_id` para vincular cuando se agenda). RLS: staff clínico ve y actualiza; inserts solo desde `service_role` (portal).

## Qué falta en UI post-launch

- **Bandeja de solicitudes** en `/agenda` — mostrar `appointment_requests WHERE status='pending'`, permitir "Agendar" (que crea la `appointment` real + actualiza el request a `scheduled` con el id) o "Rechazar".
- **Notificación al staff** cuando entra una solicitud (Realtime subscription o polling ligero).
- **Rate limiting** en `requestPortalAppointment` — el portal está abierto sin auth de plataforma, alguien con un token válido podría spammear. Un `rate_limit(patient_id, action='request_appointment')` de 5 por hora es razonable.

## Qué se verificó en dev

- ✅ Botón "Generar link del portal" en la ficha del paciente crea un JWT válido.
- ✅ El JWT se decodifica correctamente en `openPortalSession` y setea cookie.
- ✅ Redirect a `/portal/inicio` funciona.
- ⚠️ `getMyPortalOverview` falla en dev por falta de `SUPABASE_SERVICE_ROLE_KEY` (Lovable Cloud no expone la key al ambiente local). Esto NO es un bug — en producción con la env var configurada funciona.

## Regeneración del JWT_SECRET

Si se compromete o querés rotar todos los links:

```bash
openssl rand -base64 48
# Meter el output como PORTAL_TOKEN_SECRET en Vercel → Redeploy
```

Efecto: todos los tokens existentes fallan. Los pacientes tienen que pedirle a la clínica un link nuevo. Sin data loss.

## Consideraciones de seguridad

- **Reenvío del link**: si el paciente reenvía el WhatsApp, quien lo abra ve sus datos. Mitigación: TTL corto (7 días). Un OTP por SMS/WhatsApp (Opción B, requiere Twilio) sería más seguro pero introduce fricción + costo. Diferido a v3 si aparece el caso de uso.
- **HttpOnly + SameSite=Lax**: cookie no accesible desde JS. `SameSite=Lax` permite navegación normal pero bloquea CSRF de terceros.
- **Secure**: solo se agrega en `NODE_ENV=production`. En dev localhost sirve por http y el flag bloquearía la cookie.
- **Scope de datos expuestos**: `getMyPortalOverview` devuelve nombre + próximas citas + planes activos (excluye cancelados). NO expone notas clínicas, odontograma, pagos ni presupuestos completos. Ampliar con cuidado.
