# OpenDesk

[![License: UNLICENSED](https://img.shields.io/badge/license-UNLICENSED-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-%23323232?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/node-v20%2B-green?logo=node.js&logoColor=white)](https://nodejs.org/)

## Self-Hosted, Open-Source Document & File Management Ecosystem

**OpenDesk** is a privacy-first, self-hosted alternative to Google Drive. Deploy it on your own infrastructure and take complete control of your documents and files.

### 🎯 What is OpenDesk?

OpenDesk is a **containerized, full-stack ecosystem** combining:
- **Rich-text document editor** powered by TipTap for collaborative note-taking
- **Folder-based file organization** (drive) with S3-compatible object storage
- **User authentication** with JWT-based security
- **Extensible architecture** for custom integrations and plugins

Deploy everything with a single command using Docker Compose—no vendor lock-in, no data escaping your infrastructure.

### ✨ Key Features

- 🔒 **Self-Hosted**: Run entirely on your servers—your data never leaves your infrastructure
- 🔐 **Privacy-First**: Complete control over user data, no third-party analytics or tracking
- 📖 **Open-Source**: Full source code transparency, community-driven development
- 🐳 **Docker-Native**: One-command deployment with Docker Compose
- 📝 **Rich Document Editor**: TipTap-powered editor with formatting, links, and placeholder support
- 📁 **Drive Management**: Hierarchical folder structure with file uploads and organization
- 🔐 **Secure Auth**: JWT-based authentication with bcrypt password hashing
- 🎯 **Modular**: Clean NestJS architecture designed for extensibility

### 🚀 Quick Start

#### Prerequisites

- **Docker & Docker Compose** (v2.0+)
- **Node.js** (v20+) for local development (optional for Docker-only setup)

#### Deploy with Docker Compose

```bash
# Clone the repository
git clone https://github.com/yourusername/opendesk.git
cd opendesk

# Run the setup script (handles port conflicts, migrations, and service startup)
./scripts/up.sh

# Access the application
# Frontend:  http://localhost:3000
# Backend:   http://localhost:3001
# MinIO:     http://localhost:9001 (default: minioadmin/minioadmin)
```

The `up.sh` script automatically:
- ✅ Kills any processes blocking required ports (3000, 3001, 5432, 9000, 9001)
- ✅ Builds Docker images for API and web services
- ✅ Starts PostgreSQL, MinIO, API, and web containers
- ✅ Runs Prisma migrations to initialize the database schema
- ✅ Runs a smoke test to verify all services are operational

#### Local Development (without Docker)

```bash
# Install dependencies (monorepo with workspaces)
npm install

# Copy environment variables
cp infra/docker/env.example .env.local

# Start development servers
npm run dev
# API will run on http://localhost:3001
# Web will run on http://localhost:3000
```

### 🏗️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15+ | React SSR, modern UI framework |
| **Backend** | NestJS | Type-safe REST API framework |
| **Database** | PostgreSQL 15 | Relational data storage |
| **File Storage** | MinIO | S3-compatible object storage |
| **Containerization** | Docker & Docker Compose | Simplified deployment |
| **Monorepo** | Turbo | Workspace management & build optimization |

### 📋 System Architecture

```
opendesk/
├── apps/
│   ├── api/                    # NestJS REST API
│   │   ├── src/
│   │   │   ├── auth/          # JWT authentication
│   │   │   ├── docs/          # Document CRUD endpoints
│   │   │   ├── drive/         # Folder & file management
│   │   │   └── storage/       # MinIO file uploads/downloads
│   │   ├── prisma/            # Database schema & migrations
│   │   └── Dockerfile
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/           # Next.js app router
│       │   └── components/    # React components
│       └── Dockerfile
├── infra/
│   └── docker/
│       ├── compose.yml        # Docker Compose orchestration
│       └── env.example        # Environment variable template
├── packages/
│   └── shared/                # Shared TypeScript types (future)
└── scripts/
    └── up.sh                  # Automated setup & deployment
```

### 🔐 Authentication & Security

- **JWT Tokens**: Stateless session management via Bearer tokens
- **Password Hashing**: bcrypt with salt rounds for secure password storage
- **CORS Enabled**: Cross-origin requests supported for browser clients
- **Environment Variables**: Sensitive credentials (JWT_SECRET, DB_PASSWORD) must be set via `.env`

**Admin creation:** The project does not seed a default admin. The first user that registers will be granted admin privileges and the registration response will include a warning. This avoids shipping default credentials—rotate and secure admin accounts after initial setup.

### 📚 Documentation

- **[Setup Guide](docs/SETUP.md)** — Installation, environment configuration, and local development
- **[Architecture & Design](docs/ARCHITECTURE.md)** — System design, module overview, database schema
- **[API Reference](docs/API.md)** — Endpoint documentation with examples
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** — Common issues and solutions

### 🗄️ Database Schema

| Table | Purpose |
|-------|---------|
| `users` | User accounts with email & hashed passwords |
| `folders` | Hierarchical folder structure with parent/child relationships |
| `files` | File metadata with MinIO object key references |
| `documents` | Rich-text documents with TipTap JSON content and settings |

Each resource is owned by a user (`ownerId`) and supports soft hierarchies through `folderId`.

### 📝 Environment Variables

Create a `.env` file or set these environment variables:

```bash
# Database (PostgreSQL)
DATABASE_URL=postgresql://opendesk:opendesk@localhost:5432/opendesk
POSTGRES_USER=opendesk
POSTGRES_PASSWORD=opendesk
POSTGRES_DB=opendesk

# Authentication
JWT_SECRET=your-secret-key-change-this

# File Storage (MinIO)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_PUBLIC_ENDPOINT=http://localhost:9000

# Web Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 🔄 Available Commands

#### Monorepo Commands

```bash
npm run dev      # Start all services in development mode
npm run build    # Build all applications
npm run lint     # Lint all packages
```

#### Docker Commands

```bash
./scripts/up.sh                                  # Full setup & startup
docker compose -f infra/docker/compose.yml ps   # View running containers
docker logs -f opendesk-api                      # Stream API logs
docker logs -f opendesk-web                      # Stream web logs
docker compose -f infra/docker/compose.yml down  # Stop all services
```

#### Database Commands (API folder)

```bash
npx prisma migrate dev --name <migration-name>   # Create a new migration
npx prisma db push                               # Apply migrations
npx prisma studio                                # Open Prisma Studio GUI
```

### 🧪 Testing

The `up.sh` script includes a **smoke test** to verify all services are operational:

```bash
./scripts/up.sh --smoke
```

This test:
1. Registers a new user
2. Logs in to receive a JWT token
3. Creates a folder in the drive
4. Creates a document in that folder
5. Lists the folder contents and verifies the document
6. Fetches the document to confirm retrieval

### 🛠️ Development Workflow

1. **Backend Changes** → Changes in `apps/api/src` auto-reload via NestJS watch mode
2. **Frontend Changes** → Changes in `apps/web/src` auto-reload via Next.js hot module replacement
3. **Database Schema Changes** → Create migrations in `apps/api/prisma`, then run `npx prisma migrate dev`
4. **Docker Deployment** → All changes automatically picked up on next `./scripts/up.sh` build

### 🚦 Troubleshooting

#### Port Conflicts
The `up.sh` script automatically handles port conflicts for ports 3000, 3001, 5432, 9000, and 9001. If you see port-in-use errors:
```bash
# The script will attempt to kill conflicting processes
# If manual intervention needed, identify and kill the process:
lsof -i :3000
kill -9 <PID>
```

#### Database Connection Errors
```bash
# Check if PostgreSQL is running
docker logs -f opendesk-postgres

# Verify DATABASE_URL is correct
echo $DATABASE_URL

# Manually trigger migrations
cd apps/api && npx prisma migrate deploy
```

#### MinIO Console Access
- URL: `http://localhost:9001`
- Default credentials: `minioadmin` / `minioadmin`
- ⚠️ Change these in production!

#### API Not Responding
```bash
# Check if API container is running
docker ps | grep opendesk-api

# View API logs
docker logs -f opendesk-api

# Verify API is listening on port 3001
curl http://localhost:3001/health
```

### 🤝 Contributing

We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit changes with clear messages
4. Submit a pull request

See [Contributing Guidelines](CONTRIBUTING.md) for more details.

### 📄 License

This project is licensed under the [UNLICENSED](LICENSE) license. See LICENSE file for details.

### 🎯 Roadmap

- [ ] Real-time collaborative document editing (WebSocket support)
- [ ] Document versioning and revision history
- [ ] Document sharing and permissions management
- [ ] Team workspaces and collaboration
- [ ] Mobile apps (iOS/Android)
- [ ] End-to-end encryption for sensitive documents
- [ ] Advanced search and full-text indexing
- [ ] Activity audit logs

### 📞 Support & Community

- **Issues**: [GitHub Issues](https://github.com/yourusername/opendesk/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/opendesk/discussions)
- **Email**: support@example.com

---

**Ready to take control of your documents?** Start with [Setup Guide](docs/SETUP.md) →
