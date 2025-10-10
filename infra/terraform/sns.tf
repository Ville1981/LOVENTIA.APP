# --- REPLACE START: optional SNS topic for alarms ---
locals {
  alarms_sns_topic_arn = var.create_sns_topic ? aws_sns_topic.alarms[0].arn : coalesce(var.sns_topic_arn, "")
}

resource "aws_sns_topic" "alarms" {
  count = var.create_sns_topic ? 1 : 0

  name              = var.sns_topic_name
  kms_master_key_id = var.sns_topic_kms_key_arn
}

data "aws_iam_policy_document" "sns_publish" {
  count = var.create_sns_topic ? 1 : 0

  statement {
    sid     = "AllowCloudWatchToPublish"
    effect  = "Allow"
    actions = ["sns:Publish"]

    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }

    resources = [aws_sns_topic.alarms[0].arn]
  }
}

resource "aws_sns_topic_policy" "alarms" {
  count  = var.create_sns_topic ? 1 : 0
  arn    = aws_sns_topic.alarms[0].arn
  policy = data.aws_iam_policy_document.sns_publish[0].json
}

output "alarms_sns_topic_arn" {
  value       = local.alarms_sns_topic_arn
  description = "SNS topic ARN used by alarms (created or external)"
}
# --- REPLACE END ---
