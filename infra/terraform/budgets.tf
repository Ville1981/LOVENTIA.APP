// File: infra/terraform/budgets.tf
// --- REPLACE START ---
# Minimal monthly cost budget (optional)
resource "aws_budgets_budget" "monthly" {
  count        = var.enable_budget ? 1 : 0
  name         = "${local.name_prefix}-monthly-budget"
  budget_type  = "COST"
  time_unit    = "MONTHLY"
  limit_amount = tostring(var.budget_limit)
  limit_unit   = "USD"
}
// --- REPLACE END ---
