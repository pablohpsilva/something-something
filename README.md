# Something Something

A modern, full-stack monorepo built with the latest technologies and best practices.

## 🏗️ Architecture

This monorepo uses **pnpm workspaces** and **Turbo** for efficient development and builds. It includes:

### Apps

- **`apps/web`** - Next.js 15 frontend with App Router, TypeScript, and Tailwind CSS
- **`apps/ingest`** - Hono API for data ingestion, optimized for Cloudflare Workers

### Packages

- **`packages/db`** - Prisma schema and database client
- **`packages/trpc`** - Type-safe API layer with tRPC routers
- **`packages/ui`** - Shared UI components built with shadcn/ui and Radix
- **`packages/utils`** - Utility functions for rate limiting, IDs, validation, etc.
- **`packages/config`** - Shared configuration for TypeScript, Tailwind, and Biome

### Tooling

- **`tooling/scripts`** - Database seeding, cron jobs, migrations, and backup scripts

## 🚀 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **API**: Hono (Cloudflare Workers ready)
- **Database**: PostgreSQL with Prisma ORM
- **Type Safety**: TypeScript + tRPC
- **Styling**: Tailwind CSS v4.1
- **UI Components**: shadcn/ui + Radix UI
- **Linting/Formatting**: Biome
- **Package Manager**: pnpm
- **Build System**: Turbo
- **Authentication**: Clerk (configured)
- **Payments**: Stripe (configured)

## 📋 Prerequisites

### Local Development

- **Node.js**: v20.18.0 or higher
- **pnpm**: v9.0.0 or higher
- **PostgreSQL**: Running instance (local or remote)

### Docker Development

- **Docker**: v20.10.0 or higher
- **Docker Compose**: v2.0.0 or higher

## 🛠️ Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd something-something
pnpm install
```

### 2. Environment Variables

Copy the example environment files and fill in your values:

```bash
# Web app
cp apps/web/env.example apps/web/.env.local

# Ingest app
cp apps/ingest/env.example apps/ingest/.env
```

**Required Environment Variables:**

- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `CRON_SECRET` - Secret for cron job authentication

### 3. Database Setup

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database (for development)
pnpm db:push

# Or run migrations (for production)
pnpm db:migrate

# Seed the database with sample data
pnpm db:seed
```

### 4. Start Development

```bash
# Start all apps in development mode
pnpm dev

# Or start individual apps
pnpm web:dev      # Next.js app on http://localhost:3000
pnpm ingest:dev   # Hono API on http://localhost:8787
```

## 🐳 Docker Setup

### Quick Start with Docker

The easiest way to get the entire stack running is with Docker Compose:

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd something-something

# 2. Copy and configure environment variables
cp env.docker.example .env.docker
# Edit .env.docker with your actual values

# 3. Start all services (production-like)
docker-compose up --build

# Or start in detached mode
docker-compose up -d --build
```

This will start:

- **PostgreSQL** database on `localhost:5432`
- **Next.js web app** on `http://localhost:3000`
- **Hono ingest API** on `http://localhost:8787`
- **Automatic database migrations** and seeding

### Development with Docker

For development with hot reloading and code mounting:

```bash
# Start in development mode (uses docker-compose.override.yml automatically)
docker-compose up --build

# Or explicitly specify development profile
docker-compose -f docker-compose.yml -f docker-compose.override.yml up --build
```

Development mode features:

- **Hot reloading** for both web and ingest apps
- **Source code mounting** for instant changes
- **File watching** with polling enabled for Docker
- **Database exposed** on `localhost:5432` for external tools

### Docker Commands

```bash
# Build all images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
docker-compose logs -f web    # Web app logs only
docker-compose logs -f ingest # Ingest API logs only

# Stop services
docker-compose down

# Stop and remove volumes (⚠️ This will delete all data)
docker-compose down -v

# Restart a specific service
docker-compose restart web

# Execute commands in running containers
docker-compose exec web sh
docker-compose exec ingest sh
docker-compose exec db psql -U app -d app

# Run database commands
docker-compose exec web pnpm db:studio
docker-compose exec web pnpm db:seed
```

### Production Deployment

For production deployment, use the base `docker-compose.yml` without the override:

```bash
# Production build and start
docker-compose -f docker-compose.yml up -d --build

# Or disable the override file
mv docker-compose.override.yml docker-compose.override.yml.disabled
docker-compose up -d --build
```

### Docker Architecture

#### Multi-stage Dockerfiles

Both applications use optimized multi-stage builds:

**Web App (`apps/web/Dockerfile`)**:

- `base`: Node.js 20 Alpine with pnpm enabled
- `deps`: Dependency installation with pnpm fetch
- `builder`: Full build with Prisma generation
- `runner`: Minimal production image with Next.js standalone output

**Ingest API (`apps/ingest/Dockerfile`)**:

- `base`: Node.js 20 Alpine with pnpm enabled
- `deps`: Dependency installation with pnpm fetch
- `builder`: TypeScript compilation with tsup
- `runner`: Minimal production image with compiled JavaScript

#### Health Checks

All services include health checks:

- **Database**: `pg_isready` check
- **Web**: HTTP check on `/api/health`
- **Ingest**: HTTP check on `/health`

#### Networking

Services communicate via Docker's internal network:

- Web app → Ingest API: `http://ingest:8787`
- Apps → Database: `postgres://app:app@db:5432/app`

### Troubleshooting Docker

**Build Issues**:

```bash
# Clean build (no cache)
docker-compose build --no-cache

# Remove all containers and images
docker-compose down --rmi all
docker system prune -a
```

**Permission Issues**:

```bash
# Fix file permissions (Linux/macOS)
sudo chown -R $USER:$USER .
```

**Database Issues**:

```bash
# Reset database
docker-compose down -v
docker-compose up -d db
docker-compose up migrate
```

**Development Hot Reload Issues**:

- Ensure `CHOKIDAR_USEPOLLING=1` is set in development
- Check that source code is properly mounted
- Restart the specific service: `docker-compose restart web`

## 📜 Available Scripts

### Root Scripts

```bash
# Development
pnpm dev          # Start all apps in development
pnpm build        # Build all packages and apps
pnpm lint         # Lint all packages
pnpm format       # Format all code with Biome
pnpm typecheck    # Type check all packages
pnpm clean        # Clean all build artifacts

# Database
pnpm db:generate  # Generate Prisma client
pnpm db:push      # Push schema to database
pnpm db:migrate   # Run database migrations
pnpm db:reset     # Reset database
pnpm db:seed      # Seed database with sample data
pnpm db:studio    # Open Prisma Studio

# Scripts
pnpm scripts:cron     # Run cron jobs
pnpm scripts:migrate  # Run data migrations
pnpm scripts:backup   # Create database backup

# Individual Apps
pnpm web:dev      # Start web app
pnpm web:build    # Build web app
pnpm ingest:dev   # Start ingest API
pnpm ingest:deploy # Deploy to Cloudflare Workers

# UI Components
pnpm ui:add       # Add new shadcn/ui components

# Docker Commands
pnpm docker:up           # Start all services with Docker
pnpm docker:up:prod      # Start in production mode
pnpm docker:down         # Stop all services
pnpm docker:down:clean   # Stop and remove volumes
pnpm docker:logs         # View all logs
pnpm docker:build        # Rebuild all images
```

## 🏃‍♂️ Development Workflow

### Docker Development Workflow

```bash
# 1. Start the stack
pnpm docker:up

# 2. Make code changes (hot reload enabled)
# Edit files in apps/web/src or apps/ingest/src

# 3. View logs
pnpm docker:logs

# 4. Access services
# Web: http://localhost:3000
# API: http://localhost:8787
# DB: localhost:5432 (user: app, password: app, database: app)

# 5. Run database operations
docker-compose exec web pnpm db:studio
docker-compose exec web pnpm db:seed

# 6. Stop when done
pnpm docker:down
```

### Adding New UI Components

```bash
# Add a new shadcn/ui component
pnpm ui:add button

# The component will be added to packages/ui/src/components/ui/
# and automatically exported from packages/ui/src/index.ts
```

### Database Changes

```bash
# 1. Modify packages/db/prisma/schema.prisma
# 2. Generate new client
pnpm db:generate

# 3. Push changes (development)
pnpm db:push

# OR create migration (production)
pnpm db:migrate
```

### Adding New Packages

1. Create new directory in `packages/`
2. Add `package.json` with workspace dependencies
3. Update root `pnpm-workspace.yaml` if needed
4. Add to `turbo.json` pipeline if it has build steps

## 🚀 Deployment

### Web App (Vercel)

```bash
# Build and deploy
pnpm web:build
# Deploy to Vercel (configure in Vercel dashboard)
```

### Ingest API (Cloudflare Workers)

```bash
# Deploy to Cloudflare Workers
pnpm ingest:deploy

# Configure environment variables in Cloudflare dashboard
```

### Database (Production)

```bash
# Run migrations
pnpm db:migrate

# Seed production data (if needed)
pnpm db:seed
```

## 📁 Project Structure

```
something-something/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── src/app/         # App Router pages
│   │   ├── src/components/  # App-specific components
│   │   └── package.json
│   └── ingest/              # Hono API
│       ├── src/
│       ├── wrangler.toml    # Cloudflare Workers config
│       └── package.json
├── packages/
│   ├── db/                  # Database layer
│   │   ├── prisma/          # Prisma schema
│   │   └── src/             # Database client
│   ├── trpc/                # API layer
│   │   └── src/routers/     # tRPC routers
│   ├── ui/                  # UI components
│   │   └── src/components/  # shadcn/ui components
│   ├── utils/               # Utility functions
│   │   └── src/             # Rate limiting, IDs, validation
│   └── config/              # Shared configuration
│       ├── tailwind.js      # Tailwind config
│       └── src/             # TypeScript configs
├── tooling/
│   └── scripts/             # Database scripts
│       └── src/             # Seed, cron, migration scripts
├── package.json             # Root package.json
├── pnpm-workspace.yaml      # Workspace configuration
├── turbo.json              # Turbo configuration
├── tsconfig.base.json      # Base TypeScript config
└── biome.json              # Biome configuration
```

## 🔧 Configuration Files

- **`biome.json`** - Code formatting and linting rules
- **`turbo.json`** - Build pipeline configuration
- **`tsconfig.base.json`** - Base TypeScript configuration
- **`pnpm-workspace.yaml`** - Workspace package definitions

## 🧪 Testing

```bash
# Add your testing commands here
# Example:
# pnpm test        # Run all tests
# pnpm test:watch  # Run tests in watch mode
```

## 📊 Monitoring & Maintenance

### Cron Jobs

Set up automated tasks using the cron script:

```bash
# Run maintenance tasks
pnpm scripts:cron

# This includes:
# - Processing unprocessed ingest events
# - Cleaning up old data
# - Generating daily statistics
# - Health checks
```

### Database Backups

```bash
# Create database backup
pnpm scripts:backup

# Backups are stored in ./backups/ directory
# Old backups are automatically cleaned up (keeps 5 most recent)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run linting and type checking: `pnpm lint && pnpm typecheck`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**pnpm install fails**

- Ensure you're using Node.js v20.18.0 or higher
- Clear pnpm cache: `pnpm store prune`

**Database connection issues**

- Check your `DATABASE_URL` in environment files
- Ensure PostgreSQL is running
- Verify database exists and is accessible

**Build failures**

- Run `pnpm clean` to clear build cache
- Ensure all environment variables are set
- Check for TypeScript errors: `pnpm typecheck`

**Prisma issues**

- Regenerate client: `pnpm db:generate`
- Reset database: `pnpm db:reset` (⚠️ This will delete all data)

### Getting Help

- Check the [Issues](https://github.com/your-repo/issues) page
- Review the documentation for each package
- Run `pnpm --help` for pnpm commands
- Run `turbo --help` for Turbo commands

---

Built with ❤️ using modern web technologies.
