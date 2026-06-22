terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Descomentar tras crear bucket S3 para state remoto:
  # backend "s3" {
  #   bucket         = "visor-protect-terraform-state"
  #   key            = "production/terraform.tfstate"
  #   region         = "sa-east-1"
  #   encrypt        = true
  #   dynamodb_table = "visor-protect-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Bucket media: nombre global S3; creado en fase 1 (sa-east-1). No migra con App Runner.
provider "aws" {
  alias  = "s3"
  region = "sa-east-1"

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}
