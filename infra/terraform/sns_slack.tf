# --- REPLACE START: SNS -> Lambda (Slack) bridge ---
data "archive_file" "slack_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/slack_notifier"
  output_path = "${path.module}/lambda/slack_notifier.zip"
}

data "aws_caller_identity" "current" {}

data "aws_ssm_parameter" "slack_webhook" {
  count = var.enable_slack_alarm_forwarder && var.slack_webhook_ssm_param != null ? 1 : 0
  name  = var.slack_webhook_ssm_param
}

resource "aws_iam_role" "slack_lambda_role" {
  count = var.enable_slack_alarm_forwarder ? 1 : 0
  name  = "loventia-slack-forwarder-role-${var.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "slack_lambda_basic" {
  count      = var.enable_slack_alarm_forwarder ? 1 : 0
  role       = aws_iam_role.slack_lambda_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "slack_lambda_ssm_policy" {
  count = var.enable_slack_alarm_forwarder && var.slack_webhook_ssm_param != null ? 1 : 0
  name  = "loventia-slack-forwarder-ssm-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParameterHistory"],
      Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${var.slack_webhook_ssm_param}"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "slack_lambda_ssm_attach" {
  count      = var.enable_slack_alarm_forwarder && var.slack_webhook_ssm_param != null ? 1 : 0
  role       = aws_iam_role.slack_lambda_role[0].name
  policy_arn = aws_iam_policy.slack_lambda_ssm_policy[0].arn
}

resource "aws_lambda_function" "slack_forwarder" {
  count            = var.enable_slack_alarm_forwarder ? 1 : 0
  function_name    = "loventia-slack-forwarder-${var.env}"
  role             = aws_iam_role.slack_lambda_role[0].arn
  handler          = "index.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.slack_zip.output_path
  source_code_hash = data.archive_file.slack_zip.output_base64sha256

  environment {
    variables = {
      SLACK_WEBHOOK_URL = var.slack_webhook_ssm_param != null ? data.aws_ssm_parameter.slack_webhook[0].value : ""
    }
  }
}

resource "aws_sns_topic_subscription" "slack_lambda" {
  count     = var.enable_slack_alarm_forwarder && var.create_sns_topic ? 1 : 0
  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_forwarder[0].arn
}

resource "aws_lambda_permission" "allow_sns_invoke" {
  count = var.enable_slack_alarm_forwarder && var.create_sns_topic ? 1 : 0
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.slack_forwarder[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.alarms[0].arn
}
# --- REPLACE END ---
