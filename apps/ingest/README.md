# Ingest Service

A high-performance Hono-based ingest service for the Core Directory Engine. Handles event intake, Stripe webhooks, crawl submissions, and CRON-based metric rollups.

## 🚀 Features

- **Event Intake**: Processes application events (views, copies, saves, forks, etc.)
- **Stripe Webhooks**: Handles donation processing and status updates
- **Crawl Intake**: Ingests content from external partners/curators
- **CRON Rollups**: Computes daily metrics and leaderboard snapshots
- **Security**: Header-based authentication with HMAC-like shared secrets
- **Rate Limiting**: In-memory token bucket rate limiting
- **Idempotency**: Prevents duplicate processing of events and webhooks
- **Audit Logging**: Comprehensive logging of all sensitive operations

## 🏗️ Architecture

```
├── src/
│   ├── env.ts              # Environment variable validation
│   ├── logger.ts           # Simple pino-like logger
│   ├── prisma.ts           # Prisma client export
│   ├── index.ts            # Main Hono app bootstrap
│   ├── middleware/         # Reusable middleware
│   │   ├── auth.ts         # Header-based authentication
│   │   ├── ratelimit.ts    # In-memory rate limiting
│   │   └── error.ts        # Centralized error handling
│   ├── schemas/            # Zod validation schemas
│   │   ├── common.ts       # Shared schemas (IDs, enums)
│   │   ├── events.ts       # Event intake schemas
│   │   ├── crawl.ts        # Crawl item schemas
│   │   └── rollup.ts       # CRON rollup schemas
│   ├── services/           # Business logic
│   │   ├── events.ts       # Event processing & deduplication
│   │   ├── donations.ts    # Stripe webhook handling
│   │   ├── crawl.ts        # Crawl item upserting
│   │   ├── rollup.ts       # Daily metrics & leaderboards
│   │   └── notifications.ts # Notification fanout (placeholder)
│   └── routes/             # API route handlers
│       ├── health.ts       # Health check endpoint
│       ├── ingest-events.ts # Event intake endpoint
│       ├── stripe-webhook.ts # Stripe webhook handler
│       ├── ingest-crawl.ts # Crawl intake endpoint
│       └── cron-rollup.ts  # CRON job endpoints
```

## 🔧 Environment Variables

Copy `env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL="postgresql://app:app@localhost:5432/app"

# Security Tokens
CRON_SECRET="your-secure-cron-secret-here"
INGEST_APP_TOKEN="your-secure-app-token-here"

# Stripe
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key_here"
STRIPE_WEBHOOK_SECRET="whsec_your_stripe_webhook_secret_here"

# Logging
LOG_LEVEL="info" # debug, info, warn, error

# Server Port
PORT=8787
```

## 🚦 API Endpoints

### Health Check

```http
GET /health
```

Returns service status and timestamp.

### Event Intake

```http
POST /ingest/events
Headers: x-app-token: <INGEST_APP_TOKEN>
Content-Type: application/json

{
  "events": [
    {
      "type": "VIEW",
      "ruleId": "cuid...",
      "userId": "cuid...", // optional for anonymous
      "ts": "2024-01-01T00:00:00Z", // optional, defaults to now
      "idempotencyKey": "unique-key" // optional
    }
  ]
}
```

### Stripe Webhooks

```http
POST /ingest/stripe/webhook
Headers: stripe-signature: <webhook_signature>
Content-Type: application/json

# Stripe webhook payload (handled automatically)
```

### Crawl Intake

```http
POST /ingest/crawl
Headers: x-app-token: <INGEST_APP_TOKEN>
Content-Type: application/json

{
  "sourceId": "cuid...",
  "items": [
    {
      "externalId": "partner-123",
      "url": "https://example.com/rule",
      "title": "Example Rule",
      "summary": "Optional summary",
      "raw": {} // optional JSON blob
    }
  ]
}
```

### CRON Rollups

```http
POST /cron/rollup
Headers: x-cron-secret: <CRON_SECRET>
Content-Type: application/json

{
  "date": "2024-01-01T00:00:00Z", // optional, defaults to today
  "dryRun": false, // optional, defaults to false
  "daysToProcess": 7 // optional, defaults to 7, max 30
}
```

```http
POST /cron/rebuild-search
Headers: x-cron-secret: <CRON_SECRET>
```

## 🔒 Security

### Authentication

- **App Token**: Use `x-app-token` header for event and crawl endpoints
- **CRON Secret**: Use `x-cron-secret` header for CRON endpoints
- **Stripe Webhooks**: Verified using Stripe signature validation

### Rate Limiting

- **Events**: 60 requests/minute per IP
- **Crawl**: 30 requests/minute per IP
- **CRON**: No rate limiting (internal only)

### Anti-Gaming Measures

- **VIEW Events**: Deduplicated per IP+Rule within 10-minute window
- **Metrics**: Capped at 5 views per IP per rule per day in rollups

## 📊 Metrics & Rollups

The service computes daily aggregations:

### RuleMetricDaily

- Views, copies, saves, forks, votes per rule per day
- Trending score with exponential decay
- Anti-gaming caps and IP deduplication

### AuthorMetricDaily

- Aggregated metrics per author per day
- Donation counts and amounts (from Stripe webhooks)

### LeaderboardSnapshot

- Daily, weekly, monthly, and all-time leaderboards
- Separate rule and author rankings
- Global scope (TAG and MODEL scopes planned)

## 🏃‍♂️ Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Type checking
pnpm typecheck

# Linting & formatting
pnpm lint
pnpm format
```

## 🐳 Docker

The service includes a multi-stage Dockerfile optimized for production:

```bash
# Build image
docker build -t ingest-service .

# Run container
docker run -p 8787:8787 --env-file .env ingest-service
```

## 🔍 Monitoring & Debugging

### Logging

The service uses structured logging with configurable levels:

- `debug`: Detailed operation logs
- `info`: General operation logs (default)
- `warn`: Warning conditions
- `error`: Error conditions

### Health Checks

The `/health` endpoint provides basic service status and can be used for:

- Docker health checks
- Load balancer health probes
- Monitoring system checks

### Audit Trail

All sensitive operations are logged to the `AuditLog` table:

- Event processing
- Stripe webhook handling
- Crawl item ingestion
- CRON rollup execution

## 🚨 Error Handling

The service provides comprehensive error handling:

- **Zod Validation**: Input validation with detailed error messages
- **Stripe Webhooks**: Idempotent processing with signature verification
- **Database Errors**: Transaction rollbacks and retry logic
- **Rate Limiting**: 429 responses with appropriate headers

## 🔄 Idempotency

### Events

- Optional `idempotencyKey` prevents duplicate event processing
- VIEW events deduplicated by IP+Rule within time window

### Webhooks

- Stripe events checked against `AuditLog` to prevent reprocessing
- Database upserts use `skipDuplicates` for natural idempotency

## 📈 Performance

### Optimizations

- **Batch Processing**: Events processed in batches with `createMany`
- **In-Memory Caching**: VIEW deduplication and rate limiting
- **Database Indexes**: Leverages existing indexes from `packages/db`
- **Minimal Dependencies**: Lightweight Hono framework

### Scaling Considerations

- **Stateless Design**: Can be horizontally scaled
- **Database Bottlenecks**: Consider read replicas for heavy rollup queries
- **Rate Limiting**: In-memory limits don't scale across instances (consider Redis)

## 🛠️ Troubleshooting

### Common Issues

**Environment Variables**

```bash
# Verify all required env vars are set
node -e "require('./src/env.ts')"
```

**Database Connection**

```bash
# Test Prisma connection
npx prisma db pull --schema=../db/prisma/schema.prisma
```

**Stripe Webhooks**

```bash
# Test webhook signature locally
stripe listen --forward-to localhost:8787/ingest/stripe/webhook
```

### Debug Mode

Set `LOG_LEVEL=debug` for verbose logging:

```bash
LOG_LEVEL=debug pnpm dev
```

## 📚 Related Documentation

- [Core Database Schema](../db/README.md)
- [tRPC API Layer](../trpc/README.md)
- [Web Application](../web/README.md)
- [Docker Setup](../../README.md#docker)
