#!/bin/bash
# security/run-zap.sh
# Script to run OWASP ZAP baseline scan against the application
# Usage: ./run-zap.sh <target-url>

# Ensure ZAP CLI is installed and ZAP daemon is running
# You can start ZAP with: zap.sh -daemon -port 8080 -host 127.0.0.1

TARGET_URL=${1:-http://localhost:3000}
ZAP_API_KEY=${ZAP_API_KEY:-}

# Check for API key
if [ -z "$ZAP_API_KEY" ]; then
  echo "Warning: ZAP_API_KEY is not set. If API key is enforced, scan may fail."
fi

echo "Starting OWASP ZAP baseline scan against $TARGET_URL"

# Run baseline scan
zap-baseline.py \
  -t "$TARGET_URL" \
  -g gen.conf \
  -r zap_report.html \
  --hook=/etc/zap/hooks.js \
  --apikey "$ZAP_API_KEY" \
  -d

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "ZAP scan completed with errors (exit code $EXIT_CODE)"
  exit $EXIT_CODE
else
  echo "ZAP scan completed successfully. Report: zap_report.html"
fi
