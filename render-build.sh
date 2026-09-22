# Render Build & Deploy Settings
# Servicio: Web Service (Node.js)
# Build Command:   bash render-build.sh
# Start Command:   cd backend && npm run start:prod
# Root Directory:  .

#!/usr/bin/env bash
set -euo pipefail

echo "▶️ === Instalando dependencias BACKEND ==="
cd backend
npm ci --no-audit --no-fund 2>&1 | tail -n 5

echo "▶️ === Generando Prisma Client ==="
npx prisma generate 2>&1 | tail -n 3

echo "▶️ === Ejecutando scripts SQL manuales (001 schema, 002 triggers, 003 auditoría) ==="
# Nota: En Render los scripts SQL se ejecutan de forma manual la primera vez
# desde pgAdmin conectando a la BD. Para despliegues con migraciones versionadas
# Prisma, reemplazar por: npx prisma migrate deploy
echo "  [INFO] Si es el primer deploy, ejecuta manualmente los scripts en supabase/migrations/ en orden: 001 -> 002 -> 003."

echo "▶️ === Compilando NestJS ==="
npm run build 2>&1 | tail -n 10

echo "✅ Build finalizado."
