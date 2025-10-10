// File: infra/terraform/s3_frontend.tf
// --- REPLACE START ---
resource "aws_s3_bucket" "frontend" {
  bucket = local.s3_bucket
  force_destroy = true
}

resource "aws_s3_bucket_ownership_controls" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule { object_ownership = "BucketOwnerPreferred" }
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "logs" {
  bucket = local.log_bucket
  force_destroy = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule { apply_server_side_encryption_by_default { sse_algorithm = "AES256" } }
}

# Policy attached later by CloudFront OAC
// --- REPLACE END ---
