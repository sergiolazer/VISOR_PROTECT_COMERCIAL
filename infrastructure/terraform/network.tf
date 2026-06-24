# Red publica + NAT para ECS Fargate (solo cuando enable_ecs=true)

resource "aws_internet_gateway" "main" {
  count = local.enable_compute ? 1 : 0

  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

resource "aws_subnet" "public_a" {
  count = local.enable_compute ? 1 : 0

  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.20.10.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-public-a"
  }

  lifecycle {
    ignore_changes  = [availability_zone, tags, tags_all, map_public_ip_on_launch, vpc_id]
  }
}

resource "aws_subnet" "public_b" {
  count = local.enable_compute ? 1 : 0

  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.20.11.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-public-b"
  }

  lifecycle {
    ignore_changes  = [availability_zone, tags, tags_all, map_public_ip_on_launch, vpc_id]
  }
}

resource "aws_eip" "nat" {
  count = local.enable_compute ? 1 : 0

  domain = "vpc"

  tags = {
    Name = "${local.name_prefix}-nat-eip"
  }
}

resource "aws_nat_gateway" "main" {
  count = local.enable_compute ? 1 : 0

  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public_a[0].id

  tags = {
    Name = "${local.name_prefix}-nat"
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "public" {
  count = local.enable_compute ? 1 : 0

  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main[0].id
  }

  tags = {
    Name = "${local.name_prefix}-public-rt"
  }
}

resource "aws_route_table" "private" {
  count = local.enable_compute ? 1 : 0

  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[0].id
  }

  tags = {
    Name = "${local.name_prefix}-private-rt"
  }
}

resource "aws_route_table_association" "public_a" {
  count = local.enable_compute ? 1 : 0

  subnet_id      = aws_subnet.public_a[0].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_route_table_association" "public_b" {
  count = local.enable_compute ? 1 : 0

  subnet_id      = aws_subnet.public_b[0].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_route_table_association" "private_a" {
  count = local.enable_compute ? 1 : 0

  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.private[0].id
}

resource "aws_route_table_association" "private_b" {
  count = local.enable_compute ? 1 : 0

  subnet_id      = aws_subnet.private_b.id
  route_table_id = aws_route_table.private[0].id
}
