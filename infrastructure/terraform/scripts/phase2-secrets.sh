#!/usr/bin/env bash
# Exporta / importa secretos entre regiones para la fase 2 (sa-east-1 → us-east-1).
#
# Uso:
#   # 1. Antes del apply — exportar y validar desde sa-east-1
#   ./scripts/phase2-secrets.sh export ./secrets-phase2.json
#
#   # 2. Validar archivo local (también antes de activar ENABLE_APP_RUNNER)
#   ./scripts/phase2-secrets.sh validate ./secrets-phase2.json
#
#   # 3. Tras el apply en us-east-1 — importar (re-valida antes de escribir)
#   ./scripts/phase2-secrets.sh import ./secrets-phase2.json us-east-1
#
# Requiere: AWS CLI, jq. NO subas secrets-phase2.json al repositorio.

set -euo pipefail

PREFIX="${SECRET_PREFIX:-visor-protect-production}"
SRC_REGION="${SRC_REGION:-sa-east-1}"
DST_REGION="${DST_REGION:-us-east-1}"
JWT_MIN_LENGTH="${JWT_MIN_LENGTH:-32}"

SECRETS=(
  "${PREFIX}/mongo-uri"
  "${PREFIX}/jwt-secret"
  "${PREFIX}/cloudinary"
)

MONGO_URI_KEY="${PREFIX}/mongo-uri"
JWT_SECRET_KEY="${PREFIX}/jwt-secret"
CLOUDINARY_KEY="${PREFIX}/cloudinary"

usage() {
  echo "Uso:"
  echo "  $0 export <archivo.json>              # lee ${SRC_REGION}, valida formato"
  echo "  $0 validate <archivo.json>            # valida sin tocar AWS"
  echo "  $0 import <archivo.json> [region]     # valida y escribe (default ${DST_REGION})"
  exit 1
}

fail_validation() {
  local secret_name="$1"
  local reason="$2"
  echo "::error::[$secret_name] $reason" >&2
  return 1
}

is_placeholder() {
  local value="$1"
  case "$value" in
    REPLACE*|REPLACE_WITH_*|change-me-in-production|cambiar-por-secreto-seguro-en-produccion)
      return 0
      ;;
  esac
  return 1
}

validate_mongo_uri() {
  local value="$1"
  if [ -z "$value" ] || [ "$value" = "null" ]; then
    fail_validation "$MONGO_URI_KEY" "valor vacío"
    return 1
  fi
  if is_placeholder "$value"; then
    fail_validation "$MONGO_URI_KEY" "sigue siendo placeholder de Terraform — actualiza en Secrets Manager"
    return 1
  fi
  if ! [[ "$value" =~ ^mongodb(\+srv)?://[^[:space:]]+ ]]; then
    fail_validation "$MONGO_URI_KEY" "formato inválido (esperado mongodb:// o mongodb+srv://...)"
    return 1
  fi
  if [ "${#value}" -lt 20 ]; then
    fail_validation "$MONGO_URI_KEY" "URI demasiado corta"
    return 1
  fi
  return 0
}

validate_jwt_secret() {
  local value="$1"
  if [ -z "$value" ] || [ "$value" = "null" ]; then
    fail_validation "$JWT_SECRET_KEY" "valor vacío"
    return 1
  fi
  if is_placeholder "$value"; then
    fail_validation "$JWT_SECRET_KEY" "sigue siendo placeholder de Terraform"
    return 1
  fi
  if [ "${#value}" -lt "$JWT_MIN_LENGTH" ]; then
    fail_validation "$JWT_SECRET_KEY" "longitud < ${JWT_MIN_LENGTH} caracteres (usa openssl rand -base64 48)"
    return 1
  fi
  return 0
}

validate_cloudinary() {
  local value="$1"
  if [ -z "$value" ] || [ "$value" = "null" ]; then
    fail_validation "$CLOUDINARY_KEY" "valor vacío"
    return 1
  fi
  if ! echo "$value" | jq -e . >/dev/null 2>&1; then
    fail_validation "$CLOUDINARY_KEY" "no es JSON válido"
    return 1
  fi
  local cloud_name api_key api_secret
  cloud_name=$(echo "$value" | jq -r '.cloud_name // empty')
  api_key=$(echo "$value" | jq -r '.api_key // empty')
  api_secret=$(echo "$value" | jq -r '.api_secret // empty')
  if [ -z "$cloud_name" ] || [ -z "$api_key" ] || [ -z "$api_secret" ]; then
    fail_validation "$CLOUDINARY_KEY" "faltan claves cloud_name, api_key o api_secret"
    return 1
  fi
  for field in "$cloud_name" "$api_key" "$api_secret"; do
    if is_placeholder "$field"; then
      fail_validation "$CLOUDINARY_KEY" "campo con placeholder REPLACE — actualiza credenciales reales"
      return 1
    fi
  done
  if [ "${#api_secret}" -lt 8 ]; then
    fail_validation "$CLOUDINARY_KEY" "api_secret demasiado corto"
    return 1
  fi
  return 0
}

validate_secret_value() {
  local name="$1"
  local value="$2"
  case "$name" in
    "$MONGO_URI_KEY") validate_mongo_uri "$value" ;;
    "$JWT_SECRET_KEY") validate_jwt_secret "$value" ;;
    "$CLOUDINARY_KEY") validate_cloudinary "$value" ;;
    *)
      echo "::warning::Secreto desconocido $name — sin validación de formato"
      return 0
      ;;
  esac
}

validate_all_in_file() {
  local file="$1"
  local errors=0
  echo "Validando formato de secretos en $file ..."
  for name in "${SECRETS[@]}"; do
    value=$(jq -r --arg k "$name" '.[$k] // empty' "$file")
    if [ -z "$value" ] || [ "$value" = "null" ]; then
      fail_validation "$name" "ausente en el archivo JSON" || errors=$((errors + 1))
      continue
    fi
    if validate_secret_value "$name" "$value"; then
      echo "  OK  $name"
    else
      errors=$((errors + 1))
    fi
  done
  if [ "$errors" -gt 0 ]; then
    echo ""
    echo "Validación fallida: $errors error(es). Corrige los secretos antes de importar o activar fase 2."
    return 1
  fi
  echo "Validación OK — listo para import o para activar ENABLE_APP_RUNNER=true."
  return 0
}

cmd_validate() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "No existe: $file"
    exit 1
  fi
  validate_all_in_file "$file"
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
    if ! validate_secret_value "$name" "$value"; then
      echo "FALLO validación"
      rm -f "$tmp"
      exit 1
    fi
    jq --arg k "$name" --arg v "$value" '. + {($k): $v}' "$tmp" > "${tmp}.new"
    mv "${tmp}.new" "$tmp"
    echo "OK"
  done
  mv "$tmp" "$out"
  chmod 600 "$out"
  echo "Guardado en $out (chmod 600). No lo commitees."
  validate_all_in_file "$out"
}

cmd_import() {
  local file="$1"
  local region="${2:-$DST_REGION}"
  if [ ! -f "$file" ]; then
    echo "No existe: $file"
    exit 1
  fi
  validate_all_in_file "$file"
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
  validate) cmd_validate "$2" ;;
  import) cmd_import "$2" "${3:-}" ;;
  *) usage ;;
esac
