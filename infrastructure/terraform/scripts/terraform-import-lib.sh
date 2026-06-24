# Helpers para terraform import (compatible con timeout — invoca el binario terraform, no funciones bash).

run_terraform_import() {
  local addr="$1"
  local id="$2"
  local timeout_sec="${TF_IMPORT_TIMEOUT_SEC:-180}"

  if command -v timeout >/dev/null 2>&1; then
    timeout "$timeout_sec" terraform import -input=false \
      -var="enable_ecs=${TF_VAR_enable_ecs:-false}" \
      -var="enable_app_runner=${TF_VAR_enable_app_runner:-false}" \
      -var="github_org=${TF_VAR_github_org:-bootstrap-import}" \
      -var="cors_origin=${TF_VAR_cors_origin:-http://localhost:5173}" \
      -var="aws_region=${AWS_REGION:-sa-east-1}" \
      "$addr" "$id"
  else
    terraform import -input=false \
      -var="enable_ecs=${TF_VAR_enable_ecs:-false}" \
      -var="enable_app_runner=${TF_VAR_enable_app_runner:-false}" \
      -var="github_org=${TF_VAR_github_org:-bootstrap-import}" \
      -var="cors_origin=${TF_VAR_cors_origin:-http://localhost:5173}" \
      -var="aws_region=${AWS_REGION:-sa-east-1}" \
      "$addr" "$id"
  fi
}
