// infra/terraform/geo-dns.tf

provider "aws" {
alias  = "route53"
region = var.dns_region
}

variable "zone_id" {
description = "Route53 Hosted Zone ID"
type        = string
}

variable "service_domains" {
description = "Map of region to domain name"
type        = map(string)
}

resource "aws_route53_record" "geo_routing" {
provider = aws.route53
zone_id  = var.zone_id
name      = var.global_hostname
n
type     = "A"
ttl      = 60
set_identifier = each.key
weight         = 1
records        = [var.service_domains[each.key]]
geo_location {
continent = each.key == "global" ? null : null
country   = each.key
}
for_each = var.service_domains
}

variable "global_hostname" {
description = "Global DNS name for service"
type        = string
}