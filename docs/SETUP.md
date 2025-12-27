# Setup Guide

This guide covers installation, configuration, and local development setup for OpenDesk.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start with Docker](#quick-start-with-docker)
- [Local Development Setup](#local-development-setup)
- [Environment Configuration](#environment-configuration)
- [Database Migrations](#database-migrations)
- [Smoke Testing](#smoke-testing)

## Prerequisites

### For Docker Deployment
- **Docker** (v20.10+)
- **Docker Compose** (v2.0+)
- **Bash shell** (Linux/macOS/WSL2 on Windows)

### For Local Development
- **Node.js** (v20.0+)
- **npm** or **yarn** package manager
- **PostgreSQL** (v15) — can be provided via Docker or locally installed
- **MinIO** (or S3-compatible storage) — can be provided via Docker or locally installed

## Quick Start with Docker

The fastest way to get OpenDesk running:

```bash
# Clone the repository
git clone https://github.com/yourusername/opendesk.git
cd opendesk

# Run the automated setup script
./scripts/up.sh
```

**What `up.sh` does:**
1. ✅ Kills any processes using ports 3000, 3001, 5432, 9000, 9001
2. ✅ Removes existing OpenDesk containers if present
3. ✅ Brings down any previous Docker Compose stack
4. ✅ Builds Docker images for API and web services
5. ✅ Starts PostgreSQL, MinIO, API, and web containers
6. ✅ Waits for PostgreSQL to be ready (up to 60 seconds)
7. ✅ Runs Prisma migrations to initialize the database schema
8. ✅ Displays running containers and logs instructions

**Faster local iterations:**
- Use `./scripts/up.sh --fast` to skip image builds and migrations for rapid iterative development (useful when you haven't changed Dockerfiles or DB schema).
- Alternatively use `./scripts/up.sh --skip-build` to skip image builds only, or `./scripts/up.sh --skip-migrate` to skip migrations.

Examples:
```bash
# Full (default): builds and migrates
./scripts/up.sh

# Fast dev loop (no rebuild, no migration)
./scripts/up.sh --fast

# Skip only builds
./scripts/up.sh --skip-build

# Skip only migrations
./scripts/up.sh --skip-migrate

# Dev build (faster image build, disables heavy extras like libreoffice/fonts)
./scripts/up.sh --dev-build

# Prebuild base image (recommended on first run or CI/cache warmup)
# This builds a base image with LibreOffice & fonts used for DOCX→PDF; useful to avoid reinstalling heavy packages on every build
./scripts/up.sh --ensure-base
```

**After startup, access:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **MinIO Console**: http://localhost:9001 (admin / minioadmin)
- **Database**: `postgresql://opendesk:opendesk@localhost:5432/opendesk`

## Local Development Setup

For development without Docker containers (services still required):

### 1. Install Dependencies

```bash
# Install monorepo dependencies
npm install

# This installs dependencies for:
# - apps/api
# - apps/web
# - packages/shared
```

### 2. Copy Environment Variables

```bash
# Copy the example environment file
cp infra/docker/env.example .env.local
```

**Required variables for local development:**

```bash
# Database (PostgreSQL running locally or via Docker)
DATABASE_URL=postgresql://opendesk:opendesk@localhost:5432/opendesk
POSTGRES_USER=opendesk
POSTGRES_PASSWORD=opendesk
POSTGRES_DB=opendesk

# Authentication
JWT_SECRET=dev-secret-key-change-in-production

# File Storage (MinIO running locally or via Docker)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_PUBLIC_ENDPOINT=http://localhost:9000

# Frontend API Connection
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Start Services (PostgreSQL & MinIO)

**Option A: Use Docker Compose for services only**

```bash
# Start only the database and storage services
docker compose -f infra/docker/compose.yml up postgres minio -d

# Wait for services to be ready
sleep 5
```

**Option B: Install PostgreSQL & MinIO locally**

```bash
# Install PostgreSQL 15 (macOS with Homebrew)
brew install postgresql

# Start PostgreSQL
postgres -D /usr/local/var/postgres

# Install MinIO
brew install minio

# Start MinIO
minio server ~/.minio/data --console-address ":9001"
```

### 4. Run Prisma Migrations

```bash
cd apps/api

# Apply migrations to the database
npx prisma migrate deploy

# (Optional) Open Prisma Studio to view/edit data
npx prisma studio
```

### 5. Start Development Servers

```bash
# From the root directory, start all dev servers
npm run dev

# Turbo will start in parallel:
# - apps/api:        NestJS on http://localhost:3001
# - apps/web:        Next.js on http://localhost:3000
```

**Individual server startup (if needed):**

```bash
# Terminal 1: Start API
cd apps/api
npm run start:dev

# Terminal 2: Start Web Frontend
cd apps/web
npm run dev
```

## Environment Configuration

### Full Environment Variables Reference

#### Database (PostgreSQL)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://opendesk:opendesk@localhost:5432/opendesk` | Full Postgres connection string |
| `POSTGRES_USER` | `opendesk` | Postgres username |
| `POSTGRES_PASSWORD` | `opendesk` | Postgres password |
| `POSTGRES_DB` | `opendesk` | Database name |

#### Authentication (NestJS API)

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `changeme` | Secret key for JWT signing (⚠️ change in production) |

#### File Storage (MinIO)

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIO_ENDPOINT` | `localhost` | MinIO hostname/IP |
| `MINIO_PORT` | `9000` | MinIO API port |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO root username |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO root password |
| `MINIO_PUBLIC_ENDPOINT` | `http://localhost:9000` | Public MinIO URL for browser access |

#### Frontend (Next.js Web)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend API base URL (public to browser) |

### Production Recommendations

⚠️ **Before deploying to production:**

1. **Change JWT_SECRET**
   ```bash
   JWT_SECRET=$(openssl rand -base64 32)
   ```

2. **Change MinIO credentials**
   ```bash
   MINIO_ROOT_USER=<strong-username>
   MINIO_ROOT_PASSWORD=<strong-password>
   ```

3. **Change Database password**
   ```bash
   POSTGRES_PASSWORD=<strong-password>
   ```

4. **Use external PostgreSQL**
   - Don't use the Docker container in production
   - Connect to managed PostgreSQL (AWS RDS, Azure Database, etc.)

5. **Use external MinIO or S3**
   - Set `MINIO_ENDPOINT` to your production S3 service
   - Use IAM credentials with bucket policies

## Database Migrations

Prisma handles schema versioning through migrations.

### Create a New Migration

```bash
cd apps/api

# Create a new migration (auto-generates migration file)
npx prisma migrate dev --name "add-feature-name"

# This will:
# 1. Generate SQL migration file
# 2. Apply migration to dev database
# 3. Regenerate Prisma client
```

### Apply Migrations

```bash
cd apps/api

# For development with schema.prisma edits
npx prisma migrate dev

# For CI/production (non-interactive)
npx prisma migrate deploy

# Push schema changes without migration files (dev only)
npx prisma db push
```

### Admin creation and seeding

This repository does not create a default admin user automatically. Instead, the first user to register via the API or web UI is granted admin privileges.

- To create the first admin interactively: register a new account at the web UI or POST to `http://localhost:3001/auth/register`.
- The registration response for the first user will include an `adminWarning` message; the frontend shows this to make you aware that this account is an admin.
- If you need deterministic provisioning (CI or scripted installs), create an upsert script using the Prisma client that sets `isAdmin: true` and run it after migrations.

If you previously relied on `prisma db seed`, remove or update that workflow; automatic seeding of a default admin is intentionally disabled.

### View Database State

```bash
cd apps/api

# Open Prisma Studio (GUI for data browsing/editing)
npx prisma studio

# Inspect current schema
npx prisma db pull  # Introspect existing database
```

### Rollback Migrations

⚠️ **WARNING: Destructive operation**

```bash
# Delete the migration file for the last migration
rm apps/api/prisma/migrations/<migration-folder>

# Reset dev database (clears all data)
npx prisma migrate reset

# Re-run all migrations from scratch
npx prisma migrate deploy
```

## Smoke Testing

Verify all services are working correctly:

```bash
# Run automated smoke test
./scripts/up.sh --smoke
```

**What the smoke test verifies:**
1. ✅ User registration endpoint
2. ✅ Login authentication (JWT token issuance)
3. ✅ Folder creation in drive
4. ✅ Document creation in a folder
5. ✅ Document listing in drive
6. ✅ Document retrieval
7. ✅ Markdown export (`/docs/:id/export` format=md)
8. ✅ DOCX export (`/docs/:id/export` format=docx)

> Note: PDF export requires LibreOffice present in the API container (installed in the default build or the `opendesk-api-base` image). If you are using `--dev-build` or `--fast` that skips installing LibreOffice, PDF export may fail.

**Output:**
```
==> SMOKE PASSED
```

**If smoke test fails:**

See [Troubleshooting Guide](TROUBLESHOOTING.md) for common issues.

## Development Workflow

### Frontend Development

```bash
cd apps/web

# Start Next.js dev server
npm run dev

# Opens at http://localhost:3000
# Auto-reloads on file changes
```

**Frontend files:**
- `src/app/` — Next.js App Router pages
- `src/components/` — React components
- `src/context/` — React Context providers (Auth, Theme)

### Backend Development

```bash
cd apps/api

# Start NestJS dev server with watch mode
npm run start:dev

# Runs on http://localhost:3001
# Auto-reloads on file changes
```

**Backend modules:**
- `src/auth/` — JWT authentication & user signup/login
- `src/docs/` — Document CRUD endpoints
- `src/drive/` — Folder & file management
- `src/storage/` — MinIO file upload/download

### Making Database Schema Changes

1. **Edit the schema:**
   ```bash
   vim apps/api/prisma/schema.prisma
   ```

2. **Create and apply migration:**
   ```bash
   cd apps/api
   npx prisma migrate dev --name "describe-change"
   ```

3. **Commit the migration:**
   ```bash
   git add apps/api/prisma/migrations/
   git commit -m "feat: add new schema"
   ```

## Useful Commands

### Monorepo Commands

```bash
npm run dev           # Start all services in dev mode
npm run build         # Build all packages
npm run lint          # Lint all code

# Run command in specific workspace
npm run --workspace=api build
```

### API Commands

```bash
cd apps/api

npm run start         # Production build + run
npm run start:dev     # Development mode with watch
npm run start:debug   # Debug mode with debugger listening
npm run lint          # Run ESLint
npm run format        # Format code with Prettier
```

### Web Commands

```bash
cd apps/web

npm run dev           # Development server
npm run build         # Production build
npm run start         # Start production server
npm run lint          # Run ESLint
```

### Docker Commands

```bash
# View all containers
docker ps -a

# View running OpenDesk containers
docker ps --filter "name=opendesk-"

# View logs
docker logs -f opendesk-api
docker logs -f opendesk-web
docker logs -f opendesk-postgres
docker logs -f opendesk-minio

# Stop all services
docker compose -f infra/docker/compose.yml down

# Stop and remove volumes (⚠️ deletes data)
docker compose -f infra/docker/compose.yml down --volumes

# Rebuild images
docker compose -f infra/docker/compose.yml build --no-cache

# Full restart
./scripts/up.sh
```

## Next Steps

1. **Read the [Architecture Guide](ARCHITECTURE.md)** to understand system design
2. **Check [API Reference](API.md)** for endpoint documentation
3. **See [Troubleshooting](TROUBLESHOOTING.md)** if you encounter issues
4. **Start building** — modify frontend and backend as needed!

---

**Questions?** Open an issue or check [Troubleshooting](TROUBLESHOOTING.md).
