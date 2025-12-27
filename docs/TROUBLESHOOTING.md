# Troubleshooting Guide

Common issues and solutions for OpenDesk development and deployment.

## Table of Contents

- [Port Conflicts](#port-conflicts)
- [Database Issues](#database-issues)
- [Authentication Problems](#authentication-problems)
- [File Storage (MinIO) Issues](#file-storage-minio-issues)
- [Docker Errors](#docker-errors)
- [Frontend Issues](#frontend-issues)
- [Backend Issues](#backend-issues)
- [Performance Issues](#performance-issues)
- [Getting Help](#getting-help)

## Port Conflicts

### Symptom
```
Error: listen EADDRINUSE: address already in use :::3000
Error: listen EADDRINUSE: address already in use :::3001
```

### Cause
Another process is using the required ports:
- **3000**: Frontend (Next.js)
- **3001**: Backend API (NestJS)
- **5432**: PostgreSQL
- **9000**: MinIO API
- **9001**: MinIO Console

### Solutions

#### Option 1: Use the Automated Script (Recommended)

```bash
./scripts/up.sh
```

The script automatically:
1. Detects processes on ports 3000, 3001, 5432, 9000, 9001
2. Kills them if necessary
3. Verifies ports are free before starting

#### Option 2: Manual Port Freeing

**Find the process using the port:**
```bash
lsof -i :3000
# Output: COMMAND  PID  USER   FD  TYPE DEVICE SIZE/OFF NODE NAME
#         node    1234 user   12u IPv4  12345  0t0 TCP *:3000 (LISTEN)
```

**Kill the process:**
```bash
kill -9 1234

# Or kill all Node processes (⚠️ use with caution)
killall -9 node
```

**Verify the port is free:**
```bash
lsof -i :3000
# Should show no output
```

#### Option 3: Use Different Ports

**For Docker:**
```bash
# Modify infra/docker/compose.yml
services:
  api:
    ports:
      - "3002:3001"  # Map external 3002 → internal 3001
  web:
    ports:
      - "3003:3000"  # Map external 3003 → internal 3000
```

**For Local Development:**
```bash
# Terminal 1: Start API on different port
cd apps/api
PORT=3002 npm run start:dev

# Terminal 2: Start web with API pointing to new port
cd apps/web
NEXT_PUBLIC_API_URL=http://localhost:3002 npm run dev
```

---

## Database Issues

### Symptom: Database Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

### Cause
PostgreSQL is not running or not listening on the expected port.

### Solutions

#### 1. Start PostgreSQL via Docker

```bash
# Start only postgres
docker compose -f infra/docker/compose.yml up postgres -d

# Verify it's running
docker ps | grep postgres

# Check logs
docker logs -f opendesk-postgres
```

#### 2. Check Database URL

```bash
# Verify DATABASE_URL is set correctly
echo $DATABASE_URL
# Should output: postgresql://opendesk:opendesk@localhost:5432/opendesk

# Test connection with psql
psql postgresql://opendesk:opendesk@localhost:5432/opendesk -c "SELECT 1;"
```

#### 3. Check if PostgreSQL is Actually Running

```bash
# Check if port 5432 is listening
lsof -i :5432

# Try to connect
telnet localhost 5432
```

#### 4. Reset Database (Nuclear Option)

⚠️ **WARNING: This deletes all data**

```bash
# Stop containers
docker compose -f infra/docker/compose.yml down --volumes

# Remove database volume
docker volume rm opendesk_postgres_data

# Restart with fresh database
./scripts/up.sh
```

### Symptom: Prisma Migration Errors

```
Error: Migration failed. Rolled back transaction.
```

### Cause
- Database schema conflict
- Migration out of sync with actual schema
- Corrupted migration files

### Solutions

```bash
cd apps/api

# View migration status
npx prisma migrate status

# Manually apply migrations
npx prisma migrate deploy

# If you need to reset (dev only)
npx prisma migrate reset

# Check database against schema
npx prisma db push
```

### Symptom: "No migrations found"

```
Error: Could not find any migrations to apply. The database is already up to date.
```

**This is normal.** It means your schema is already synchronized with the database. No action needed.

---

## Authentication Problems

### Symptom: Login Fails with "Invalid Credentials"

```
Error: Invalid email or password
```

### Causes & Solutions

#### 1. User Not Registered

```bash
# Verify user exists in database
docker exec -it opendesk-postgres psql -U opendesk -d opendesk -c "SELECT * FROM users WHERE email='user@example.com';"

# If not, register the user first
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

#### 2. Password Hash Corruption

```bash
# Re-register the user
# Delete old user
docker exec -it opendesk-postgres psql -U opendesk -d opendesk -c "DELETE FROM users WHERE email='user@example.com';"

# Re-register with new password
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"newpassword123"}'
```

#### 3. Case Sensitivity

Email comparison in the database is case-insensitive, but ensure consistency:
```bash
# Login with lowercase email
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Symptom: JWT Token Validation Fails

```
Error: Unauthorized
```

### Causes & Solutions

#### 1. JWT_SECRET Mismatch

If you change `JWT_SECRET`, all existing tokens become invalid.

```bash
# Check current secret
echo $JWT_SECRET

# Verify API is using the correct secret
docker logs -f opendesk-api | grep -i secret

# If changed, re-login to get new token
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

#### 2. Token Expired

JWT tokens have a default expiry. Re-login for a new token.

```bash
# Get new token
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Use the access_token in subsequent requests
curl http://localhost:3001/drive/list \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

#### 3. Missing or Malformed Authorization Header

```bash
# ✅ Correct format
Authorization: Bearer <token>

# ❌ Common mistakes
Authorization: <token>
Authorization: bearer <token>
Authorization: JWT <token>
```

---

## File Storage (MinIO) Issues

### Symptom: MinIO Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:9000
```

### Causes & Solutions

#### 1. MinIO Not Running

```bash
# Start MinIO
docker compose -f infra/docker/compose.yml up minio -d

# Verify it's running
docker ps | grep minio

# Check logs
docker logs -f opendesk-minio
```

#### 2. Wrong MinIO Endpoint

In Docker Compose, internal services use service names:

```javascript
// ✅ Correct (inside Docker)
endpoint: 'minio'  // Uses Docker DNS resolution

// ❌ Wrong
endpoint: 'localhost'
endpoint: '127.0.0.1'
```

See `apps/api/src/storage/storage.service.ts` for endpoint configuration.

### Symptom: File Upload Fails

```
Error: Unable to upload file to storage
```

### Causes & Solutions

#### 1. MinIO Bucket Not Initialized

MinIO doesn't automatically create buckets. You may need to:

```bash
# Access MinIO Console
# URL: http://localhost:9001
# Default credentials: minioadmin / minioadmin

# Or use mc (MinIO Client)
docker run -it --rm minio/mc \
  mc alias set myminio http://localhost:9000 minioadmin minioadmin
  
mc mb myminio/opendesk
```

#### 2. MinIO Credentials Wrong

```bash
# Verify credentials in environment
echo $MINIO_ACCESS_KEY
echo $MINIO_SECRET_KEY

# Update if needed
export MINIO_ACCESS_KEY=minioadmin
export MINIO_SECRET_KEY=minioadmin
```

#### 3. File Size Too Large

Check MinIO's maximum object size (default 5GB).

```bash
# Reduce file size or configure MinIO limits
```

### Symptom: Can't Access MinIO Console

```
Connection refused at http://localhost:9001
```

### Solutions

```bash
# Verify MinIO is running
docker ps | grep minio

# Check service status
docker logs -f opendesk-minio

# Verify port 9001 is exposed
docker inspect opendesk-minio | grep -A 5 ExposedPorts

# Try direct connection
curl http://localhost:9001/
```

---

## Docker Errors

### Symptom: "No space left on device"

```
Error: no space left on device
```

### Solutions

```bash
# Clean up unused Docker resources
docker system prune -a

# Remove dangling volumes
docker volume prune

# Check disk space
df -h

# Remove old images
docker rmi <image-id>
```

### Symptom: "Cannot connect to Docker daemon"

```
Error: Cannot connect to the Docker daemon
```

### Solutions

```bash
# Start Docker daemon
sudo systemctl start docker  # Linux
open /Applications/Docker.app  # macOS

# Check Docker status
docker ps

# On macOS, check if Docker Desktop is running
ps aux | grep Docker
```

### Symptom: "Container exited with code 1"

```
opendesk-api exited with code 1
```

### Solutions

```bash
# Check container logs
docker logs -f opendesk-api

# Common causes:
# - Database not ready (wait for postgres)
# - Missing environment variables
# - Build errors
# - Port already in use

# View detailed error output
docker logs opendesk-api | tail -50
```

### Symptom: Build Fails

```
Error: Build failed
```

### Solutions

```bash
# Rebuild with no cache
docker compose -f infra/docker/compose.yml build --no-cache

# Check Dockerfile syntax
docker build apps/api -f apps/api/Dockerfile --dry-run

# View build output
docker compose -f infra/docker/compose.yml build --verbose
```

---

### Symptom: PDF export renders boxed characters (missing glyphs)

```
PDF output shows rectangular/boxed characters instead of expected text/glyphs.
```

**Cause:** The DOCX→PDF conversion (via `flex-conv`/LibreOffice) cannot find suitable system fonts inside the API container and substitutes missing glyphs.

**Quick fixes / diagnosis:**

- Rebuild the API image with common TTF fonts installed. In this project we add `fontconfig`, `ttf-dejavu`, and `ttf-freefont` to the API image so LibreOffice can find fonts:

```dockerfile
# apps/api/Dockerfile (example)
RUN apk add --no-cache python3 make g++ libreoffice fontconfig ttf-dejavu ttf-freefont
```

- Rebuild and restart the API:

```bash
docker compose -f infra/docker/compose.yml build api
docker compose -f infra/docker/compose.yml up -d api
```

- For a quick test (without rebuilding), you can install fonts into a running API container:

```bash
docker exec -it opendesk-api sh
apk add --no-cache fontconfig ttf-dejavu ttf-freefont
# re-run your export request and check behavior
```

- Check API logs for `flex-conv output` or errors from the export endpoint:

```bash
docker logs opendesk-api | tail -n 200
```

If this does not resolve the issue, please capture the PDF produced and the `docker logs` output and attach them for further debugging.

## Frontend Issues

### Symptom: "Cannot GET /"

```
Error: Cannot GET /
```

### Cause
Next.js dev server not responding.

### Solutions

```bash
cd apps/web

# Check if running
npm run dev

# Verify port 3000
lsof -i :3000

# Check API connection
curl http://localhost:3001/health

# Check logs
npm run dev 2>&1 | head -50
```

### Symptom: API Connection Refused

```
Error: Failed to fetch http://localhost:3001
```

### Causes & Solutions

#### 1. API Not Running

```bash
# Start API
cd apps/api
npm run start:dev

# Or via Docker
docker compose -f infra/docker/compose.yml up api -d
```

#### 2. NEXT_PUBLIC_API_URL Wrong

```bash
# Check environment variable
echo $NEXT_PUBLIC_API_URL

# Should be the backend API URL
# In development: http://localhost:3001
# In Docker: http://api:3001

# Update and restart
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```

#### 3. CORS Issues

```
Access to XMLHttpRequest blocked by CORS policy
```

The backend has CORS enabled in `apps/api/src/main.ts`:

```typescript
app.enableCors();
```

If still blocked, check:
```bash
# API logs for CORS errors
docker logs -f opendesk-api | grep -i cors

# Browser DevTools Console for detailed error
```

### Symptom: Pages Won't Load (404)

```
Error: 404 Not Found
```

### Solutions

```bash
# Check page file exists
ls apps/web/src/app/page.tsx

# Verify routing is correct
ls apps/web/src/app/[route]/page.tsx

# Restart Next.js
pkill -f "next dev"
npm run dev
```

### Symptom: Styling Not Applied

```
CSS not loading, styles are broken
```

### Solutions

```bash
# Clear Next.js cache
rm -rf apps/web/.next

# Restart dev server
npm run dev

# Check PostCSS config
cat apps/web/postcss.config.mjs

# Verify tailwind is configured
ls apps/web/tailwind.config.ts
```

---

## Backend Issues

### Symptom: "Cannot find module"

```
Error: Cannot find module '@nestjs/core'
```

### Solutions

```bash
cd apps/api

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Link workspace
npm link ../web
npm link ../../packages/shared
```

### Symptom: API Returns 500 Internal Server Error

```
Error: Internal Server Error
```

### Solutions

```bash
# Check API logs for detailed error
docker logs -f opendesk-api

# Or if running locally:
npm run start:dev  # Run with stack traces visible

# Common causes:
# - Database connection failed
# - Missing environment variables
# - Unhandled exception in controller
```

### Symptom: Validation Fails

```
Error: Validation failed
```

### Solutions

```bash
# Check request body matches DTO
# Example: CreateDocDto requires { title: string; folderId?: string }

# Test with curl
curl -X POST http://localhost:3001/docs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"My Doc"}'

# Check API logs for validation details
docker logs opendesk-api | grep -i validation
```

---

## Performance Issues

### Symptom: API Slow or Timeout

```
Error: Request timeout after 30 seconds
```

### Causes & Solutions

#### 1. Database Slow Queries

```bash
# Connect to database and check slow queries
docker exec -it opendesk-postgres psql -U opendesk -d opendesk

# View table statistics
\dt  # List tables
SELECT count(*) FROM documents;  # Count documents
```

Add database indexes:

```sql
-- In Prisma migration
CREATE INDEX idx_documents_owner_folder 
ON documents(ownerId, folderId);
```

#### 2. Large File Uploads

```bash
# Increase timeout
# In apps/api/src/main.ts
app.use(express.json({ limit: '50mb' }));
```

#### 3. MinIO Slow

```bash
# Check MinIO logs
docker logs -f opendesk-minio

# Verify disk performance
fio --name=randread --ioengine=libaio --iodepth=16 --rw=randread --bs=4k
```

### Symptom: Memory Leak or High CPU

```
Node process using 95% CPU or growing memory
```

### Solutions

```bash
# Check Node process
ps aux | grep node

# Kill and restart
docker restart opendesk-api

# Check for infinite loops or unhandled promises
# Review recent code changes in git
git log --oneline -20

# Monitor memory in real-time
docker stats opendesk-api
```

---

## Getting Help

### 1. Check Logs

```bash
# All containers
docker compose -f infra/docker/compose.yml logs -f

# Specific service
docker logs -f opendesk-api
docker logs -f opendesk-web
docker logs -f opendesk-postgres

# Last 100 lines with timestamps
docker logs --timestamps -n 100 opendesk-api
```

### 2. Smoke Test

```bash
# Run built-in smoke test
./scripts/up.sh --smoke

# This verifies:
# - Register endpoint
# - Login endpoint
# - Folder creation
# - Document creation
# - Document listing
```

### 3. Inspect Services

```bash
# Check running containers
docker ps

# Inspect a container
docker inspect opendesk-api

# Check network connectivity
docker network ls
docker network inspect opendesk_opendesk-network
```

### 4. Debug with curl

```bash
# Test endpoint directly
curl -X GET http://localhost:3001/drive/list \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -v  # Verbose output

# Check HTTP status
curl -w "HTTP %{http_code}\n" http://localhost:3001/
```

### 5. Check Environment

```bash
# Verify all environment variables
env | grep -E "(DATABASE|JWT|MINIO|NEXT_PUBLIC)"

# Check file permissions
ls -la /home/shanekanterman/opendesk

# Check disk space
df -h

# Check port availability
lsof -i :3000 :3001 :5432 :9000 :9001
```

### 6. Reset Everything

⚠️ **Warning: This will delete all data**

```bash
# Stop all services
docker compose -f infra/docker/compose.yml down --volumes --remove-orphans

# Remove containers and images
docker rm -f opendesk-api opendesk-web opendesk-postgres opendesk-minio

# Clean up volumes
docker volume prune -f

# Reinstall and start fresh
npm install
./scripts/up.sh
```

---

**Still stuck?** 
- Check [Architecture Documentation](ARCHITECTURE.md)
- Search [GitHub Issues](https://github.com/yourusername/opendesk/issues)
- Post a new issue with logs and error messages
