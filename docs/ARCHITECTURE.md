# Architecture & Design

This document describes the OpenDesk system architecture, design patterns, and module organization.

## Table of Contents

- [System Overview](#system-overview)
- [Monorepo Structure](#monorepo-structure)
- [Backend Architecture (NestJS)](#backend-architecture-nestjs)
- [Frontend Architecture (Next.js)](#frontend-architecture-nextjs)
- [Database Design](#database-design)
- [API Design](#api-design)
- [Authentication Flow](#authentication-flow)
- [File Storage Architecture](#file-storage-architecture)
- [Deployment Architecture](#deployment-architecture)

## System Overview

OpenDesk is a **three-tier, containerized application** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│                  http://localhost:3000                   │
│  - React SSR with App Router                            │
│  - TailwindCSS styling                                  │
│  - Context-based state (Auth, Theme)                    │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTP REST API
                   │ Bearer Token Auth
┌──────────────────▼──────────────────────────────────────┐
│                   Backend (NestJS)                       │
│                 http://localhost:3001                    │
│  - Auth Module (JWT, Passport)                          │
│  - Docs Module (Document CRUD)                          │
│  - Drive Module (Folders, Files)                        │
│  - Storage Module (MinIO integration)                   │
└──────────────────┬──────────────────────────────────────┘
         ┌─────────┴──────────┬───────────┐
         │                    │           │
┌────────▼────────┐  ┌────────▼─────┐  ┌─▼────────────┐
│   PostgreSQL    │  │    MinIO     │  │ Prisma ORM   │
│   (Port 5432)   │  │  (Port 9000) │  │              │
│  - Users        │  │  - File Blobs│  │ - Query DSL  │
│  - Folders      │  │  - Storage   │  │ - Migrations │
│  - Files        │  │  - Objects   │  │              │
│  - Documents    │  │              │  │              │
└─────────────────┘  └──────────────┘  └──────────────┘
```

## Monorepo Structure

OpenDesk uses **Turbo workspaces** for monorepo management:

```
opendesk/
├── package.json                 # Root monorepo config
├── turbo.json                   # Turbo cache config
│
├── apps/
│   ├── api/                     # NestJS Backend
│   │   ├── src/
│   │   │   ├── app.module.ts   # Root NestJS module
│   │   │   ├── main.ts         # Application entry
│   │   │   ├── auth/           # 🔐 Authentication module
│   │   │   ├── docs/           # 📝 Documents module
│   │   │   ├── drive/          # 📁 Drive (folders/files) module
│   │   │   └── storage/        # 📦 File storage module
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   └── migrations/     # SQL migration files
│   │   ├── jest.config.cjs     # Test configuration
│   │   └── Dockerfile          # Container image
│   │
│   └── web/                     # Next.js Frontend
│       ├── src/
│       │   ├── app/            # Next.js App Router
│       │   │   ├── page.tsx    # Landing page
│       │   │   ├── login/      # Login page
│       │   │   ├── register/   # Registration page
│       │   │   └── (dashboard)/# Protected routes
│       │   │       ├── docs/   # Documents section
│       │   │       └── drive/  # Drive section
│       │   ├── components/     # React components
│       │   │   ├── Editor.tsx  # TipTap document editor
│       │   │   ├── Sidebar.tsx # Navigation sidebar
│       │   │   ├── Topbar.tsx  # Header/topbar
│       │   │   └── EditorToolbar.tsx
│       │   └── context/        # React Context
│       │       ├── AuthContext.tsx
│       │       └── ThemeContext.tsx
│       ├── next.config.ts      # Next.js config
│       └── Dockerfile          # Container image
│
├── packages/
│   └── shared/                  # Shared TypeScript types (future)
│       ├── src/
│       │   └── index.ts        # Re-exports
│       └── package.json
│
├── infra/
│   └── docker/
│       ├── compose.yml         # Docker Compose manifest
│       └── env.example         # Environment template
│
└── scripts/
    └── up.sh                   # Automated setup script
```

## Backend Architecture (NestJS)

### Module Organization

NestJS uses a **modular architecture** with clear separation by feature:

#### App Module

```typescript
// apps/api/src/app.module.ts
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DocsModule,
    DriveModule,
    StorageModule,
  ],
})
export class AppModule {}
```

### Core Modules

#### 1. Auth Module 🔐

**Purpose**: User registration, login, JWT token generation, JWT validation

**Files**:
- `auth.service.ts` — Registration, login, password hashing (bcrypt)
- `auth.controller.ts` — Endpoints: `POST /auth/register`, `POST /auth/login`
- `jwt.strategy.ts` — Passport JWT strategy for token validation
- `jwt-auth.guard.ts` — Route guard for protected endpoints

**Key Flows**:
```
Register: email + password → bcrypt hash → store User
Login: email + password → bcrypt verify → JWT token
Protected Route: Bearer token → JWT validation → req.user populated
```

**Database Interaction**:
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String   # bcrypt hash
  isAdmin   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### 2. Docs Module 📝

**Purpose**: Document CRUD operations with rich-text content

**Files**:
- `docs.service.ts` — Create, read, update, delete documents
- `docs.controller.ts` — Endpoints for document management

**Key Operations**:
- `POST /docs` — Create new document (optionally in a folder)
- `GET /docs/:id` — Fetch single document
- `PATCH /docs/:id` — Update document content/settings
- `DELETE /docs/:id` — Delete document
- `GET /docs` — List user's documents

Additional operations:
- `POST /docs/:id/export` — Export a document to `pdf|docx|md` and either download or save to Drive (accepts `destination` and optional `folderId`).

**Database Interaction**:
```prisma
model Document {
  id        String   @id @default(uuid())
  title     String
  content   Json?    # TipTap editor JSON
  ownerId   String   # User who owns the document
  folderId  String?  # Optional folder placement
  settings  Json?    # Theme, fontSize, fontFamily
  sortOrder Int?     @map("sort_order") // Optional numeric order for ordering inside a folder
  deletedAt DateTime? // Soft-delete timestamp
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### 3. Drive Module 📁

**Purpose**: Folder hierarchy and file organization

**Files**:
- `drive.service.ts` — Folder & file management
- `drive.controller.ts` — Endpoints for drive operations

**Key Operations**:
- `POST /drive/folders` — Create folder
- `GET /drive/folders/:id/children` — List subfolder contents
- `POST /drive/folders/:id/files` — Upload file to folder
- `GET /drive/list` — List all contents (folders, documents, files) for a user

Additional operations / API notes:
- `GET /drive/list` — List user's drive contents (supports `folderId` query).
- `GET /drive/debug` — Internal debug query endpoint (not for production).
- `POST /drive/upload/init` — Initialize an upload, returns a file entry with `file.id` and presigned info.
- `POST /drive/upload/finalize` — Finalize an upload (noop in this codebase; returns `{status: 'ok'}`).
- `POST /drive/upload/:fileId` — Multipart upload of the file content (accepts `file` field).
- `GET /drive/file/:fileId` — Stream/download a file by id.
- `POST /drive/item/move` — Move a `file` or `doc` into another folder.
- `POST /drive/item/reorder` — Reorder items inside a folder by providing `orderedIds`.
- `DELETE /drive/file/:fileId` — Soft-delete a file (sets `deletedAt`).
- `DELETE /drive/folder/:folderId` — Delete a folder.

**Database Interaction**:
```prisma
model Folder {
  id        String   @id @default(uuid())
  name      String
  parentId  String?  # Parent folder (null = root)
  ownerId   String   # User who owns the folder
  createdAt DateTime @default(now())
}

model File {
  id        String   @id @default(uuid())
  name      String
  mimeType  String
  size      Int
  key       String   # MinIO object key
  folderId  String?  # Folder it's in
  ownerId   String
  createdAt DateTime @default(now())
}
```

#### 4. Storage Module 📦

**Purpose**: MinIO S3-compatible object storage integration

**Files**:
- `storage.service.ts` — Upload, download, delete files in MinIO

**Key Operations**:
- Upload file to MinIO (called by drive/upload)
- Generate presigned download URL
- Delete object from MinIO

**Implementation Details**:
```typescript
// Uses minio npm package for S3-compatible storage
// The service creates/uses a bucket named `opendesk-files` and ensures it exists on module init.
const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});
// onModuleInit will call `bucketExists` and `makeBucket` if needed.
```

#### 5. Prisma Module 🗄️

**Purpose**: Database ORM and connection management

**Files**:
- `prisma.service.ts` — Prisma Client singleton instance

**Usage**:
```typescript
// Inject into any NestJS service
constructor(private prisma: PrismaService) {}

// Query database
const user = await this.prisma.user.findUnique({ 
  where: { email } 
});
```

### Dependency Flow

```
┌──────────────────────────┐
│   AuthController         │
│   (handles /auth/...)    │
└────────────┬─────────────┘
             │ injects
             ↓
┌──────────────────────────┐
│   AuthService            │
│   (business logic)       │
└────────────┬─────────────┘
             │ injects
             ↓
┌──────────────────────────┐
│   PrismaService          │
│   (DB access)            │
└──────────────────────────┘
```

## Frontend Architecture (Next.js)

### Page Structure

OpenDesk uses **Next.js App Router** with file-based routing:

```
src/app/
├── page.tsx              # Landing page (/)
├── login/
│   └── page.tsx         # Login page (/login)
├── register/
│   └── page.tsx         # Registration page (/register)
├── (dashboard)/         # Protected route group
│   ├── layout.tsx       # Shared dashboard layout
│   ├── docs/
│   │   ├── page.tsx     # Docs list page (/docs)
│   │   └── [id]/
│   │       └── page.tsx # Single doc editor (/docs/[id])
│   └── drive/
│       └── page.tsx     # Drive/folder view (/drive)
├── globals.css          # Global styles
└── layout.tsx           # Root layout
```

### Component Structure

**Key Components**:

1. **Editor.tsx** — TipTap rich-text editor
   - Props: `content`, `onChange`, `editable`
   - Uses: `@tiptap/core`, `@tiptap/react`, `@tiptap/extension-*`

2. **EditorToolbar.tsx** — Formatting toolbar for Editor
   - Props: `editor` (TipTap editor instance)
   - Buttons: Bold, Italic, Heading, Link, etc.

3. **Sidebar.tsx** — Navigation & folder tree
   - Props: `folders`, `onFolderSelect`
   - Displays: User folders, nested hierarchy

4. **Topbar.tsx** — Header with user menu
   - User info, logout button, theme toggle

### Context API

**AuthContext** — Global authentication state
```typescript
interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login(email, password): Promise<void>;
  register(email, password): Promise<void>;
  logout(): void;
}
```

**ThemeContext** — Dark/light mode
```typescript
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme(): void;
}
```

### API Integration

**Pattern**: Services for API calls
```typescript
// src/services/api.ts
export const api = {
  auth: {
    register(email, password),
    login(email, password),
  },
  docs: {
    create(title, folderId?),
    fetch(id),
    update(id, content),
    delete(id),
  },
  drive: {
    listFolders(),
    createFolder(name),
    listContents(folderId),
  },
};
```

## Database Design

### Entity Relationship Diagram

```
┌─────────────────────┐
│       User          │
├─────────────────────┤
│ id (PK)             │
│ email (UNIQUE)      │
│ password            │
│ isAdmin             │
│ createdAt           │
│ updatedAt           │
│ updatedAt           │
└──────┬──────┬───────┘
       │      │
       │      ├─────────────────────┐
       │      │                     │
       ├──────┴──────┐    ┌─────────▼────────┐
       │             │    │                  │
   1:N │         1:N │    │                  │
       │             │    │                  │
┌──────▼───────┐  ┌──────▼─────┐    ┌───────▼───────┐
│   Folder     │  │     File    │    │   Document    │
├──────────────┤  ├─────────────┤    ├───────────────┤
│ id (PK)      │  │ id (PK)     │    │ id (PK)       │
│ name         │  │ name        │    │ title         │
│ parentId (FK)│◄─┤ folderId(FK)│    │ content       │
│ ownerId (FK) │  │ ownerId (FK)│    │ folderId (FK) │
│ createdAt    │  │ key (MinIO) │    │ settings      │
│ updatedAt    │  │ mimeType    │    │ ownerId (FK)  │
└──────────────┘  │ size        │    │ createdAt     │
      │           │ createdAt   │    │ updatedAt     │
      │           └─────────────┘    └───────────────┘
      │                   │                  │
      └───────────────────┼──────────────────┘
       Self-referencing   │
       (hierarchy)        │
              Owned by User (ownerId)
```

### Key Design Decisions

1. **Soft Hierarchies**
   - Folders use `parentId` for tree structure
   - Documents & files use `folderId` to place in folders
   - Supports: root-level docs, folders within folders, files within folders

2. **Ownership Model**
   - Every resource has `ownerId` (User.id)
   - Enforces data isolation per user
   - Simple access control (owner-only)

3. **JSON Fields**
   - `Document.content` — TipTap JSON format
   - `Document.settings` — User preferences (fontSize, theme, fontFamily)
   - `Folder.metadata` (future) — Custom folder properties

4. **MinIO Integration**
   - `File.key` stores MinIO object key
   - `File.mimeType` and `File.size` for metadata
   - Decouples file metadata (DB) from binary storage (MinIO)

## API Design

### RESTful Conventions

| Resource | Method | Endpoint | Purpose |
|----------|--------|----------|---------|
| Auth | POST | `/auth/register` | User registration |
| Auth | POST | `/auth/login` | User login |
| Docs | POST | `/docs` | Create document |
| Docs | GET | `/docs` | List documents |
| Docs | GET | `/docs/:id` | Fetch document |
| Docs | PATCH | `/docs/:id` | Update document |
| Docs | DELETE | `/docs/:id` | Delete document |
| Drive | POST | `/drive/folders` | Create folder |
| Drive | GET | `/drive/list` | List folder contents |
| Drive | POST | `/drive/upload` | Upload file |
| Drive | GET | `/drive/download/:id` | Download file |

### Request/Response Format

**All endpoints return JSON:**

```typescript
// Success (200 OK)
{
  "id": "uuid",
  "title": "Document Title",
  "content": { /* TipTap JSON */ },
  "createdAt": "2025-12-26T00:00:00Z"
}

// Error (4xx/5xx)
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

**Authentication**: Bearer token in Authorization header
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## Authentication Flow

### Registration Flow

```
1. Frontend: POST /auth/register { email, password }
2. Backend:
   a. Validate email (required, valid format)
   b. Validate password (required, min 8 chars)
   c. Hash password with bcrypt
   d. Create User record
   e. Return { email, id }
3. Frontend: Store credentials, redirect to login
```

### Login Flow

```
1. Frontend: POST /auth/login { email, password }
2. Backend:
   a. Find User by email
   b. Verify password with bcrypt
   c. Generate JWT token (HS256, 24h expiry default)
   d. Return { access_token, user: { id, email } }
3. Frontend: Store token in localStorage/httpOnly cookie
4. Frontend: Send Bearer token on all subsequent API requests
```

### Protected Routes (JWT Validation)

```
1. Frontend: Attach Bearer token: Authorization: Bearer <token>
2. Backend (JWT Guard):
   a. Extract token from Authorization header
   b. Verify signature with JWT_SECRET
   c. Decode payload → extract user.id
   d. Attach req.user = { id, email, ... }
   e. Continue to route handler
3. Service: Access user via req.user.id
```

## File Storage Architecture

### MinIO (S3-Compatible Object Storage)

**Purpose**: Store document attachments, file uploads outside of database

**Key Concepts**:
- **Bucket**: Logical container (like a filesystem)
- **Object**: Binary file with metadata
- **Key**: Path-like identifier (e.g., `users/uuid/files/filename`)

**Upload Flow**:

```
1. Frontend: POST /drive/upload { file, folderId? }
2. Backend:
   a. Validate user authorization
   b. Generate unique key: users/{userId}/files/{uuid}-{filename}
   c. Upload to MinIO: minioClient.putObject(bucket, key, file)
   d. Create File record: name, mimeType, size, key, folderId, ownerId
   e. Return File { id, key, url }
3. Frontend: Display file in Drive, allow download
```

**Download Flow**:

```
1. Frontend: GET /drive/download/{fileId}
2. Backend:
   a. Find File record (validate user owns it)
   b. Generate presigned URL: minioClient.presignedGetObject(bucket, key)
   c. Return presigned URL (valid for 24h)
3. Frontend: Redirect to presigned URL for download
```

## Deployment Architecture

### Docker Compose Services

```yaml
services:
  postgres:
    Image: postgres:15-alpine
    Port: 5432 (internal) → 5432 (host)
    Volumes: postgres_data:/var/lib/postgresql/data
    Env: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB

  minio:
    Image: minio/minio
    Port: 9000 (API) → 9000 (host)
    Port: 9001 (console) → 9001 (host)
    Volumes: minio_data:/data
    Env: MINIO_ROOT_USER, MINIO_ROOT_PASSWORD

  api:
    Build: apps/api/Dockerfile
    Port: 3001 → 3001
    Depends: postgres, minio
    Env: DATABASE_URL, JWT_SECRET, MINIO_*

  web:
    Build: apps/web/Dockerfile
    Port: 3000 → 3000
    Depends: api
    Env: NEXT_PUBLIC_API_URL
```

### Container Startup Order

```
1. postgres (no dependencies)
2. minio (no dependencies)
3. api (depends_on: postgres, minio)
   → Runs Prisma migrations
   → Waits for DB connectivity
4. web (depends_on: api)
   → Builds Next.js app
   → Connects to API
```

### Environment Variables in Docker

Each service receives environment variables:

```bash
# Docker Compose passes from compose.yml
services:
  api:
    environment:
      - DATABASE_URL=postgresql://...@postgres:5432/opendesk
      - MINIO_ENDPOINT=minio          # Internal service name (Docker DNS)
      - MINIO_PUBLIC_ENDPOINT=http://localhost:9000  # External access
```

**Key Difference**: Internal services use service names (e.g., `postgres`, `minio`), while public endpoints use localhost/domain.

## Design Patterns

### 1. Dependency Injection (NestJS)

```typescript
@Injectable()
class DocsService {
  constructor(private prisma: PrismaService) {}
}

@Controller('/docs')
class DocsController {
  constructor(private docs: DocsService) {}
}
```

### 2. Guards (Route Protection)

```typescript
@UseGuards(JwtAuthGuard)
@Get('/protected')
protectedRoute(@Request() req) {
  // req.user populated by guard
}
```

### 3. Context API (Frontend State)

```typescript
export function useAuth() {
  return useContext(AuthContext);
}

// Usage in component
const { user, logout } = useAuth();
```

### 4. DTO (Data Transfer Objects)

```typescript
export class CreateDocDto {
  @IsString() title: string;
  @IsOptional() @IsUUID() folderId?: string;
}
```

---

**Next**: See [API Reference](API.md) for detailed endpoint documentation.
