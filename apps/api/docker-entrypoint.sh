#!/usr/bin/env sh
set -euo pipefail

DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_USER=${POSTGRES_USER:-opendesk}

echo "Waiting for Postgres at $DB_HOST:$DB_PORT..."
until nc -z "$DB_HOST" "$DB_PORT"; do
  echo -n '.'
  sleep 1
done

echo "Postgres reachable, running Prisma migrations..."
# Use prisma migrate deploy in containers
npx prisma migrate deploy

echo "Running Prisma seed (if configured)..."
# Run the Prisma seed command if present
npx prisma db seed || true

echo "Starting application..."
exec "$@"
