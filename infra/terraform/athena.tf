# infra/terraform/athena.tf
# --- REPLACE START: Athena WG + DB for ALB logs ---
variable "athena_workgroup" {
  type    = string
  default = "loventia-analytics"
}

variable "athena_results_s3" {
  type = string
  # esim: "s3://loventia-athena-results-staging"
}

resource "aws_athena_workgroup" "wg" {
  name = var.athena_workgroup
  configuration {
    enforce_workgroup_configuration = true
    result_configuration {
      output_location = var.athena_results_s3
    }
  }
}

variable "athena_db_name" {
  type    = string
  default = "loventia_logs"
}

resource "aws_athena_database" "db" {
  name   = var.athena_db_name
  bucket = replace(var.athena_results_s3, "s3://", "")
  # HUOM: tämä vain rekisteröi DB:n; varsinainen taulu osoittaa ALB-logien bucketiin
}
# --- REPLACE END ---
