locals {
  name_prefix = "${var.project_name}-${var.environment}"

  default_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Repository  = var.github_repo
  }

  # Modo migración: descubrir VPC existente por tags en lugar de crear.
  use_existing_network = var.discover_existing_network

  enable_compute = var.enable_ecs
}
