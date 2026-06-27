# Helpers compartidos — source desde bootstrap-import / import-plan-creates / reconcile-state.

aws_value_ok() {
  local value="${1:-}"
  case "$value" in
    ""|None|null|NULL|none)
      return 1
      ;;
  esac
  return 0
}

aws_probe_ok() {
  local probe="$1"
  local out

  [ -n "$probe" ] || return 0

  out="$(bash -c "$probe" 2>/dev/null | head -1 | tr -d '[:space:]')"
  aws_value_ok "$out"
}

# Devuelve serviceArn solo si el servicio ECS existe, coincide por nombre y está ACTIVE/DRAINING.
ecs_service_arn() {
  local prefix="${1:?}"
  local service_name="${prefix}-backend"
  local cluster_name="${prefix}-backend"
  local json arn status failure_count service_name_actual

  json="$(aws ecs describe-services \
    --cluster "$cluster_name" \
    --services "$service_name" \
    --output json 2>/dev/null)" || return 1

  if ! command -v jq >/dev/null 2>&1; then
    echo "$json" | grep -q '"reason"[[:space:]]*:[[:space:]]*"MISSING"' && return 1
    arn="$(echo "$json" | sed -n 's/.*"serviceArn"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
    status="$(echo "$json" | sed -n 's/.*"status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  else
    failure_count="$(echo "$json" | jq -r '.failures | length' 2>/dev/null || echo "0")"
    arn="$(echo "$json" | jq -r '.services[0].serviceArn // empty' 2>/dev/null || echo "")"
    status="$(echo "$json" | jq -r '.services[0].status // empty' 2>/dev/null || echo "")"
    service_name_actual="$(echo "$json" | jq -r '.services[0].serviceName // empty' 2>/dev/null || echo "")"

    if [ "${failure_count:-0}" -gt 0 ] && ! aws_value_ok "$arn"; then
      return 1
    fi

    if aws_value_ok "$service_name_actual" && [ "$service_name_actual" != "$service_name" ]; then
      return 1
    fi
  fi

  if ! aws_value_ok "$arn"; then
    return 1
  fi

  case "$status" in
    ACTIVE|DRAINING)
      echo "$arn"
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# ID de import Terraform (aws_security_group_rule): sg_ID_ingress_protocol_from_to_source
sg_rule_import_id_ingress() {
  local sg_id="$1"
  local source_sg="$2"
  local from_port="$3"
  local to_port="$4"
  local protocol="${5:-tcp}"
  echo "${sg_id}_ingress_${protocol}_${from_port}_${to_port}_${source_sg}"
}

# Quita del state recursos ECS efímeros si no existen en AWS.
purge_ephemeral_ecs_state() {
  local prefix="${1:?}"
  local addr

  if ! ecs_service_arn "$prefix" >/dev/null 2>&1; then
    for addr in \
      'aws_ecs_service.backend[0]' \
      'aws_ecs_task_definition.backend[0]'; do
      if terraform state show -no-color "$addr" >/dev/null 2>&1; then
        echo "[purge-ephemeral-ecs] state rm $addr (no hay servicio ACTIVE en AWS)"
        terraform state rm "$addr" 2>/dev/null || true
      fi
    done
  fi
}
