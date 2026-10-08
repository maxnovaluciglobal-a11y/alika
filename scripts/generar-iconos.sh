#!/usr/bin/env bash
# Regenera el favicon y los íconos de la PWA con la marca Esmalia: el
# monograma "E" con forma de muela (scripts/marca/esmalia-monograma.svg, el
# mismo dibujo que la variante `icon` de src/components/esmalia-logo.tsx) en
# ocre oscuro #7d5411 sobre papel #f3f2f2. Mantiene los nombres y tamaños que
# referencian public/manifest.webmanifest y src/routes/__root.tsx.
#
# La imagen social (og:image) sale de otro script, porque necesita las
# tipografías web: node scripts/generar-og.mjs
#
# Requiere rsvg-convert (librsvg) e ImageMagick 7 (`magick`):
#   brew install librsvg imagemagick
# Uso, desde la raíz del repo:
#   bash scripts/generar-iconos.sh
set -euo pipefail

PAPEL="#f3f2f2"
FUENTE="scripts/marca/esmalia-monograma.svg"

# El monograma mide 286.7 × 366.2 (viewBox del SVG fuente).
MONO_W=286.7
MONO_H=366.2
VIEWBOX="$(sed -E 's/.*viewBox="([^"]*)".*/\1/' "$FUENTE")"
TRAZOS="$(sed -E 's/^<svg[^>]*>(.*)<\/svg>$/\1/' "$FUENTE")"

OUT="public"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# $1 = archivo, $2 = radio de las esquinas del fondo (0 = cuadrado lleno),
# $3 = alto del monograma como fracción del lado (el ancho sale de la
# proporción). Todo en un lienzo de 100 × 100, centrado.
svg() {
  local h w x y
  h="$(awk -v f="$3" 'BEGIN { printf "%.3f", 100 * f }')"
  w="$(awk -v h="$h" -v mw="$MONO_W" -v mh="$MONO_H" 'BEGIN { printf "%.3f", h * mw / mh }')"
  x="$(awk -v w="$w" 'BEGIN { printf "%.3f", (100 - w) / 2 }')"
  y="$(awk -v h="$h" 'BEGIN { printf "%.3f", (100 - h) / 2 }')"
  cat >"$1" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="$2" fill="$PAPEL"/>
  <svg x="$x" y="$y" width="$w" height="$h" viewBox="$VIEWBOX">$TRAZOS</svg>
</svg>
SVG
}

# "any": esquinas redondeadas propias, el sistema no recorta.
svg "$TMP/any.svg" 22 0.6
# "maskable": fondo a sangre y el monograma dentro de la zona segura (círculo
# del 80 %): con alto 0.54 la esquina más lejana queda a ~34 de radio.
svg "$TMP/maskable.svg" 0 0.54
# apple-touch-icon: sin transparencia, iOS redondea solo.
svg "$TMP/apple.svg" 0 0.6
# favicon: el monograma más grande para que se lea a 16 px.
svg "$TMP/favicon.svg" 20 0.76

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

# Sin metadatos y con compresión máxima: son dos colores planos.
for f in "$OUT"/icons/icon-*.png "$OUT/icons/apple-touch-icon.png"; do
  magick "$f" -strip -define png:compression-level=9 "$f"
done

ls -l "$OUT/favicon.ico" "$OUT"/icons/*.png
