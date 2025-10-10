// File: infra/terraform/waf.tf
// --- REPLACE START ---
# Optional WAF association (disabled by default). Toggle with enable_waf=true and supply a web ACL ARN.
variable "waf_web_acl_arn" { type = string, default = "" }

resource "aws_wafv2_web_acl_association" "cf" {
  count        = var.enable_waf && length(var.waf_web_acl_arn) > 0 ? 1 : 0
  resource_arn = aws_cloudfront_distribution.frontend.arn
  web_acl_arn  = var.waf_web_acl_arn
}
// --- REPLACE END ---
