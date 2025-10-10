# --- CloudFront IP set (us-east-1) ---
resource "aws_wafv2_ip_set" "cf_allow" {
  provider           = aws.use1
  name               = "${local.name}-cf-allow"
  description        = "Allowlisted IPs for CloudFront"
  scope              = "CLOUDFRONT"
  ip_address_version = "IPV4"
  addresses          = var.allow_cidrs
}

# --- ALB IP set (regional) ---
resource "aws_wafv2_ip_set" "alb_allow" {
  name               = "${local.name}-alb-allow"
  description        = "Allowlisted IPs for ALB"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = var.allow_cidrs
}
