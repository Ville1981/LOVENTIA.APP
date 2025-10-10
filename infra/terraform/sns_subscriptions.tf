# --- REPLACE START: optional SNS email subscriptions ---
resource "aws_sns_topic_subscription" "alarm_emails" {
  for_each  = var.create_sns_topic ? toset(var.alarm_emails) : []
  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = each.value
}
# --- REPLACE END ---
