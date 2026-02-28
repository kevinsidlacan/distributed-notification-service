#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Seeding default admin user..."
npx prisma db seed

echo "Starting API server..."
exec node dist/src/index.js
