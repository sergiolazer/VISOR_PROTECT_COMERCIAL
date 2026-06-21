variable "aws_region" {
  description = "Región AWS (sa-east-1 recomendada para comercios en Brasil)"
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

variable "app_runner_cpu" {
  description = "vCPU App Runner (0.25 = costo mínimo)"
  type        = string
  default     = "0.25 vCPU"
}

variable "app_runner_memory" {
  description = "Memoria App Runner"
  type        = string
  default     = "0.5 GB"
}

variable "app_runner_min_size" {
  description = "Instancias mínimas (1 = siempre caliente, latencia baja)"
  type        = number
  default     = 1
}

variable "app_runner_max_size" {
  description = "Instancias máximas (auto-scaling en picos)"
  type        = number
  default     = 10
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

variable "enable_app_runner" {
  description = "false en el primer apply (ECR vacío); true tras push de imagen :latest"
  type        = bool
  default     = false
}
