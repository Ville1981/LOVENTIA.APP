# infra/terraform/s3_alb_logs.tf
# --- REPLACE START: S3 for ALB access logs + lifecycle ---
variable "alb_logs_bucket_name" {
  type = string
  # esim: "loventia-alb-logs-staging-1234"
}

resource "aws_s3_bucket" "alb_logs" {
  bucket = var.alb_logs_bucket_name
}

resource "aws_s3_bucket_ownership_controls" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule { object_ownership = "BucketOwnerPreferred" }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket                  = aws_s3_bucket.alb_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ALB:lle oikeus pudottaa lokit tähän bucketiin
data "aws_elb_service_account" "this" {}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Sid       = "AWSLoadBalancerLogging",
      Effect    = "Allow",
      Principal = { AWS = data.aws_elb_service_account.this.arn },
      Action    = "s3:PutObject",
      Resource  = "${aws_s3_bucket.alb_logs.arn}/AWSLogs/*"
    }]
  })
}

# Lifecycle: siirrä IA:han 30 pv jälkeen, poista 180 pv jälkeen
resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    id     = "retention"
    status = "Enabled"
    filter { prefix = "" }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    expiration { days = 180 }
  }
}
# --- REPLACE END ---
