terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Example resource: S3 bucket
resource "aws_s3_bucket" "example" {
  bucket = var.s3_bucket_name
  acl    = "private"
}