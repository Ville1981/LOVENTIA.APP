// File: infra/terraform/alb.tf
// --- REPLACE START ---
resource "aws_lb" "app" {
  name               = "${local.name_prefix}-alb"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnets
}

resource "aws_lb_target_group" "ecs" {
  name        = "${local.name_prefix}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs.arn
  }
}
// --- REPLACE END ---


# infra/terraform/alb.tf
# --- REPLACE START: ALB target group health check ---
resource "aws_lb_target_group" "api_tg" {
  name     = "${var.project}-api-tg"
  port     = 5000
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    path                = "/healthz"
    matcher             = "200-399"
  }

  target_type = "ip"
}
# --- REPLACE END ---


# infra/terraform/alb.tf
# --- REPLACE START: enable ALB access logs ---
resource "aws_lb" "api_alb" {
  name               = "${var.project}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = var.public_subnets

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.bucket
    prefix  = "AWSLogs/${var.project}"
    enabled = true
  }
}
# --- REPLACE END ---
