variable "name_prefix" { type = string }
variable "aws_region" { type = string }
variable "discover_existing" { type = bool }
variable "vpc_name_tag" { type = string }
variable "tags" { type = map(string) }

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.20.1.0/24", "10.20.2.0/24"]
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.20.10.0/24", "10.20.11.0/24"]
}

variable "enable_public_nat" {
  type        = bool
  description = "IGW + NAT para subnets privadas (ECS)"
  default     = true
}

# --- Descubrimiento por subnet group Redis (modo migración) ---
# No usar solo tag:Name — hay VPCs duplicadas con el mismo nombre.

data "aws_elasticache_subnet_group" "anchor" {
  count = var.discover_existing ? 1 : 0
  name  = "${var.name_prefix}-redis"
}

data "aws_subnets" "anchor_from_redis" {
  count = var.discover_existing ? 1 : 0

  filter {
    name   = "subnet-id"
    values = data.aws_elasticache_subnet_group.anchor[0].subnet_ids
  }
}

data "aws_subnet" "anchor_probe" {
  count = var.discover_existing && length(data.aws_subnets.anchor_from_redis[0].ids) > 0 ? 1 : 0
  id    = sort(data.aws_subnets.anchor_from_redis[0].ids)[0]
}

# Subnets por CIDR en la VPC ancla (no requiere tag Tier).
data "aws_subnet" "private_by_cidr" {
  for_each = var.discover_existing ? toset(var.private_subnet_cidrs) : toset([])

  filter {
    name   = "vpc-id"
    values = [data.aws_subnet.anchor_probe[0].vpc_id]
  }

  filter {
    name   = "cidr-block"
    values = [each.key]
  }
}

data "aws_subnet" "public_by_cidr" {
  for_each = var.discover_existing && var.enable_public_nat ? toset(var.public_subnet_cidrs) : toset([])

  filter {
    name   = "vpc-id"
    values = [data.aws_subnet.anchor_probe[0].vpc_id]
  }

  filter {
    name   = "cidr-block"
    values = [each.key]
  }
}

# --- Creación (modo greenfield) ---

resource "aws_vpc" "created" {
  count = var.discover_existing ? 0 : 1

  cidr_block           = "10.20.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc"
    Tier = "core"
  })
}

locals {
  vpc_id = var.discover_existing ? data.aws_subnet.anchor_probe[0].vpc_id : aws_vpc.created[0].id

  private_subnet_ids = var.discover_existing ? [
    for cidr in var.private_subnet_cidrs : data.aws_subnet.private_by_cidr[cidr].id
  ] : [for s in aws_subnet.private_created : s.id]

  public_subnet_ids = var.discover_existing && var.enable_public_nat ? [
    for cidr in var.public_subnet_cidrs : data.aws_subnet.public_by_cidr[cidr].id
  ] : [for s in aws_subnet.public_created : s.id]
}

resource "aws_subnet" "private_created" {
  for_each = var.discover_existing ? {} : {
    for idx, cidr in var.private_subnet_cidrs :
    cidr => idx
  }

  vpc_id            = local.vpc_id
  cidr_block        = each.key
  availability_zone = data.aws_availability_zones.available.names[each.value]

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-${each.value == 0 ? "a" : "b"}"
    Tier = "private"
  })
}

resource "aws_subnet" "public_created" {
  for_each = var.discover_existing || !var.enable_public_nat ? {} : {
    for idx, cidr in var.public_subnet_cidrs :
    cidr => idx
  }

  vpc_id                  = local.vpc_id
  cidr_block              = each.key
  availability_zone       = data.aws_availability_zones.available.names[each.value]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-${each.value == 0 ? "a" : "b"}"
    Tier = "public"
  })
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_internet_gateway" "main" {
  count  = var.enable_public_nat && !var.discover_existing ? 1 : 0
  vpc_id = local.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-igw" })
}

output "vpc_id" {
  value = local.vpc_id
}

output "private_subnet_ids" {
  value = local.private_subnet_ids
}

output "public_subnet_ids" {
  value = local.public_subnet_ids
}
