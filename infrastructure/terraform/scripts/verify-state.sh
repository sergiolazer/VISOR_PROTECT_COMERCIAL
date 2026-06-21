#!/usr/bin/env bash
# Verifica el state local de Terraform o resume un artifact descargado.
# Uso:
#   ./scripts/verify-state.sh
#   ./scripts/verify-state.sh /ruta/terraform.tfstate

set -euo pipefail

STATE="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/terraform.tfstate}"

if [ ! -f "$STATE" ]; then
  echo "No existe: $STATE"
  echo "Descarga el artifact terraform-state desde GitHub Actions o ejecuta terraform apply local."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Instala jq para resumen detallado."
  exit 1
fi

SERIAL=$(jq -r '.serial' "$STATE")
LINEAGE=$(jq -r '.lineage' "$STATE")
COUNT=$(jq '[.resources[]] | length' "$STATE")
VERSION=$(jq -r '.terraform_version' "$STATE")

echo "=== Terraform state ==="
echo "Archivo:    $STATE"
echo "Serial:     $SERIAL"
echo "Lineage:    $LINEAGE"
echo "TF version: $VERSION"
echo "Resources:  $COUNT instancias"
echo ""
echo "Tipos únicos:"
jq -r '[.resources[].type] | unique | .[]' "$STATE" | sort

echo ""
echo "Outputs:"
jq -r '.outputs // {} | keys[]' "$STATE" 2>/dev/null | while read -r k; do
  v=$(jq -r ".outputs[\"$k\"].value // empty" "$STATE")
  echo "  $k = $v"
done
