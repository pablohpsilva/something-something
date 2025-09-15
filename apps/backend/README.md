# Backend API Server

A Hono-based backend server that hosts the tRPC API for the something-something application.

## Features

- 🔥 **Hono**: Fast, lightweight web framework
- 🚀 **tRPC**: End-to-end typesafe APIs
- 🛡️ **CORS**: Configurable cross-origin resource sharing
- 📊 **Health Check**: Built-in health monitoring endpoint
- 🔧 **TypeScript**: Full TypeScript support
- 🏗️ **Workspace Integration**: Uses shared packages from the monorepo

## Quick Start

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Set up environment:**

   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server:**

   ```bash
   pnpm dev
   ```

4. **Build for production:**
   ```bash
   pnpm build
   pnpm start
   ```

## Endpoints

- **Root**: `GET /` - API information
- **Health**: `GET /health` - Health check
- **tRPC**: `POST /trpc/*` - tRPC API endpoints

## Environment Variables

See `env.example` for all available configuration options.

## Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run linter
- `pnpm typecheck` - Type checking

## Integration

This backend serves the tRPC router from `@repo/trpc` package, providing a centralized API server that can be consumed by:

- Frontend applications
- Mobile applications
- External services
- Third-party integrations

The server automatically handles:

- Authentication context
- Request/response formatting
- Error handling
- Type safety across the API surface
