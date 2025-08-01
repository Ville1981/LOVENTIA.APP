// Geo-DNS Module

variable "domain_name" {
  description = "The hosted zone domain name (e.g., example.com)"
  type        = string
}

variable "hosted_zone_id" {
  description = "Route53 Hosted Zone ID"
  type        = string
}

variable "records" {
  description = "Map of geo-locations to target IPs or endpoints"
  type = map(object({
    continent    = string
    country_code = string
    value        = string
  }))
}

resource "aws_route53_record" "geo_records" {
  for_each = var.records
  zone_id  = var.hosted_zone_id
  name     = each.key
  type     = "A"
  ttl      = 60
  set_identifier = each.key
n  geo_location {
    continent = each.value.continent
    country_code = each.value.country_code
  }
  records = [each.value.value]
}

resource "aws_route53_record" "default_record" {
  zone_id = var.hosted_zone_id
  name    = "@"
  type    = "A"
  ttl     = 60
  records = [values(var.records)[0].value]
  set_identifier = "default"
}