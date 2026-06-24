# Helpers compartidos — source desde bootstrap-import / import-plan-creates.

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

# Devuelve serviceArn solo si el servicio ECS existe y está ACTIVE o DRAINING.
ecs_service_arn() {
  local prefix="${1:?}"
  local json arn status failure_count

  json="$(aws ecs describe-services \
    --cluster "${prefix}-backend" \
    --services "${prefix}-backend" \
    --output json 2>/dev/null)" || return 1

  failure_count="$(echo "$json" | jq -r '.failures | length' 2>/dev/null || echo "0")"
  arn="$(echo "$json" | jq -r '.services[0].serviceArn // empty' 2>/dev/null || echo "")"
  status="$(echo "$json" | jq -r '.services[0].status // empty' 2>/dev/null || echo "")"

  if [ "${failure_count:-0}" -gt 0 ] && ! aws_value_ok "$arn"; then
    return 1
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
