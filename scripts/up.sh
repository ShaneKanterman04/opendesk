#!/usr/bin/env bash
set -euo pipefail

# Timing helpers for profiling the script
START_TS=$(date +%s)
LAST_TS=$START_TS
log_step(){ local now; now=$(date +%s); local elapsed=$((now-LAST_TS)); local total=$((now-START_TS)); echo "==> [$(date '+%T')] $1 (elapsed: ${elapsed}s, total: ${total}s)"; LAST_TS=$now; }
log_done(){ local now; now=$(date +%s); local total=$((now-START_TS)); echo "==> Completed in ${total}s"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"
COMPOSE_FILE="$ROOT/infra/docker/compose.yml"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"
API_DOCKERFILE="$API_DIR/Dockerfile"
WEB_DOCKERFILE="$WEB_DIR/Dockerfile"

# Parse flags: --fast (skip build and migrations), --skip-build, --skip-migrate, --smoke, --dev-build, --ensure-base
SKIP_BUILD=0
SKIP_MIGRATE=0
SMOKE=0
DEV_BUILD=0
ENSURE_BASE=0
for arg in "$@"; do
  case "$arg" in
    --fast)
      SKIP_BUILD=1
      SKIP_MIGRATE=1
      ;;
    --skip-build)
      SKIP_BUILD=1
      ;;
    --skip-migrate)
      SKIP_MIGRATE=1
      ;;
    --smoke)
      SMOKE=1
      ;;
    --dev-build)
      DEV_BUILD=1
      ;;
    --ensure-base)
      ENSURE_BASE=1
      ;;
    --help)
      echo "Usage: $0 [--fast] [--skip-build] [--skip-migrate] [--smoke] [--dev-build] [--ensure-base]"
      exit 0
      ;;
  esac
done

echo "==> Killing common ports (3000,3001,5432,9000,9001) if in use..."
for PORT in 3000 3001 5432 9000 9001; do
  if lsof -iTCP -sTCP:LISTEN -Pn 2>/dev/null | grep -q ":$PORT"; then
    echo "  - Killing processes on port $PORT"
    fuser -k ${PORT}/tcp || true
  fi
done

log_step "Killed common ports"

echo "==> Stopping any running app containers (opendesk-api, opendesk-web) if present..."
docker rm -f opendesk-api opendesk-web 2>/dev/null || true

# Ensure host ports are free (kill anything still listening) before starting compose
for PORT in 3000 3001; do
  if lsof -iTCP -sTCP:LISTEN -Pn 2>/dev/null | grep -q ":$PORT"; then
    echo "  - Killing local process on port $PORT"
    fuser -k ${PORT}/tcp || true
  fi
done
log_step "Killed local processes on ports 3000/3001"

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
log_step "Ports verified free"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: docker compose file not found at $COMPOSE_FILE"
  exit 1
fi
log_step "Compose file found"

echo "==> Bringing down existing infra compose stack (if any)..."
docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans || true
log_step "Compose stack down"

echo "==> Bringing up infra services via docker compose..."
if [ "${SKIP_BUILD}" -eq 1 ]; then
  echo "==> Skipping image build (--skip-build / --fast). Starting services"
  docker compose -f "$COMPOSE_FILE" up -d
else
  echo "==> Building images (parallel, BuildKit enabled)"

  # Optionally ensure a prebuilt base image exists (contains LibreOffice and fonts)
  BUILD_BASE_ARG=""
  if [ "${ENSURE_BASE}" -eq 1 ] || [ -z "$(docker images -q opendesk-api-base:latest 2>/dev/null)" ]; then
    echo "==> Building base image 'opendesk-api-base:latest' with heavier runtime deps (libreoffice, fonts)"
    docker build -f "$ROOT/apps/api/Dockerfile.base" -t opendesk-api-base:latest "$ROOT"
    log_step "Base image built"
    BUILD_BASE_ARG="--build-arg BASE_IMAGE=opendesk-api-base:latest"
  fi

  if [ "${DEV_BUILD}" -eq 1 ]; then
    echo "==> Dev build: disabling heavy extras to speed up (INSTALL_EXTRAS=false)"
    DOCKER_BUILDKIT=1 docker compose -f "$COMPOSE_FILE" build --parallel ${BUILD_BASE_ARG} --build-arg INSTALL_EXTRAS=false
  else
    DOCKER_BUILDKIT=1 docker compose -f "$COMPOSE_FILE" build --parallel ${BUILD_BASE_ARG}
  fi
  log_step "Image build complete"
  echo "==> Starting services"
  docker compose -f "$COMPOSE_FILE" up -d
fi
log_step "Compose up complete"

echo "==> Waiting for infra to initialize (3s)..."
sleep 3
# Wait for Postgres to be ready (use container healthcheck where available)
echo "==> Waiting for Postgres container to report healthy..."
RETRIES=0
until [ "$(docker inspect --format='{{.State.Health.Status}}' opendesk-postgres 2>/dev/null || echo starting)" = "healthy" ]; do
  RETRIES=$((RETRIES+1))
  if [ "$RETRIES" -ge 60 ]; then
    echo "ERROR: Postgres did not become healthy in time" >&2
    echo "Last Postgres logs:" >&2
    docker logs --tail 200 opendesk-postgres || true
    exit 1
  fi
  sleep 1
done

echo "==> Postgres is available"
log_step "Postgres available"

docker compose -f "$COMPOSE_FILE" ps --quiet --services

# Apply Prisma migrations from the API folder so the DB schema is up-to-date
if [ -d "$API_DIR" ]; then
  if [ "${SKIP_MIGRATE}" -eq 1 ]; then
    echo "==> Skipping Prisma migrations (--skip-migrate / --fast)"
    log_step "Skipped Prisma migrations"
  else
    # Attempt to detect if migrations have already been applied to avoid running deploy every time
    echo "==> Detecting existing migrations in the database..."
    if docker exec opendesk-postgres psql -U "${POSTGRES_USER:-opendesk}" -d "${POSTGRES_DB:-opendesk}" -tAc "SELECT 1 FROM prisma_migrations LIMIT 1;" >/dev/null 2>&1; then
      echo "==> Migrations present in database; skipping 'prisma migrate deploy'"
      log_step "Migrations already applied (skipped)"
    else
      echo "==> Running Prisma migrations (non-interactive)..."
      (cd "$API_DIR" && npx prisma migrate deploy) || {
        echo "WARNING: Prisma migrate deploy failed; you may need to run migrations manually" >&2
      }
      log_step "Prisma migrations finished"
    fi
  fi
fi

# The 'api' and 'web' services are defined in docker-compose and were built above.
# Let docker-compose manage container lifecycle (no manual docker run here).
echo "==> Ensuring compose services are started"
docker compose -f "$COMPOSE_FILE" ps --services --filter "status=running" || true
log_step "Compose services started"

echo "==> If you prefer manual docker run invocations, remove the services from compose.yml and use the script's run steps."

echo "==> Done. Running containers:"
docker ps --filter "name=opendesk-" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
log_done

echo
if [ "${SMOKE}" -eq 1 ]; then
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
    echo "SMOKE: Fetch doc passed"
  else
    echo "SMOKE FAILED: could not fetch doc"; echo "$DOC_FETCH"; exit 6
  fi

  # Export to Markdown
  MD_TMP="/tmp/export_${DOC_ID}.md"
  MD_CODE=$(curl -s -w "%{http_code}" -o "$MD_TMP" -X POST "$BASE_URL/docs/$DOC_ID/export" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data '{"format":"md","destination":"local","html":"<p>Smoke export</p>"}')
  if [ "$MD_CODE" -lt 200 ] || [ "$MD_CODE" -ge 300 ] || [ ! -s "$MD_TMP" ]; then
    echo "SMOKE FAILED: Markdown export failed (code=$MD_CODE)"; exit 7
  else
    echo "SMOKE: Markdown export passed (code=$MD_CODE)"
  fi

  # Export to DOCX
  DOCX_TMP="/tmp/export_${DOC_ID}.docx"
  DOCX_CODE=$(curl -s -w "%{http_code}" -o "$DOCX_TMP" -X POST "$BASE_URL/docs/$DOC_ID/export" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data '{"format":"docx","destination":"local","html":"<p>Smoke export</p>"}')
  if [ "$DOCX_CODE" -lt 200 ] || [ "$DOCX_CODE" -ge 300 ] || [ ! -s "$DOCX_TMP" ]; then
    echo "SMOKE FAILED: DOCX export failed (code=$DOCX_CODE)"; exit 8
  else
    echo "SMOKE: DOCX export passed (code=$DOCX_CODE)"
  fi

  echo "SMOKE PASSED"
  set -e
fi

echo "Tips:"
echo " - View logs: docker logs -f opendesk-api   or   docker logs -f opendesk-web"
echo " - To bring everything down: docker compose -f \"$COMPOSE_FILE\" down --volumes --remove-orphans && docker rm -f opendesk-api opendesk-web || true"