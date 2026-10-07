#!/usr/bin/env bash
# Regenera el favicon y los íconos de la PWA con el sistema visual actual:
# isotipo "Cúspide" (el mismo trazo de src/components/alika-logo.tsx) en ocre
# #b68235 sobre papel #f3f2f2. Mantiene los nombres y tamaños que referencian
# public/manifest.webmanifest y src/routes/__root.tsx.
#
# Requiere rsvg-convert (librsvg) e ImageMagick 7 (`magick`):
#   brew install librsvg imagemagick
# Uso, desde la raíz del repo:
#   bash scripts/generar-iconos.sh
set -euo pipefail

PAPEL="#f3f2f2"
OCRE="#b68235"
# Trazo del isotipo en un viewBox de 100x100 (alika-logo.tsx). Su caja va de
# x 28-73 e y 23-73, así que el centro óptico es (50.5, 48).
TRAZO="M 55 23 L 73 71 L 28 73 Z"

OUT="public"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# $1 = archivo, $2 = radio de las esquinas del fondo (0 = cuadrado lleno),
# $3 = escala del isotipo (fracción del lado), $4 = grosor del trazo.
svg() {
  cat >"$1" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="$2" fill="$PAPEL"/>
  <g transform="translate(50 50) scale($3) translate(-50.5 -48)">
    <path d="$TRAZO" fill="none" stroke="$OCRE" stroke-width="$4"
      stroke-linejoin="round" stroke-linecap="round"/>
  </g>
</svg>
SVG
}

# "any": esquinas redondeadas propias, el sistema no recorta.
svg "$TMP/any.svg" 22 0.6 10
# "maskable": fondo a sangre y el isotipo dentro de la zona segura (80 %).
svg "$TMP/maskable.svg" 0 0.46 10
# apple-touch-icon: sin transparencia, iOS redondea solo.
svg "$TMP/apple.svg" 0 0.6 10
# favicon: el trazo más grueso para que se lea a 16 px.
svg "$TMP/favicon.svg" 20 0.72 13

png() { rsvg-convert -w "$2" -h "$2" "$1" -o "$3"; }

png "$TMP/any.svg" 192 "$OUT/icons/icon-192.png"
png "$TMP/any.svg" 512 "$OUT/icons/icon-512.png"
png "$TMP/maskable.svg" 512 "$OUT/icons/icon-maskable-512.png"
png "$TMP/apple.svg" 180 "$TMP/apple.png"
# Sin canal alfa: iOS pinta de negro lo transparente.
magick "$TMP/apple.png" -background "$PAPEL" -alpha remove -alpha off \
  "$OUT/icons/apple-touch-icon.png"

for s in 16 32 48; do png "$TMP/favicon.svg" "$s" "$TMP/fav-$s.png"; done
magick "$TMP/fav-16.png" "$TMP/fav-32.png" "$TMP/fav-48.png" "$OUT/favicon.ico"

# Sin metadatos y con compresión máxima: son dos colores planos, así que
# pesan una fracción del original (icon-512 pasó de 230 KB a ~11 KB).
for f in "$OUT"/icons/icon-*.png "$OUT/icons/apple-touch-icon.png"; do
  magick "$f" -strip -define png:compression-level=9 "$f"
done

ls -l "$OUT/favicon.ico" "$OUT"/icons/*.png
