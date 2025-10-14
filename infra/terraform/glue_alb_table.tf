# infra/terraform/glue_alb_table.tf
# --- REPLACE START: Glue table for ALB access logs ---
variable "alb_logs_bucket_name" { type = string }         # sama kuin s3_alb_logs.tf
variable "aws_region"           { type = string }
variable "account_id"           { type = string }
variable "project"              { type = string }

# ALB logit menevät polkuun: s3://<bucket>/AWSLogs/<account-id>/elasticloadbalancing/<region>/YYYY/MM/DD/...
# Huom: jos annoit prefixin "AWSLogs/${var.project}", laita LOCATIONiksi sen alkuun
locals {
  alb_logs_prefix = "AWSLogs" # jos käytit "AWSLogs/${var.project}", muuta tähän "AWSLogs/${var.project}"
}

resource "aws_glue_catalog_table" "alb_access_logs" {
  name          = "alb_access_logs"
  database_name = aws_athena_database.db.name
  table_type    = "EXTERNAL_TABLE"

  storage_descriptor {
    location      = "s3://${var.alb_logs_bucket_name}/${local.alb_logs_prefix}/${var.account_id}/elasticloadbalancing/${var.aws_region}/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    serde_info {
      name                  = "alb_regex_serde"
      serialization_library = "org.apache.hadoop.hive.serde2.RegexSerDe"
      parameters = {
        "input.regex" = "^([^ ]*) ([^ ]*) ([^ ]*) \\[([^\\]]*)\\] \"([^\"]*)\" ([0-9.|-]*) ([0-9.|-]*) ([0-9.|-]*) ([0-9.|-]*) \"([^\"]*)\" \"([^\"]*)\" ([^ ]*) ([^ ]*) \"([^\"]*)\" \"([^\"]*)\" \"([^\"]*)\" \"([^\"]*)\" ([^ ]*)$"
        "serialization.format" = "1"
      }
    }

    columns = [
      { name = "type",                 type = "string" },
      { name = "elb",                  type = "string" },
      { name = "client_ip_port",       type = "string" },
      { name = "timestamp",            type = "string" },
      { name = "request",              type = "string" },
      { name = "elb_status_code",      type = "string" },
      { name = "target_status_code",   type = "string" },
      { name = "request_processing_time", type = "string" },
      { name = "target_processing_time",  type = "string" },
      { name = "response_processing_time", type = "string" },
      { name = "elb_target",           type = "string" },
      { name = "received_bytes",       type = "string" },
      { name = "sent_bytes",           type = "string" },
      { name = "user_agent",           type = "string" },
      { name = "ssl_cipher",           type = "string" },
      { name = "ssl_protocol",         type = "string" },
      { name = "target_group_arn",     type = "string" },
      { name = "trace_id",             type = "string" }
    ]
  }

  parameters = {
    EXTERNAL = "TRUE"
    "projection.enabled" = "false"
  }
}
# --- REPLACE END ---


resource "aws_glue_catalog_table" "alb_access_logs" {
  name          = "alb_access_logs"
  database_name = aws_athena_database.db.name
  table_type    = "EXTERNAL_TABLE"

  storage_descriptor {
    # HUOM: jätä LOCATION osoittamaan juureen (vuosi/kk/päivä kansiot alla)
    location      = "s3://${var.alb_logs_bucket_name}/${local.alb_logs_prefix}/${var.account_id}/elasticloadbalancing/${var.aws_region}/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    serde_info {
      name                  = "alb_regex_serde"
      serialization_library = "org.apache.hadoop.hive.serde2.RegexSerDe"
      parameters = {
        "input.regex" = "^([^ ]*) ([^ ]*) ([^ ]*) \\[([^\\]]*)\\] \"([^\"]*)\" ([0-9.|-]*) ([0-9.|-]*) ([0-9.|-]*) ([0-9.|-]*) \"([^\"]*)\" \"([^\"]*)\" ([^ ]*) ([^ ]*) \"([^\"]*)\" \"([^\"]*)\" \"([^\"]*)\" \"([^\"]*)\" ([^ ]*)$"
        "serialization.format" = "1"
      }
    }

    columns = [
      { name = "type",  type = "string" },
      { name = "elb",   type = "string" },
      { name = "client_ip_port", type = "string" },
      { name = "timestamp", type = "string" },
      { name = "request",   type = "string" },
      { name = "elb_status_code", type = "string" },
      { name = "target_status_code", type = "string" },
      { name = "request_processing_time", type = "string" },
      { name = "target_processing_time",  type = "string" },
      { name = "response_processing_time", type = "string" },
      { name = "elb_target", type = "string" },
      { name = "received_bytes", type = "string" },
      { name = "sent_bytes", type = "string" },
      { name = "user_agent", type = "string" },
      { name = "ssl_cipher", type = "string" },
      { name = "ssl_protocol", type = "string" },
      { name = "target_group_arn", type = "string" },
      { name = "trace_id", type = "string" }
    ]
  }

  parameters = {
    EXTERNAL = "TRUE"

    # 🔽 Partition projection käyttöön (vuosi/kk/päivä)
    "projection.enabled"    = "true"
    "projection.year.type"  = "integer"
    "projection.year.range" = "2020,2099"

    "projection.month.type"  = "integer"
    "projection.month.range" = "1,12"
    "projection.month.digits" = "2"

    "projection.day.type"   = "integer"
    "projection.day.range"  = "1,31"
    "projection.day.digits" = "2"

    # Polkumalli (vastaa ALB:n polkua)
    "storage.location.template" = "s3://${var.alb_logs_bucket_name}/${local.alb_logs_prefix}/${var.account_id}/elasticloadbalancing/${var.aws_region}/\${year}/\${month}/\${day}/"
  }

  partition_keys = [
    { name = "year",  type = "int" },
    { name = "month", type = "int" },
    { name = "day",   type = "int" }
  ]
}


# infra/terraform/glue_alb_table.tf
# --- REPLACE START: enable partition projection (year/month/day) ---
resource "aws_glue_catalog_table" "alb_access_logs" {
  name          = "alb_access_logs"
  database_name = aws_athena_database.db.name
  table_type    = "EXTERNAL_TABLE"

  # 🔽 PARTITION KEYS
  partition_keys {
    name = "year"
    type = "string"
  }
  partition_keys {
    name = "month"
    type = "string"
  }
  partition_keys {
    name = "day"
    type = "string"
  }

  storage_descriptor {
    # HUOM: jätä LOCATION juureen, EI sisällä vuotta/kk/päivää
    location      = "s3://${var.alb_logs_bucket_name}/${local.alb_logs_prefix}/${var.account_id}/elasticloadbalancing/${var.aws_region}/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    serde_info {
      name                  = "alb_regex_serde"
      serialization_library = "org.apache.hadoop.hive.serde2.RegexSerDe"
      parameters = {
        "input.regex" = "^([^ ]*) ([^ ]*) ([^ ]*) \\[([^\\]]*)\\] \"([^\"]*)\" ([0-9.|-]*) ([0-9.|-]*) ([0-9.|-]*) ([0-9.|-]*) \"([^\"]*)\" \"([^\"]*)\" ([^ ]*) ([^ ]*) \"([^\"]*)\" \"([^\"]*)\" \"([^\"]*)\" \"([^\"]*)\" ([^ ]*)$"
        "serialization.format" = "1"
      }
    }

    columns = [
      { name = "type",                   type = "string" },
      { name = "elb",                    type = "string" },
      { name = "client_ip_port",         type = "string" },
      { name = "timestamp",              type = "string" },
      { name = "request",                type = "string" },
      { name = "elb_status_code",        type = "string" },
      { name = "target_status_code",     type = "string" },
      { name = "request_processing_time",  type = "string" },
      { name = "target_processing_time",   type = "string" },
      { name = "response_processing_time", type = "string" },
      { name = "elb_target",             type = "string" },
      { name = "received_bytes",         type = "string" },
      { name = "sent_bytes",             type = "string" },
      { name = "user_agent",             type = "string" },
      { name = "ssl_cipher",             type = "string" },
      { name = "ssl_protocol",           type = "string" },
      { name = "target_group_arn",       type = "string" },
      { name = "trace_id",               type = "string" }
    ]
  }

  parameters = {
    EXTERNAL            = "TRUE"
    "projection.enabled"       = "true"

    # 🔽 Partition projection: year/month/day
    "projection.year.type"     = "integer"
    "projection.year.range"    = "2018,2099"

    "projection.month.type"    = "integer"
    "projection.month.range"   = "1,12"
    "projection.month.digits"  = "2"

    "projection.day.type"      = "integer"
    "projection.day.range"     = "1,31"
    "projection.day.digits"    = "2"

    # 🔽 Template joka vastaa ALB-logien polkua (…/YYYY/MM/DD/)
    "storage.location.template" = "s3://${var.alb_logs_bucket_name}/${local.alb_logs_prefix}/${var.account_id}/elasticloadbalancing/${var.aws_region}/${year}/${month}/${day}/"
  }
}
# --- REPLACE END ---
