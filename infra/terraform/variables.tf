variable "aws_region" {
  description = "AWS region where resources will be deployed"
  type        = string
  default     = "us-east-1"
}

variable "s3_bucket_name" {
  description = "Name for the example S3 bucket"
  type        = string
}