provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.default_tags
  }
}

# S3 media: bucket global; región fija sa-east-1 (convención actual).
provider "aws" {
  alias  = "s3"
  region = "sa-east-1"

  default_tags {
    tags = local.default_tags
  }
}

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}
