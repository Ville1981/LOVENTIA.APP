// File: infra/terraform/iam.tf
// --- REPLACE START ---
data "aws_iam_policy_document" "task_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals { type = "Service", identifiers = ["ecs-tasks.amazonaws.com"] }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${local.name_prefix}-task-exec"
  assume_role_policy = data.aws_iam_policy_document.task_assume.json
}

resource "aws_iam_role_policy_attachment" "exec_logs" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task_role" {
  name               = "${local.name_prefix}-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume.json
}

# Permit SSM parameter reads for this env prefix
data "aws_iam_policy_document" "task_ssm" {
  statement {
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["arn:aws:ssm:${var.region}:*:parameter${local.ssm_prefix}*"]
  }
}

resource "aws_iam_policy" "task_ssm" {
  name   = "${local.name_prefix}-task-ssm-read"
  policy = data.aws_iam_policy_document.task_ssm.json
}

resource "aws_iam_role_policy_attachment" "task_ssm_attach" {
  role       = aws_iam_role.task_role.name
  policy_arn = aws_iam_policy.task_ssm.arn
}
// --- REPLACE END ---


# infra/terraform/iam.tf
# --- ADD: AMP RemoteWrite policy for ECS task role ---
data "aws_caller_identity" "current" {}

# Oletetaan että sinulla on jo task role:
# resource "aws_iam_role" "ecs_task_role" { ... }

resource "aws_iam_policy" "amp_remote_write" {
  name        = "${var.project}-amp-remote-write"
  description = "Allow ADOT collector to remote_write to AMP"
  policy      = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid: "RemoteWrite",
        Effect: "Allow",
        Action: [
          "aps:RemoteWrite",
          "aps:GetSeries",
          "aps:GetLabels",
          "aps:GetMetricMetadata"
        ],
        Resource: "*"
        # Halutessasi rajoita workspace-resursseihin:
        # Resource: "arn:aws:aps:${var.aws_region}:${data.aws_caller_identity.current.account_id}:workspace/${var.amp_workspace_id}"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_role_attach_amp" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.amp_remote_write.arn
}
