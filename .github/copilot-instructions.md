# OpenDesk Copilot Instructions

## Architecture Overview

OpenDesk is a **Turbo monorepo** with three-tier architecture:
- **Frontend** (`apps/web`): Next.js 15+ App Router, React Context for state, TipTap editor
- **Backend** (`apps/api`): NestJS with modular feature organization, Prisma ORM
- **Storage**: PostgreSQL (relational) + MinIO (S3-compatible file storage)

```
apps/api/src/{auth,docs,drive,storage}/  ← NestJS feature modules
apps/web/src/app/(dashboard)/           ← Protected routes (drive, docs)
apps/web/src/context/                    ← AuthContext, ThemeContext
```

## Critical Patterns

### Backend (NestJS)
- **Every controller uses `@UseGuards(JwtAuthGuard)`** for auth. Access user via `req.user.userId`
- **Service-per-module pattern**: `DocsService`, `DriveService`, `StorageService` handle business logic
- **Prisma is the single DB access layer** — inject `PrismaService` in services, never raw SQL
- **File uploads**: Two-step flow — `POST /drive/upload/init` creates record + presigned URL, then `POST /drive/upload/:fileId` streams to MinIO

### Frontend (Next.js)
- **Auth state**: Use `useAuth()` from `AuthContext.tsx`, tokens stored in `localStorage`
- **API calls**: Use axios with `Authorization: Bearer ${localStorage.getItem('token')}`
- **Dashboard layout**: Route groups `(dashboard)/` wrap protected pages with `Sidebar` + `Topbar`
- **Editor**: TipTap with auto-save via debounced PUT to `/docs/:id`

### Database (Prisma)
- Schema at [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma)
- Models: `User`, `Folder`, `File`, `Document` — all use UUID `@id @default(uuid())`
- Documents can optionally belong to folders via `folderId`
- Run migrations: `cd apps/api && npx prisma migrate dev`

## Development Commands

```bash
# Full stack via Docker (recommended)
./scripts/up.sh                    # Builds, migrates, starts all services

# Local development (requires running Postgres/MinIO)
npm install                        # Install all workspace deps
npm run dev                        # Starts both api (3001) and web (3000)

# API-specific
cd apps/api
npx prisma migrate dev             # Create/apply migrations
npx prisma generate                # Regenerate client after schema changes
npm run start:dev                  # Watch mode

# Testing
cd apps/api && npm test            # Jest unit tests (*.spec.ts)
```

## Key Files for Common Tasks

| Task | Files |
|------|-------|
| Add API endpoint | `apps/api/src/{module}/{module}.controller.ts`, `{module}.service.ts` |
| Add DB field | `apps/api/prisma/schema.prisma` → run `prisma migrate dev` |
| Add protected page | `apps/web/src/app/(dashboard)/[route]/page.tsx` |
| Modify editor | `apps/web/src/components/Editor.tsx`, `EditorToolbar.tsx` |
| Change auth flow | `apps/api/src/auth/auth.service.ts`, `apps/web/src/context/AuthContext.tsx` |

## Environment Variables

Docker Compose sets these automatically. For local dev, copy `infra/docker/env.example`:
- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — Signing key for auth tokens
- `MINIO_*` — Object storage credentials

## Testing Patterns

- Unit tests live alongside source: `*.spec.ts`
- Tests use `@nestjs/testing` with mocked `PrismaService`
- Example: [apps/api/src/docs/docs.service.spec.ts](apps/api/src/docs/docs.service.spec.ts)

## Common Pitfalls

- **Port conflicts**: `up.sh` kills processes on 3000/3001/5432/9000/9001 automatically
- **Prisma not synced**: After schema changes, run `prisma generate` before `prisma migrate`
- **Auth failures**: Ensure `JWT_SECRET` matches between API and any manual testing
- **MinIO CORS**: Browser uploads require MinIO configured with proper CORS (handled in compose)
