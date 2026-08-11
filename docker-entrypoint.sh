#!/bin/sh
set -e

# Script de arranque de Oralia (self-hosting)
# Valida las variables mínimas y levanta el servidor Nitro (Node).

missing=""
for var in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY; do
  eval "value=\$$var"
  if [ -z "$value" ]; then
    missing="$missing $var"
  fi
done

if [ -n "$missing" ]; then
  echo "[oralia] ERROR: faltan variables de entorno obligatorias:$missing" >&2
  echo "[oralia] Revisa .env.example y DEPLOY-SELFHOSTING.md" >&2
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "[oralia] AVISO: SUPABASE_SERVICE_ROLE_KEY no definida; las operaciones administrativas del servidor fallarán." >&2
fi

if [ -z "$LOVABLE_API_KEY" ] && [ -z "$GEMINI_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
  echo "[oralia] AVISO: sin clave de IA (GEMINI_API_KEY / OPENAI_API_KEY); el asistente clínico quedará inactivo." >&2
fi

echo "[oralia] Iniciando servidor en ${HOST:-0.0.0.0}:${PORT:-3000} (NODE_ENV=${NODE_ENV:-production})"
exec node .output/server/index.mjs
