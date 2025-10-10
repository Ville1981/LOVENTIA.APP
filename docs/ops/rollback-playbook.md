# File: docs/ops/rollback-playbook.md

<!--- REPLACE START: ECS rollback + CloudFront/S3 quick playbook (safe & explicit) --->

# Rollback Playbook (ECS + CloudFront)

> Goal: quickly restore a working version when a new deploy causes incidents.

## 1) Roll back server (ECS/Fargate)

### Option A — Previous task definition
```bash
AWS_REGION=eu-north-1
CLUSTER_NAME="<your-ecs-cluster>"
SERVICE_NAME="<your-ecs-service>"

aws ecs describe-services --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query 'services[0].taskDefinition' --output text
aws ecs list-task-definitions --region "$AWS_REGION" --family-prefix "<your-task-family>" --sort DESC --max-items 5

PREV_TASK_DEF_ARN="arn:aws:ecs:eu-north-1:XXXX:task-definition/<your-task-family>:123"
aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --service "$SERVICE_NAME" --task-definition "$PREV_TASK_DEF_ARN" --force-new-deployment
aws ecs wait services-stable --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME"
```

### Option B — Specific image tag
```bash
IMAGE_URI="<account>.dkr.ecr.eu-north-1.amazonaws.com/<repo>:prod-YYYYMMDD-HHMM"
jq --arg IMAGE "$IMAGE_URI" '.containerDefinitions[0].image |= $IMAGE' server/ecs-taskdef.json > taskdef.rollback.json
aws ecs register-task-definition --region eu-north-1 --cli-input-json file://taskdef.rollback.json
# then update-service as above
```

## 2) Roll back frontend (S3 + CloudFront)
```bash
BUCKET="<your-frontend-s3-bucket>"
aws s3 sync ./dist "s3://$BUCKET" --delete

DISTRIBUTION_ID="<your-cf-dist-id>"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*"
```

## 3) Verify
```bash
curl -fsS https://<your-api-domain-or-alb>/health
```

<!--- REPLACE END --->
