# --- REPLACE START: ALB/TG autodiscovery (if names provided) ---
data "aws_lb" "selected" {
  count = (var.alb_name != null && var.alb_name != "" && (var.alb_arn_suffix == null || var.alb_arn_suffix == "")) ? 1 : 0
  name  = var.alb_name
}

data "aws_lb_target_group" "selected" {
  count = (var.tg_name != null && var.tg_name != "" && (var.tg_arn_suffix == null || var.tg_arn_suffix == "")) ? 1 : 0
  name  = var.tg_name
}

locals {
  alb_arn_suffix_effective = coalesce(
    var.alb_arn_suffix,
    try(data.aws_lb.selected[0].arn_suffix, null)
  )

  tg_arn_suffix_effective = coalesce(
    var.tg_arn_suffix,
    try(data.aws_lb_target_group.selected[0].arn_suffix, null)
  )
}
# --- REPLACE END ---
