// File: infra/terraform/cloudfront.tf
// --- REPLACE START ---
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  s3_origin_id = "${local.name_prefix}-s3-origin"
}

resource "aws_cloudfront_distribution" "frontend" {
  comment             = local.cf_comment
  enabled             = true
  default_root_object = "index.html"
  price_class         = var.cf_price_class

  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = local.s3_origin_id

    s3_origin_config {
      origin_access_identity = null
    }

    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.s3_origin_id

    viewer_protocol_policy = "redirect-to-https"
    compress = true

    forwarded_values {
      query_string = true
      cookies { forward = "none" }
    }
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions { geo_restriction { restriction_type = "none" } }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  depends_on = [aws_cloudfront_origin_access_control.oac]
}

resource "aws_s3_bucket_policy" "frontend_allow_cf" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid: "AllowCloudFrontServicePrincipalReadOnly"
        Effect: "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action = ["s3:GetObject"]
        Resource = ["${aws_s3_bucket.frontend.arn}/*"]
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}
// --- REPLACE END ---
