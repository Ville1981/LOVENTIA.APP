// File: infra/terraform/ecs_service.tf
// --- REPLACE START ---
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.name_prefix}"
  retention_in_days = 14
}

resource "aws_ecs_task_definition" "server" {
  family                   = "${local.name_prefix}-task"
  cpu                      = tostring(var.task_cpu)
  memory                   = tostring(var.task_memory)
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task_role.arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "server"
      image     = "${aws_ecr_repository.server.repository_url}:latest"
      essential = true
      portMappings = [{
        containerPort = var.container_port
        hostPort      = var.container_port
        protocol      = "tcp"
      }]
      environment = [
        { name = "NODE_ENV", value = var.env },
        { name = "PORT",     value = tostring(var.container_port) }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "server" {
  name            = "${local.name_prefix}-svc"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.server.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnets
    security_groups = [aws_security_group.tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ecs.arn
    container_name   = "server"
    container_port   = var.container_port
  }

  depends_on = [aws_lb_listener.http]
}
// --- REPLACE END ---
