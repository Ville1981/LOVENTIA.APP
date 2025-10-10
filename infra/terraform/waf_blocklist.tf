# CloudFront (us-east-1)
resource "aws_wafv2_ip_set" "cf_block" {
  provider           = aws.use1
  name               = "${local.name}-cf-block"
  description        = "Blocked IPs for CloudFront"
  scope              = "CLOUDFRONT"
  ip_address_version = "IPV4"
  addresses          = var.block_cidrs
}

# ALB (regional)
resource "aws_wafv2_ip_set" "alb_block" {
  name               = "${local.name}-alb-block"
  description        = "Blocked IPs for ALB"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = var.block_cidrs
}
