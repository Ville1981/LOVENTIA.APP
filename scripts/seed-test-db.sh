

#!/usr/bin/env bash

# scripts/seed-test-db.sh
# Tietokantaseedien luonti deterministisiin testien esiehtoihin

# Aseta ympäristömuuttujat tarvittaessa
DB_URL="mongodb://localhost:27017/datesite-test"

# Lataa seed-data.js tai vastaava skripti
SEED_SCRIPT="$(dirname "$0")/../scripts/seed-data.js"

# Tarkista, että seed-skripti on olemassa
if [ ! -f "$SEED_SCRIPT" ]; then
  echo "Error: Seed script not found at $SEED_SCRIPT"
  exit 1
fi

# Ajatetaan seed-skripti Node.js:llä
node "$SEED_SCRIPT" --db "$DB_URL"

echo "Test database seeded at $DB_URL"
