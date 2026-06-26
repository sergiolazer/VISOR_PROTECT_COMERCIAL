# VPC endpoints — ECS Fargate en subnets privadas sin IP pública necesita rutas a
# Secrets Manager, ECR y CloudWatch Logs (NAT o endpoints). Endpoints evitan timeouts.

resource "aws_security_group" "vpc_endpoints" {
  count = local.enable_compute ? 1 : 0

  name        = "${local.name_prefix}-vpc-endpoints"
  description = "HTTPS para VPC interface endpoints (ECS tasks)"
  vpc_id      = local.anchor_vpc_id

  ingress {
    description     = "HTTPS desde ECS tasks"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [local.ecs_tasks_sg_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-vpc-endpoints"
  }

  lifecycle {
    ignore_changes = [name, description, ingress, egress, vpc_id, tags, tags_all]
  }
}

locals {
  vpc_interface_endpoint_services = local.enable_compute ? toset([
    "secretsmanager",
    "ecr.api",
    "ecr.dkr",
    "logs",
  ]) : toset([])
}

resource "aws_vpc_endpoint" "interface" {
  for_each = local.vpc_interface_endpoint_services

  vpc_id              = local.anchor_vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.${each.key}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name = "${local.name_prefix}-${replace(each.key, ".", "-")}"
  }
}

resource "aws_vpc_endpoint" "s3" {
  count = local.enable_compute ? 1 : 0

  vpc_id            = local.anchor_vpc_id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private[0].id]

  tags = {
    Name = "${local.name_prefix}-s3"
  }
}
