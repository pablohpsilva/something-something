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

- **Node.js**: v20.18.0 or higher
- **pnpm**: v9.0.0 or higher
- **PostgreSQL**: Running instance (local or remote)

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
```

## 🏃‍♂️ Development Workflow

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
