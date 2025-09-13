# syntax=docker/dockerfile:1

# Base stage with Node.js and pnpm
FROM node:20-alpine AS base
RUN corepack enable
RUN apk add --no-cache libc6-compat
WORKDIR /srv

# Dependencies stage - install dependencies
FROM base AS deps
# Copy package files for dependency installation
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/trpc/package.json ./packages/trpc/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/
COPY tooling/scripts/package.json ./tooling/scripts/

# Fetch dependencies
RUN pnpm fetch

# Builder stage - build the application
FROM base AS builder
# Copy dependency files
COPY --from=deps /srv/node_modules ./node_modules
COPY --from=deps /srv/.pnpm-store ./.pnpm-store

# Copy all source code
COPY . .

# Install all dependencies (using cache from fetch)
RUN pnpm install --frozen-lockfile --offline

# Generate Prisma client
RUN pnpm db:generate

# Build the web application
RUN pnpm --filter @repo/web build

# Production runner stage
FROM node:20-alpine AS runner
WORKDIR /srv

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /srv/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /srv/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /srv/apps/web/public ./apps/web/public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["dumb-init", "node", "apps/web/server.js"]
