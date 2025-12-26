#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"
COMPOSE_FILE="$ROOT/infra/docker/compose.yml"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"
API_DOCKERFILE="$API_DIR/Dockerfile"
WEB_DOCKERFILE="$WEB_DIR/Dockerfile"

echo "==> Killing common ports (3000,3001,5432,9000,9001) if in use..."
for PORT in 3000 3001 5432 9000 9001; do
  if lsof -iTCP -sTCP:LISTEN -Pn 2>/dev/null | grep -q ":$PORT"; then
    echo "  - Killing processes on port $PORT"
    fuser -k ${PORT}/tcp || true
  fi
done

echo "==> Stopping any running app containers (opendesk-api, opendesk-web) if present..."
docker rm -f opendesk-api opendesk-web 2>/dev/null || true

# Ensure host ports are free (kill anything still listening) before starting compose
for PORT in 3000 3001; do
  if lsof -iTCP -sTCP:LISTEN -Pn 2>/dev/null | grep -q ":$PORT"; then
    echo "  - Killing local process on port $PORT"
    fuser -k ${PORT}/tcp || true
  fi
done

# Verify ports are free (give up after a few seconds)
for PORT in 3000 3001; do
  ATTEMPTS=0
  while lsof -iTCP -sTCP:LISTEN -Pn 2>/dev/null | grep -q ":$PORT"; do
    ATTEMPTS=$((ATTEMPTS+1))
    if [ "$ATTEMPTS" -ge 10 ]; then
      echo "ERROR: Port $PORT still in use after repeated attempts. Please stop the local process using that port and re-run the script." >&2
      exit 1
    fi
    sleep 1
  done
done

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: docker compose file not found at $COMPOSE_FILE"
  exit 1
fi

echo "==> Bringing down existing infra compose stack (if any)..."
docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans || true

echo "==> Bringing up infra services (and building app images) via docker compose..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo "==> Waiting for infra to initialize (3s)..."
sleep 3
# Wait for Postgres to be ready (timeout after 60s)
echo "==> Waiting for Postgres on localhost:5432 to accept connections..."
RETRIES=0
until (</dev/tcp/127.0.0.1/5432) >/dev/null 2>&1; do
  RETRIES=$((RETRIES+1))
  if [ "$RETRIES" -ge 60 ]; then
    echo "ERROR: Postgres did not become ready in time" >&2
    exit 1
  fi
  sleep 1
done

echo "==> Postgres is available"

docker compose -f "$COMPOSE_FILE" ps --quiet --services

# Apply Prisma migrations from the API folder so the DB schema is up-to-date
if [ -d "$API_DIR" ]; then
  echo "==> Running Prisma migrations (non-interactive)..."
  (cd "$API_DIR" && npx prisma migrate deploy) || {
    echo "WARNING: Prisma migrate deploy failed; you may need to run migrations manually" >&2
  }
fi

# The 'api' and 'web' services are defined in docker-compose and were built above.
# Let docker-compose manage container lifecycle (no manual docker run here).
echo "==> Ensuring compose services are started"
docker compose -f "$COMPOSE_FILE" ps --services --filter "status=running" || true

echo "==> If you prefer manual docker run invocations, remove the services from compose.yml and use the script's run steps."

echo "==> Done. Running containers:"
docker ps --filter "name=opendesk-" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

echo
if [ "${1:-}" = "--smoke" ]; then
  echo "==> Running smoke test (create folder, create doc in folder, list, fetch)"

  # Wait for API HTTP responsiveness (returns any meaningful HTTP status like 200/401)
  echo "==> Waiting for API to respond on ${BASE_URL:-http://localhost:3001}..."
  API_RETRIES=0
  until (curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/drive/list" | grep -E '^[23]..$|^401$' >/dev/null 2>&1); do
    API_RETRIES=$((API_RETRIES+1))
    if [ "$API_RETRIES" -ge 60 ]; then
      echo "SMOKE FAILED: API did not respond in time"; exit 2
    fi
    sleep 1
  done

  set +e
  BASE_URL="http://localhost:3001"
  EMAIL="smoke+$(date +%s)@example.com"
  PASSWORD="password123"

  # Register
  printf '%s' "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" | curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" --data-binary @- >/dev/null

  # Login
  TOKEN=$(printf '%s' "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" | curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" --data-binary @- | jq -r .access_token)
  if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "SMOKE FAILED: login failed"; exit 2
  fi

  # Create folder
  FOLDER_JSON=$(printf '%s' '{"name":"smoke-folder"}' | curl -s -X POST "$BASE_URL/drive/folders" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" --data-binary @-)
  FOLDER_ID=$(echo "$FOLDER_JSON" | jq -r .id)
  if [ -z "$FOLDER_ID" ] || [ "$FOLDER_ID" = "null" ]; then
    echo "SMOKE FAILED: folder create failed"; echo "$FOLDER_JSON"; exit 3
  fi

  # Create doc in folder
  DOC_JSON=$(printf '%s' "{\"title\":\"Smoke Doc\",\"folderId\":\"$FOLDER_ID\"}" | curl -s -X POST "$BASE_URL/docs" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" --data-binary @-)
  DOC_ID=$(echo "$DOC_JSON" | jq -r .id)
  if [ -z "$DOC_ID" ] || [ "$DOC_ID" = "null" ]; then
    echo "SMOKE FAILED: doc create failed"; echo "$DOC_JSON"; exit 4
  fi

  # List drive and assert doc present
  LIST=$(curl -s -X GET "$BASE_URL/drive/list" -H "Authorization: Bearer $TOKEN" -G --data-urlencode "folderId=$FOLDER_ID")
  FOUND=$(echo "$LIST" | jq -r '.docs[]?.id' | grep -c "$DOC_ID" || true)
  if [ "$FOUND" -eq 0 ]; then
    echo "SMOKE FAILED: doc not found in drive list"; echo "$LIST"; exit 5
  fi

  # Fetch doc
  DOC_FETCH=$(curl -s -X GET "$BASE_URL/docs/$DOC_ID" -H "Authorization: Bearer $TOKEN")
  if echo "$DOC_FETCH" | jq -e .id >/dev/null 2>&1; then
    echo "SMOKE PASSED"
  else
    echo "SMOKE FAILED: could not fetch doc"; echo "$DOC_FETCH"; exit 6
  fi
  set -e
fi

echo "Tips:"
echo " - View logs: docker logs -f opendesk-api   or   docker logs -f opendesk-web"
echo " - To bring everything down: docker compose -f \"$COMPOSE_FILE\" down --volumes --remove-orphans && docker rm -f opendesk-api opendesk-web || true"