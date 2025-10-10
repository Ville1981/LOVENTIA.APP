// File: infra/terraform/ssm_parameters.tf
// --- REPLACE START ---
# Create placeholders for commonly used server env via SSM (optional).
# For production you will likely import or create these separately.
resource "aws_ssm_parameter" "server_env" {
  for_each = tomap({
    "MONGO_URI"           = "mongodb://127.0.0.1:27017/loventia"
    "JWT_SECRET"          = "change-me"
    "JWT_REFRESH_SECRET"  = "change-me-refresh"
    "STRIPE_SECRET_KEY"   = "sk_test_change_me"
    "STRIPE_PRICE_ID"     = "price_change_me"
    "STRIPE_WEBHOOK_SECRET" = "whsec_change_me"
    "CLIENT_URL"          = "http://localhost:5174"
  })
  name  = "${local.ssm_prefix}/${each.key}"
  type  = "SecureString"
  value = each.value
}
// --- REPLACE END ---
