# Recursos compartidos (sin count) — source desde bootstrap-import / import-plan-creates.

import_shared_resources() {
  local mode="${1:-bootstrap}" # bootstrap | planned
  local plan_file="${2:-pre-apply.plan}"

  local import_fn="import_when_needed"
  if [ "$mode" = "planned" ]; then
    import_fn="import_if_planned_create"
  fi

  # shellcheck disable=SC2086
  $import_fn \
    'aws_ecr_repository.backend' \
    "$ECR_REPO" \
    "aws ecr describe-repositories --repository-names ${ECR_REPO} --query 'repositories[0].repositoryName' --output text"

  # shellcheck disable=SC2086
  $import_fn \
    'aws_secretsmanager_secret.mongo_uri' \
    "${PREFIX}/mongo-uri" \
    "aws secretsmanager describe-secret --secret-id ${PREFIX}/mongo-uri --query 'Name' --output text"

  # shellcheck disable=SC2086
  $import_fn \
    'aws_secretsmanager_secret.jwt_secret' \
    "${PREFIX}/jwt-secret" \
    "aws secretsmanager describe-secret --secret-id ${PREFIX}/jwt-secret --query 'Name' --output text"

  # shellcheck disable=SC2086
  $import_fn \
    'aws_secretsmanager_secret.cloudinary' \
    "${PREFIX}/cloudinary" \
    "aws secretsmanager describe-secret --secret-id ${PREFIX}/cloudinary --query 'Name' --output text"

  # shellcheck disable=SC2086
  $import_fn \
    'aws_iam_openid_connect_provider.github' \
    "$OIDC_ARN" \
    "aws iam get-open-id-connect-provider --open-id-connect-provider-arn ${OIDC_ARN} --query 'Url' --output text"

  # shellcheck disable=SC2086
  $import_fn \
    'aws_iam_role.github_deploy' \
    "${PREFIX}-github-deploy" \
    "aws iam get-role --role-name ${PREFIX}-github-deploy --query 'Role.RoleName' --output text"

  # shellcheck disable=SC2086
  $import_fn \
    'aws_iam_role_policy.github_deploy' \
    "${PREFIX}-github-deploy:${PREFIX}-github-deploy" \
    "aws iam get-role-policy --role-name ${PREFIX}-github-deploy --policy-name ${PREFIX}-github-deploy --query 'PolicyName' --output text"

  # shellcheck disable=SC2086
  $import_fn \
    'aws_s3_bucket.media' \
    "${PREFIX}-media-${ACCOUNT_ID}" \
    "aws s3api list-buckets --query \"Buckets[?Name=='${PREFIX}-media-${ACCOUNT_ID}'].Name | [0]\" --output text"

  # shellcheck disable=SC2086
  $import_fn \
    'aws_elasticache_subnet_group.redis' \
    "${PREFIX}-redis" \
    "aws elasticache describe-cache-subnet-groups --cache-subnet-group-name ${PREFIX}-redis --query 'CacheSubnetGroups[0].CacheSubnetGroupName' --output text"

  # shellcheck disable=SC2086
  $import_fn \
    'aws_elasticache_cluster.redis' \
    "${PREFIX}-redis" \
    "aws elasticache describe-cache-clusters --cache-cluster-id ${PREFIX}-redis --query 'CacheClusters[0].CacheClusterId' --output text"

  if [ "${TF_VAR_enable_ecs:-false}" = "true" ] || [ "${TF_VAR_enable_app_runner:-false}" = "true" ]; then
    local log_group="/ecs/${PREFIX}-backend"
    # shellcheck disable=SC2086
    $import_fn \
      'aws_cloudwatch_log_group.ecs[0]' \
      "$log_group" \
      "aws logs describe-log-groups --log-group-name-prefix ${log_group} --query \"logGroups[?logGroupName=='${log_group}'].logGroupName | [0]\" --output text"
  fi
}
