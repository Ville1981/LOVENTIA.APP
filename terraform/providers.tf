# File: infra/terraform/providers.tf

# --- REPLACE START: de-duplicate default provider, pin versions, and add us-east-1 alias for CloudFront/ACM ---

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Default AWS provider — all regional resources (ECS, ALB, ECR, SSM, etc.)
provider "aws" {
  region = var.region

  # Optional: set default tags for all resources (kept lightweight, safe to keep empty)
  default_tags {
    tags = {
      Project = var.project_name
      Env     = var.environment
    }
  }
}

# CloudFront/ACM certificates MUST reside in us-east-1 (global CloudFront scope)
# Use this aliased provider for ACM certs, CloudFront, and any related resources.
provider "aws" {
  alias  = "use1"
  region = "us-east-1"
}

# --- REPLACE END ---
