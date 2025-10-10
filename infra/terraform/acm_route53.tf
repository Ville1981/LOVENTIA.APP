# Hakee olemassa olevan Hosted Zonen (luo sen etukäteen, jos ei vielä ole)
data "aws_route53_zone" "this" {
  name         = var.domain
  private_zone = false
}

# --- ACM for ALB (region: eu-north-1) ---
resource "aws_acm_certificate" "alb" {
  domain_name       = "${var.subdomain_api}.${var.domain}"
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
}

resource "aws_route53_record" "alb_validation" {
  for_each = {
    for dvo in aws_acm_certificate.alb.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
  zone_id = data.aws_route53_zone.this.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.value]
}

resource "aws_acm_certificate_validation" "alb" {
  certificate_arn         = aws_acm_certificate.alb.arn
  validation_record_fqdns = [for r in aws_route53_record.alb_validation : r.fqdn]
}

# --- ACM for CloudFront (region: us-east-1) ---
resource "aws_acm_certificate" "cf" {
  provider          = aws.use1
  domain_name       = "${var.subdomain_app}.${var.domain}"
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
}

resource "aws_route53_record" "cf_validation" {
  for_each = {
    for dvo in aws_acm_certificate.cf.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
  zone_id = data.aws_route53_zone.this.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.value]
}

resource "aws_acm_certificate_validation" "cf" {
  provider                = aws.use1
  certificate_arn         = aws_acm_certificate.cf.arn
  validation_record_fqdns = [for r in aws_route53_record.cf_validation : r.fqdn]
}

# --- DNS records for app/api ---
resource "aws_route53_record" "app_a" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = "${var.subdomain_app}.${var.domain}"
  type    = "CNAME"
  ttl     = 300
  # täytä CloudFront-distributionin domain tähän applyn jälkeen (tai tee viittaus jos reso on tf:ssä)
  records = [aws_cloudfront_distribution.frontend.domain_name]
}

resource "aws_route53_record" "api_a" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = "${var.subdomain_api}.${var.domain}"
  type    = "A"
  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}
