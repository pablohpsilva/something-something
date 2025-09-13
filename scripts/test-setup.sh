#!/bin/bash

# Test setup script for CI/CD and local development

set -e

echo "🧪 Setting up test environment..."

# Check if we're in CI
if [ "$CI" = "true" ]; then
  echo "📦 Installing dependencies..."
  pnpm install --frozen-lockfile
else
  echo "📦 Installing dependencies..."
  pnpm install
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
pnpm db:generate

# Check if database is available
if [ -n "$DATABASE_URL" ]; then
  echo "🗄️ Setting up test database..."
  
  # Push schema to database
  pnpm db:push
  
  # Seed database if not in CI or if explicitly requested
  if [ "$CI" != "true" ] || [ "$SEED_DB" = "true" ]; then
    echo "🌱 Seeding database..."
    pnpm db:seed
  fi
else
  echo "⚠️ No DATABASE_URL provided, skipping database setup"
fi

# Install Playwright browsers if running E2E tests
if [ "$RUN_E2E" = "true" ] || [ "$1" = "e2e" ]; then
  echo "🎭 Installing Playwright browsers..."
  pnpm exec playwright install --with-deps
fi

echo "✅ Test environment ready!"
