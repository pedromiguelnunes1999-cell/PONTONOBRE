#!/usr/bin/env bash
#
# Otimização de imagens — Ponto Nobre Eventos
#
# Gera as versões servidas ao público a partir dos ficheiros originais,
# que ficam preservados em images/_originais/ e nunca são publicados.
#
# Estrutura resultante:
#   images/_originais/        originais intactos (JPG/PNG de câmara)
#   images/gallery/*.webp     miniaturas da grelha  (largura 700px)
#   images/gallery/full/      alta resolução do lightbox (altura 1800px)
#   images/*.webp             hero, about e events otimizados
#
# O script é idempotente: pode ser executado as vezes que forem precisas,
# porque lê sempre a partir de images/_originais/.
#
# Uso:  ./scripts/optimize-images.sh
# Requer: cwebp  (brew install webp)

set -euo pipefail

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly IMAGES="${ROOT}/images"
readonly ORIGINALS="${IMAGES}/_originais"

# Miniaturas da grelha: apresentadas a 285px, 700px cobre ecrãs Retina.
readonly THUMB_WIDTH=700
readonly THUMB_QUALITY=82

# Lightbox: limitado pela altura (max 820px em CSS), 1800px cobre Retina.
readonly FULL_HEIGHT=1800
readonly FULL_QUALITY=88

readonly PAGE_QUALITY=82

log()   { printf '\033[0;36m›\033[0m %s\n' "$1"; }
ok()    { printf '\033[0;32m✓\033[0m %s\n' "$1"; }
fail()  { printf '\033[0;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

command -v cwebp >/dev/null 2>&1 || fail 'cwebp não encontrado. Instale com: brew install webp'

# ---------------------------------------------------------------------------
# 1. Preservar os originais (apenas na primeira execução)
# ---------------------------------------------------------------------------

if [[ ! -d "${ORIGINALS}" ]]; then
    log 'A arquivar os ficheiros originais em images/_originais/…'
    mkdir -p "${ORIGINALS}/gallery"

    shopt -s nullglob
    for file in "${IMAGES}"/gallery/*.jpg "${IMAGES}"/gallery/*.jpeg "${IMAGES}"/gallery/*.png; do
        mv "${file}" "${ORIGINALS}/gallery/"
    done
    for file in "${IMAGES}"/*.jpg "${IMAGES}"/*.jpeg "${IMAGES}"/*.png; do
        mv "${file}" "${ORIGINALS}/"
    done
    shopt -u nullglob

    ok 'Originais arquivados.'
fi

mkdir -p "${IMAGES}/gallery/full"

# ---------------------------------------------------------------------------
# 2. Galeria — duas versões por fotografia
# ---------------------------------------------------------------------------

log 'A gerar a galeria…'
count=0

shopt -s nullglob
for source in "${ORIGINALS}"/gallery/*; do
    name="$(basename "${source}")"
    name="${name%.*}"

    cwebp -quiet -q "${THUMB_QUALITY}" -resize "${THUMB_WIDTH}" 0 -m 6 \
        "${source}" -o "${IMAGES}/gallery/${name}.webp"

    cwebp -quiet -q "${FULL_QUALITY}" -resize 0 "${FULL_HEIGHT}" -m 6 \
        "${source}" -o "${IMAGES}/gallery/full/${name}.webp"

    count=$((count + 1))
done
shopt -u nullglob

ok "Galeria: ${count} fotografias em duas resoluções."

# ---------------------------------------------------------------------------
# 3. Imagens de página — largura máxima por contexto de utilização
# ---------------------------------------------------------------------------

log 'A gerar as imagens de página…'

convert_page_image() {
    local name="$1" max_width="$2" quality="${3:-${PAGE_QUALITY}}" source=''

    for candidate in "${ORIGINALS}/${name}.jpg" "${ORIGINALS}/${name}.png" "${ORIGINALS}/${name}.jpeg"; do
        [[ -f "${candidate}" ]] && { source="${candidate}"; break; }
    done

    [[ -n "${source}" ]] || { printf '  (ignorado: %s não encontrado)\n' "${name}"; return; }

    cwebp -quiet -q "${quality}" -resize "${max_width}" 0 -m 6 \
        "${source}" -o "${IMAGES}/${name}.webp"
}

# O hero é o maior elemento visível ao abrir o site (LCP), pelo que
# mantém qualidade alta. As restantes são decorativas e ficam mais leves.
convert_page_image 'hero-bg' 1920 82   # fundo de ecrã inteiro
convert_page_image 'events'  1920 74   # faixa horizontal, carregada em lazy
convert_page_image 'about'   1000 80   # coluna de aproximadamente 570px

ok 'Imagens de página geradas.'

# ---------------------------------------------------------------------------
# 4. Relatório
# ---------------------------------------------------------------------------

# du reporta blocos de disco alocados, que exageram o total em ficheiros
# pequenos. Somamos os bytes reais para obter o peso efetivo transferido.
total_bytes() {
    find "$1" -maxdepth "${2:-1}" -name '*.webp' -exec ls -l {} + \
        | awk '{ s += $5 } END { printf "%.2f MB", s / 1048576 }'
}

printf '\n'
printf 'Originais preservados : %s\n' "$(du -sh "${ORIGINALS}" | cut -f1)"
printf 'Miniaturas da grelha  : %s\n' "$(total_bytes "${IMAGES}/gallery")"
printf 'Alta resolução        : %s\n' "$(total_bytes "${IMAGES}/gallery/full")"
printf 'Imagens de página     : %s\n' "$(total_bytes "${IMAGES}")"
printf '\n'
ok 'Concluído.'
