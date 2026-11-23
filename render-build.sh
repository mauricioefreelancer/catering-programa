#!/usr/bin/env bash
set -euo pipefail

# Compatibilidad con servicios que aun apuntan a este script.
cd "$(dirname "$0")/backend"
npm ci && npx prisma generate && npm run build
