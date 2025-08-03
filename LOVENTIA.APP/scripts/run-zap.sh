#!/usr/bin/env bash

# scripts/run-zap.sh
# Käynnistää OWASP ZAP CLI -skannauksen konfiguraatiolla security/zap-config.json
# Raportit tallennetaan zap-report-kansioon

CONFIG_PATH="$(dirname "$0")/../security/zap-config.json"
REPORT_DIR="$(dirname "$0")/../zap-report"

# Luo raporttikansio, jos ei ole
mkdir -p "$REPORT_DIR"

# Aja ZAP CLI scan
zap-cli --zap-path zap.sh \
  --config "$CONFIG_PATH" \
  --quickurl http://localhost:3000 \
  --quickout "$REPORT_DIR/zap-report.html"

# Voit halutessasi lisätä XML-raportin
zap-cli report -o "$REPORT_DIR/zap-report.xml" -f xml
