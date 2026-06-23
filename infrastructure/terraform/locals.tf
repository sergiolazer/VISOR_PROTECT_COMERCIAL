locals {
  name_prefix    = "${var.project_name}-${var.environment}"
  enable_compute = var.enable_ecs || var.enable_app_runner
}
