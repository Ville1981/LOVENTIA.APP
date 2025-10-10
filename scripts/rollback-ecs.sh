# File: scripts/rollback-ecs.sh
# --- REPLACE START: Bash rollback helper (ECS + optional CF) ---
#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 --cluster <ECS_CLUSTER> --service <ECS_SERVICE> [--to-revision previous|family:rev|arn] [--distribution-id <ID>] [--invalidate "/*"] [--dry-run]
EOF
}

CLUSTER=""
SERVICE=""
TO_REVISION="previous"
DIST_ID=""
INVALIDATE="/*"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cluster) CLUSTER="$2"; shift 2;;
    --service) SERVICE="$2"; shift 2;;
    --to-revision) TO_REVISION="$2"; shift 2;;
    --distribution-id) DIST_ID="$2"; shift 2;;
    --invalidate) INVALIDATE="$2"; shift 2;;
    --dry-run) DRY_RUN=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

command -v aws >/dev/null 2>&1 || { echo "aws CLI is required"; exit 1; }
[[ -n "$CLUSTER" && -n "$SERVICE" ]] || { echo "cluster and service are required"; usage; exit 1; }

echo "ECS rollback starting..."
echo "Cluster: $CLUSTER"
echo "Service: $SERVICE"
echo "Target revision: $TO_REVISION"

# 1) Current task def
CURRENT_TD="$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --query 'services[0].taskDefinition' --output text)"
if [[ -z "$CURRENT_TD" || "$CURRENT_TD" == "None" ]]; then
  echo "Failed to get current task definition"; exit 1
fi
echo "Current task: $CURRENT_TD"

# 2) Resolve target
TARGET_TD="$TO_REVISION"
if [[ "$TO_REVISION" == "previous" ]]; then
  FAMILY="$(echo "$CURRENT_TD" | awk -F'[:/]' '{print $(NF-1)}')"
  LIST_JSON="$(aws ecs list-task-definitions --family-prefix "$FAMILY" --sort DESC --max-items 5)"
  TARGET_TD="$(echo "$LIST_JSON" | jq -r '.taskDefinitionArns[1]')"
  if [[ -z "$TARGET_TD" || "$TARGET_TD" == "null" ]]; then
    echo "No previous task definition found for family '$FAMILY'"; exit 1
  fi
fi
echo "Target task: $TARGET_TD"

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[DryRun] Would update service to $TARGET_TD"
else
  aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --task-definition "$TARGET_TD" >/dev/null
  echo "Update submitted. Waiting for stability..."
  aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE"
  echo "Service is stable on target task."
fi

# 3) Optional CF invalidation
if [[ -n "$DIST_ID" ]]; then
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "[DryRun] Would invalidate CloudFront $DIST_ID with paths '$INVALIDATE'"
  else
    aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "$INVALIDATE" >/dev/null || {
      echo "CloudFront invalidation failed"; exit 1;
    }
    echo "CloudFront invalidation created."
  fi
fi

echo "Rollback completed."
# --- REPLACE END ---









# File: scripts/rollback-ecs.sh

# --- REPLACE START: ECS rollback + optional CloudFront invalidation (Bash) ---
#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/rollback-ecs.sh -r eu-north-1 -c my-cluster -s my-service [-p awsProfile] [-d DIST_ID] [--paths "/*" "/index.html"]

REGION=""
CLUSTER=""
SERVICE=""
PROFILE=""
DIST_ID=""
# default invalidate everything
PATHS=("/*")

while [[ $# -gt 0 ]]; do
  case "$1" in
    -r|--region) REGION="$2"; shift 2 ;;
    -c|--cluster) CLUSTER="$2"; shift 2 ;;
    -s|--service) SERVICE="$2"; shift 2 ;;
    -p|--profile) PROFILE="$2"; shift 2 ;;
    -d|--distribution) DIST_ID="$2"; shift 2 ;;
    --paths)
      shift
      PATHS=()
      while [[ $# -gt 0 && "$1" != -* ]]; do PATHS+=("$1"); shift; done
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "${REGION}" || -z "${CLUSTER}" || -z "${SERVICE}" ]]; then
  echo "Usage: $0 -r <region> -c <cluster> -s <service> [-p profile] [-d cfDistId] [--paths \"/*\" \"/index.html\"]"
  exit 1
fi

AWS=(aws --region "$REGION")
[[ -n "$PROFILE" ]] && AWS+=(--profile "$PROFILE")

echo "Reading current task definition..."
SVC_JSON="$("${AWS[@]}" ecs describe-services --cluster "$CLUSTER" --services "$SERVICE")"
CURRENT_TD_ARN="$(echo "$SVC_JSON" | jq -r '.services[0].taskDefinition')"
if [[ -z "$CURRENT_TD_ARN" || "$CURRENT_TD_ARN" == "null" ]]; then
  echo "Service not found or no taskDefinition."
  exit 1
fi
echo "Current task: $CURRENT_TD_ARN"

if [[ "$CURRENT_TD_ARN" =~ task-definition/([^:]+):([0-9]+)$ ]]; then
  FAMILY="${BASH_REMATCH[1]}"
  REV="${BASH_REMATCH[2]}"
else
  echo "Cannot parse family:revision from $CURRENT_TD_ARN"
  exit 1
fi

TARGET_REV=$((REV-1))
if [[ $TARGET_REV -lt 1 ]]; then
  echo "No previous revision exists (current $REV)."
  exit 1
fi
echo "Family: $FAMILY, current: $REV -> target: $TARGET_REV"

LIST="$("${AWS[@]}" ecs list-task-definitions --family-prefix "$FAMILY" --status ACTIVE --sort DESC | jq -r '.taskDefinitionArns[]')"
PREV_ARN="$(echo "$LIST" | grep -E ":${TARGET_REV}$" || true)"
if [[ -z "$PREV_ARN" ]]; then
  # fallback: pick the next lower ACTIVE
  PREV_ARN_REV="$(echo "$LIST" | sed -E 's/.*:([0-9]+)$/\1/' | awk -v cur="$REV" '$1<cur' | sort -nr | head -n1)"
  [[ -n "$PREV_ARN_REV" ]] && PREV_ARN="$(echo "$LIST" | grep -E ":${PREV_ARN_REV}$" || true)"
fi

if [[ -z "$PREV_ARN" ]]; then
  echo "Could not find a previous ACTIVE task definition for $FAMILY (< $REV)."
  exit 1
fi
echo "Rolling back to: $PREV_ARN"

"${AWS[@]}" ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --task-definition "$PREV_ARN" --force-new-deployment >/dev/null
echo "Waiting for service stability..."
"${AWS[@]}" ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE"

if [[ -n "$DIST_ID" ]]; then
  echo "Creating CloudFront invalidation for $DIST_ID"
  # Build JSON batch
  ITEMS_JSON=$(printf '"%s",' "${PATHS[@]}")
  ITEMS_JSON="[${ITEMS_JSON%,}]"
  BATCH=$(cat <<EOF
{
  "Paths": { "Quantity": ${#PATHS[@]}, "Items": ${ITEMS_JSON} },
  "CallerReference": "$(date +%s)-rollback"
}
EOF
),,,,
  echo "$BATCH" > /tmp/cf_invalidation.json
  "${AWS[@]}" cloudfront create-invalidation --distribution-id "$DIST_ID" --invalidation-batch file:///tmp/cf_invalidation.json >/dev/null
  echo "CloudFront invalidation requested."
fi

echo "Rollback complete."
# --- REPLACE END ---
,,,,