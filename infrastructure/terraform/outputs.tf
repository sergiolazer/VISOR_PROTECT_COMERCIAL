output "ecr_repository_url" {
  description = "URL del repositorio ECR para push de imágenes"
  value       = aws_ecr_repository.backend.repository_url
}

output "backend_service_url" {
  description = "URL publica del backend (ALB — API + WebSockets)"
  value       = local.enable_compute ? "http://${aws_lb.backend[0].dns_name}" : null
}

output "ecs_cluster_name" {
  description = "Nombre del cluster ECS"
  value       = local.enable_compute ? aws_ecs_cluster.backend[0].name : null
}

output "ecs_service_name" {
  description = "Nombre del servicio ECS"
  value       = local.enable_compute ? aws_ecs_service.backend[0].name : null
}

# Deprecated — compatibilidad con workflows antiguos
output "app_runner_service_url" {
  description = "DEPRECATED: usar backend_service_url"
  value       = local.enable_compute ? "http://${aws_lb.backend[0].dns_name}" : null
}

output "app_runner_service_arn" {
  description = "DEPRECATED: usar ecs_cluster_name + ecs_service_name"
  value       = null
}

output "github_deploy_role_arn" {
  description = "ARN del rol IAM para GitHub Actions (secret AWS_DEPLOY_ROLE_ARN)"
  value       = aws_iam_role.github_deploy.arn
}

output "redis_endpoint" {
  description = "Endpoint Redis ElastiCache"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "s3_media_bucket" {
  description = "Bucket S3 para media con lifecycle 7 dias"
  value       = aws_s3_bucket.media.bucket
}

output "secrets_manager_arns" {
  description = "ARNs de secretos — actualizar valores en consola AWS antes del go-live"
  value = {
    mongo_uri  = aws_secretsmanager_secret.mongo_uri.arn
    jwt_secret = aws_secretsmanager_secret.jwt_secret.arn
    cloudinary = aws_secretsmanager_secret.cloudinary.arn
  }
}

output "aws_region" {
  value = var.aws_region
}
