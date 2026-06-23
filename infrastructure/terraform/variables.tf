variable "aws_region" {
  description = "Region AWS (ECR, VPC, Redis, ECS). sa-east-1 recomendado para latencia BR."
  type        = string
  default     = "sa-east-1"
}

variable "project_name" {
  description = "Prefijo de recursos"
  type        = string
  default     = "visor-protect"
}

variable "environment" {
  description = "Entorno (production, staging)"
  type        = string
  default     = "production"
}

variable "github_org" {
  description = "Organización o usuario de GitHub para OIDC"
  type        = string
}

variable "github_repo" {
  description = "Repositorio GitHub (nombre sin org)"
  type        = string
  default     = "VISOR_PROTECT_COMERCIAL"
}

variable "cors_origin" {
  description = "Origen permitido CORS (URL del frontend en producción)"
  type        = string
}

variable "ecs_cpu" {
  description = "CPU Fargate en unidades (256 = 0.25 vCPU)"
  type        = string
  default     = "256"
}

variable "ecs_memory" {
  description = "Memoria Fargate en MiB (512 = 0.5 GB)"
  type        = string
  default     = "512"
}

variable "ecs_desired_count" {
  description = "Tareas Fargate deseadas (1 = siempre caliente)"
  type        = number
  default     = 1
}

variable "redis_node_type" {
  description = "Tipo nodo ElastiCache (cache.t4g.micro = costo optimizado)"
  type        = string
  default     = "cache.t4g.micro"
}

variable "s3_chat_prefix" {
  description = "Prefijo S3 para imágenes de chat (lifecycle 7 días)"
  type        = string
  default     = "visor-protect/chat/"
}

variable "alert_latency_threshold_ms" {
  description = "Umbral CloudWatch para latencia p95 de alertas (ms)"
  type        = number
  default     = 200
}

variable "ecr_image_tag" {
  description = "Tag inicial de imagen ECR (CI/CD actualiza con git SHA)"
  type        = string
  default     = "latest"
}

variable "enable_ecs" {
  description = "false en bootstrap (ECR vacío); true tras primera imagen — despliega ECS Fargate + ALB"
  type        = bool
  default     = false
}

# Deprecated — mapeado a enable_ecs en CI (ENABLE_APP_RUNNER en GitHub)
variable "enable_app_runner" {
  description = "DEPRECATED: usar enable_ecs. Mantenido por compatibilidad CI."
  type        = bool
  default     = false
}
