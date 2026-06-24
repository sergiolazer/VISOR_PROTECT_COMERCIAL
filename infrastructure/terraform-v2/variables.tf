variable "aws_region" {
  type    = string
  default = "sa-east-1"
}

variable "project_name" {
  type    = string
  default = "visor-protect"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "github_org" {
  type        = string
  description = "Org/usuario GitHub para OIDC"
}

variable "github_repo" {
  type    = string
  default = "VISOR_PROTECT_COMERCIAL"
}

variable "cors_origin" {
  type        = string
  description = "URL del frontend (Vercel)"
}

variable "enable_ecs" {
  type        = bool
  default     = true
  description = "Despliega ECS Fargate + ALB"
}

variable "discover_existing_network" {
  type        = bool
  default     = true
  description = "true = data sources por tags (migración); false = crear VPC nueva"
}

variable "vpc_name_tag" {
  type        = string
  default     = "visor-protect-production-vpc"
  description = "Tag Name de la VPC ancla (Redis)"
}

variable "ecs_cpu" {
  type    = string
  default = "256"
}

variable "ecs_memory" {
  type    = string
  default = "512"
}

variable "ecs_desired_count" {
  type    = number
  default = 1
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "ecr_image_tag" {
  type    = string
  default = "latest"
}

variable "s3_chat_prefix" {
  type    = string
  default = "visor-protect/chat/"
}

variable "alert_latency_threshold_ms" {
  type    = number
  default = 200
}
