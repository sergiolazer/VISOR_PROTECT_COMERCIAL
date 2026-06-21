#!/usr/bin/env bash
# Exporta / importa secretos entre regiones para la fase 2 (sa-east-1 → us-east-1).
#
# Uso:
#   # 1. Antes del apply — exportar desde sa-east-1
#   ./scripts/phase2-secrets.sh export ./secrets-phase2.json
#
#   # 2. Tras el apply en us-east-1 — importar
#   ./scripts/phase2-secrets.sh import ./secrets-phase2.json us-east-1
#
# Requiere: AWS CLI, jq. NO subas secrets-phase2.json al repositorio.

set -euo pipefail

PREFIX="${SECRET_PREFIX:-visor-protect-production}"
SRC_REGION="${SRC_REGION:-sa-east-1}"
DST_REGION="${DST_REGION:-us-east-1}"

SECRETS=(
  "${PREFIX}/mongo-uri"
  "${PREFIX}/jwt-secret"
  "${PREFIX}/cloudinary"
)

usage() {
  echo "Uso:"
  echo "  $0 export <archivo.json>              # lee ${SRC_REGION}"
  echo "  $0 import <archivo.json> [region]     # escribe en region (default ${DST_REGION})"
  exit 1
}

cmd_export() {
  local out="$1"
  if [ -f "$out" ]; then
    echo "El archivo $out ya existe. Usa otro nombre o elimínalo."
    exit 1
  fi
  echo "Exportando desde ${SRC_REGION} → $out"
  tmp=$(mktemp)
  echo "{}" > "$tmp"
  for name in "${SECRETS[@]}"; do
    echo -n "  $name ... "
    value=$(aws secretsmanager get-secret-value \
      --region "$SRC_REGION" \
      --secret-id "$name" \
      --query SecretString \
      --output text 2>/dev/null) || {
      echo "FALLO (¿existe y tienes permisos?)"
      rm -f "$tmp"
      exit 1
    }
    jq --arg k "$name" --arg v "$value" '. + {($k): $v}' "$tmp" > "${tmp}.new"
    mv "${tmp}.new" "$tmp"
    echo "OK"
  done
  mv "$tmp" "$out"
  chmod 600 "$out"
  echo "Guardado en $out (chmod 600). No lo commitees."
}

cmd_import() {
  local file="$1"
  local region="${2:-$DST_REGION}"
  if [ ! -f "$file" ]; then
    echo "No existe: $file"
    exit 1
  fi
  echo "Importando a ${region} desde $file"
  for name in "${SECRETS[@]}"; do
    echo -n "  $name ... "
    value=$(jq -r --arg k "$name" '.[$k] // empty' "$file")
    if [ -z "$value" ] || [ "$value" = "null" ]; then
      echo "OMITIDO (sin valor en JSON)"
      continue
    fi
    if aws secretsmanager describe-secret --region "$region" --secret-id "$name" >/dev/null 2>&1; then
      aws secretsmanager put-secret-value \
        --region "$region" \
        --secret-id "$name" \
        --secret-string "$value" >/dev/null
      echo "actualizado"
    else
      echo "FALLO (secreto no existe en ${region} — ¿corrió terraform apply?)"
      exit 1
    fi
  done
  echo "Import completado en ${region}."
}

[ $# -lt 2 ] && usage

case "$1" in
  export) cmd_export "$2" ;;
  import) cmd_import "$2" "${3:-}" ;;
  *) usage ;;
esac
