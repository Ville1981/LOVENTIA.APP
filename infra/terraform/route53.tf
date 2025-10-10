// File: infra/terraform/route53.tf
// --- REPLACE START ---
# Optional: create an A/AAAA alias to CloudFront when frontend_domain & hosted_zone_id are provided
resource "aws_route53_record" "frontend_alias" {
  count   = length(var.frontend_domain) > 0 && length(var.hosted_zone_id) > 0 ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.frontend_domain
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "frontend_alias_ipv6" {
  count   = length(var.frontend_domain) > 0 && length(var.hosted_zone_id) > 0 ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.frontend_domain
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}
// --- REPLACE END ---
