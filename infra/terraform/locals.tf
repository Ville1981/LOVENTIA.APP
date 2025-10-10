// File: infra/terraform/locals.tf
// --- REPLACE START ---
locals {
  name_prefix   = "${var.project}-${var.env}"
  s3_bucket     = "${var.project}-${var.env}-client"
  log_bucket    = "${var.project}-${var.env}-logs"
  cf_comment    = "${var.project}-${var.env}-frontend"
  ecr_repo_name = coalesce(var.ecr_repo_name, "${var.project}/${var.env}/server")
  ssm_prefix    = coalesce(var.ssm_prefix, "/${var.project}/${var.env}")
}
// --- REPLACE END ---
