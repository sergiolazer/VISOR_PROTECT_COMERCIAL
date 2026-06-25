terraform {
  required_version = ">= 1.6.0"
}

module "network" {
  source = "../../modules/network"

  name_prefix       = local.name_prefix
  aws_region        = var.aws_region
  discover_existing = var.discover_existing_network
  vpc_name_tag      = var.vpc_name_tag
  enable_public_nat = var.enable_ecs
  tags              = local.default_tags
}

module "storage" {
  source = "../../modules/storage"
  providers = {
    aws.s3 = aws.s3
  }

  project_name   = var.project_name
  name_prefix    = local.name_prefix
  account_id     = data.aws_caller_identity.current.account_id
  s3_chat_prefix = var.s3_chat_prefix
  tags           = local.default_tags
}

module "security" {
  source = "../../modules/security"

  name_prefix         = local.name_prefix
  github_org          = var.github_org
  github_repo         = var.github_repo
  aws_region          = var.aws_region
  account_id          = data.aws_caller_identity.current.account_id
  secrets_arns        = []
  s3_media_bucket_arn = module.storage.s3_media_bucket_arn
  tags                = local.default_tags
}

module "database" {
  source = "../../modules/database"

  name_prefix                 = local.name_prefix
  vpc_id                      = module.network.vpc_id
  private_subnet_ids          = module.network.private_subnet_ids
  redis_node_type             = var.redis_node_type
  ecs_tasks_security_group_id = null
  enable_ecs_ingress          = var.enable_ecs
  tags                        = local.default_tags

  depends_on = [module.network]
}

module "compute" {
  count  = var.enable_ecs ? 1 : 0
  source = "../../modules/compute"

  name_prefix          = local.name_prefix
  aws_region           = var.aws_region
  vpc_id               = module.network.vpc_id
  private_subnet_ids   = module.network.private_subnet_ids
  public_subnet_ids    = module.network.public_subnet_ids
  ecr_repository_url   = module.storage.ecr_repository_url
  ecr_image_tag        = var.ecr_image_tag
  cors_origin          = var.cors_origin
  redis_url            = "redis://${module.database.redis_endpoint}:6379"
  log_group_name       = "/ecs/${local.name_prefix}-backend"
  secrets_arns         = module.security.secrets_arns
  execution_role_arn   = module.security.ecs_execution_role_arn
  task_role_arn        = module.security.ecs_task_role_arn
  ecs_cpu              = var.ecs_cpu
  ecs_memory           = var.ecs_memory
  ecs_desired_count         = var.ecs_desired_count
  discover_existing_network = var.discover_existing_network
  tags                      = local.default_tags

  depends_on = [module.database, module.security, module.storage]
}

module "observability" {
  count  = var.enable_ecs ? 1 : 0
  source = "../../modules/observability"

  name_prefix            = local.name_prefix
  alb_arn_suffix       = module.compute[0].alb_arn_suffix
  redis_cluster_id       = "${local.name_prefix}-redis"
  latency_threshold_ms   = var.alert_latency_threshold_ms
  tags                   = local.default_tags
}

output "ecr_repository_url" {
  value = module.storage.ecr_repository_url
}

output "backend_service_url" {
  value = var.enable_ecs ? "http://${module.compute[0].alb_dns_name}" : null
}

output "redis_endpoint" {
  value = module.database.redis_endpoint
}

output "github_deploy_role_arn" {
  value = module.security.github_deploy_role_arn
}

output "ecs_cluster_name" {
  value = var.enable_ecs ? module.compute[0].ecs_cluster_name : null
}

output "ecs_service_name" {
  value = var.enable_ecs ? module.compute[0].ecs_service_name : null
}

output "s3_media_bucket" {
  value = module.storage.s3_media_bucket
}

output "secrets_manager_arns" {
  value = module.security.secrets_arns
}

output "aws_region" {
  value = var.aws_region
}
