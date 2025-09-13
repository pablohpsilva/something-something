# Testing Guide

This document outlines the testing strategy and setup for the Something Something platform.

## Testing Stack

- **Unit Tests**: [Vitest](https://vitest.dev/) - Fast unit tests for pure logic
- **Integration Tests**: Vitest with real database - Test tRPC routers and services
- **E2E Tests**: [Playwright](https://playwright.dev/) - Full browser automation tests
- **Linting**: [Biome](https://biomejs.dev/) - Fast linting and formatting
- **CI/CD**: GitHub Actions with PostgreSQL service

## Quick Start

```bash
# Install dependencies
pnpm install

# Setup git hooks
pnpm prepare

# Run all tests
pnpm test

# Run specific test types
pnpm test:unit        # Unit tests with coverage
pnpm test:integration # Integration tests with database
pnpm test:e2e         # End-to-end tests with Playwright

# Development
pnpm test:watch       # Watch mode for unit tests
pnpm test:e2e:ui      # Playwright UI mode
```

## Test Structure

```
├── test/                          # Test configuration and setup
│   ├── setup.ts                   # Unit test setup
│   └── integration-setup.ts       # Integration test setup
├── e2e/                          # End-to-end tests
│   ├── smoke.spec.ts             # Basic smoke tests
│   ├── auth.setup.ts             # Authentication setup
│   └── helpers/                  # Test helpers and utilities
├── packages/*/src/**/__tests__/   # Unit tests (co-located)
└── packages/*/src/**/*.integration.test.ts  # Integration tests
```

## Unit Tests

Unit tests focus on pure logic and isolated functions:

- Badge awarding logic
- Trending score calculations
- Rate limiting algorithms
- Utility functions

```typescript
// Example: packages/utils/src/__tests__/trending.test.ts
import { calculateTrendingScore } from "../trending";

test("should calculate trending score correctly", () => {
  const metrics = {
    views: 100,
    votes: 10,
    comments: 5,
    // ...
  };

  const score = calculateTrendingScore(metrics);
  expect(score).toBeGreaterThan(0);
});
```

## Integration Tests

Integration tests use a real PostgreSQL database to test:

- tRPC router functionality
- Database operations
- Service integrations

```typescript
// Example: packages/trpc/src/routers/__tests__/rules.integration.test.ts
import { createCallerFactory } from "@trpc/server";
import { appRouter } from "../index";

test("should create rule successfully", async () => {
  const caller = createCaller(appRouter);
  const result = await caller.rules.create({
    title: "Test Rule",
    // ...
  });

  expect(result.id).toBeDefined();
});
```

## E2E Tests

End-to-end tests simulate real user workflows:

- Complete rule submission flow
- User interactions (voting, commenting)
- Metrics tracking
- Error handling

```typescript
// Example: e2e/smoke.spec.ts
test("complete rule submission flow", async ({ page }) => {
  await page.goto("/rules/new");
  await page.fill('input[name="title"]', "E2E Test Rule");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/.*\/rules\/.*/);
});
```

## Database Setup

### For Integration Tests

Integration tests use a dedicated test database:

```bash
# Set environment variable
export DATABASE_URL="postgres://test:test@localhost:5432/test_db"

# Run setup script
./scripts/test-setup.sh
```

### Test Data Management

- Each test gets a clean database state
- Use `test/integration-setup.ts` for cleanup
- Seed data is created per test as needed

## CI/CD Pipeline

The GitHub Actions workflow runs:

1. **Lint & Typecheck** - Code quality checks
2. **Unit Tests** - Fast isolated tests
3. **Integration Tests** - Database-backed tests
4. **E2E Tests** - Full browser tests
5. **Build** - Verify production builds

### Environment Variables

Required for CI:

```bash
DATABASE_URL=postgres://test:test@localhost:5432/test_db
CLERK_SECRET_KEY=sk_test_placeholder
STRIPE_SECRET_KEY=sk_test_placeholder
# ... other test credentials
```

## Pre-commit Hooks

Husky runs these checks before each commit:

- **Biome lint** - Code style and error checking
- **Biome format** - Automatic code formatting
- **Prisma format** - Schema formatting

```bash
# Setup hooks (runs automatically after pnpm install)
pnpm prepare

# Manual formatting
pnpm format
pnpm lint
```

## Coverage Reports

Unit tests generate coverage reports:

```bash
pnpm test:unit  # Generates coverage/
```

Coverage is uploaded to Codecov in CI.

## Debugging Tests

### Unit Tests

```bash
# Run specific test file
pnpm vitest packages/utils/src/__tests__/trending.test.ts

# Debug mode
pnpm vitest --inspect-brk
```

### Integration Tests

```bash
# Run with database logs
DEBUG=prisma:* pnpm test:integration

# Run specific test
pnpm vitest --config vitest.integration.config.ts rules.integration.test.ts
```

### E2E Tests

```bash
# Run in headed mode
pnpm test:e2e --headed

# Debug with UI
pnpm test:e2e:ui

# Run specific test
pnpm exec playwright test smoke.spec.ts
```

## Best Practices

### Unit Tests

- Test pure functions and logic
- Mock external dependencies
- Use descriptive test names
- Test edge cases and error conditions

### Integration Tests

- Test real database interactions
- Clean up after each test
- Use realistic test data
- Test error scenarios

### E2E Tests

- Test critical user journeys
- Use page object pattern for complex flows
- Handle flaky tests with retries
- Test across different browsers

### General

- Write tests before fixing bugs
- Keep tests simple and focused
- Use factories for test data
- Document complex test scenarios

## Troubleshooting

### Common Issues

**Database connection errors:**

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Reset test database
dropdb test_db && createdb test_db
```

**Playwright browser issues:**

```bash
# Reinstall browsers
pnpm exec playwright install --with-deps
```

**Import/module errors:**

```bash
# Clear caches
pnpm clean
rm -rf node_modules/.cache
```

### Performance

- Unit tests should run in < 10ms each
- Integration tests should run in < 100ms each
- E2E tests should run in < 30s each
- Use `test.concurrent()` for parallel execution

## Contributing

When adding new features:

1. Write unit tests for pure logic
2. Add integration tests for API endpoints
3. Include E2E tests for user-facing features
4. Update this documentation if needed

All tests must pass before merging to main.
