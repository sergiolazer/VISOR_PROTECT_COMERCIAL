output "ecr_repository_url" {
  description = "URL del repositorio ECR para push de imágenes"
  value       = aws_ecr_repository.backend.repository_url
}

output "app_runner_service_url" {
  description = "URL pública del backend (API + WebSockets)"
  value       = var.enable_app_runner ? "https://${aws_apprunner_service.backend[0].service_url}" : null
}

output "app_runner_service_arn" {
  description = "ARN del servicio App Runner (secret GitHub APP_RUNNER_SERVICE_ARN)"
  value       = var.enable_app_runner ? aws_apprunner_service.backend[0].arn : null
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
  description = "Bucket S3 para media con lifecycle 7 días"
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
