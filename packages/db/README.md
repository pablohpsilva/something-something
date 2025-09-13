# @repo/db

Production-grade database layer for the Core Directory Engine built with Prisma and PostgreSQL 16.

## Features

- **Comprehensive Schema**: 25+ models covering users, rules, community features, metrics, and gamification
- **Full-Text Search**: PostgreSQL FTS with ranking and unaccent support
- **Strong Constraints**: Foreign keys, unique constraints, check constraints, and data validation
- **Performance Optimized**: Strategic indexes, partial indexes, and query optimization
- **Audit Trail**: Complete audit logging and soft deletes where appropriate
- **Anti-Gaming**: Event tracking with IP/UA hashing and rate limiting support
- **Type Safety**: Full TypeScript support with generated Prisma client

## Architecture

### Core Models

- **Users & Profiles**: User accounts, author profiles, and verification
- **Content**: Rules, versions, tags, and resource links
- **Community**: Comments, votes, favorites, follows, and watches
- **Metrics**: Events, daily aggregations, and trending calculations
- **Gamification**: Badges, leaderboards, and user achievements
- **Donations**: Stripe integration with payout tracking
- **Moderation**: Claims, audit logs, and content management
- **Search**: Full-text search with PostgreSQL tsvector

### Key Features

- **Soft Deletes**: Rules and comments support soft deletion
- **Versioning**: Complete rule version history with semantic versioning
- **Full-Text Search**: Automatically maintained search index with triggers
- **Metrics Aggregation**: Daily rollups for performance analytics
- **Audit Logging**: Complete change tracking with diff storage

## Setup

### Prerequisites

- **PostgreSQL 16+** with extensions: `pg_trgm`, `unaccent`, `pgcrypto`
- **Node.js 20+**
- **DATABASE_URL** environment variable

### Environment Variables

```bash
# Required
DATABASE_URL="postgresql://username:password@localhost:5432/database"

# Optional (for development)
PRISMA_GENERATE_DATAPROXY="false"
```

### Installation

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed with sample data
pnpm db:seed
```

### Docker Setup

When using with Docker Compose:

```bash
# Start database
docker-compose up -d db

# Wait for database to be ready, then migrate
docker-compose exec web pnpm db:migrate

# Generate client
docker-compose exec web pnpm db:generate

# Seed database
docker-compose exec web pnpm db:seed
```

## Usage

### Basic Client Usage

```typescript
import { prisma, withTransaction } from "@repo/db";

// Basic queries
const users = await prisma.user.findMany({
  include: {
    authorProfile: true,
    rulesCreated: {
      where: { status: "PUBLISHED" },
      take: 10,
    },
  },
});

// Transactions
await withTransaction(async (tx) => {
  const user = await tx.user.create({
    data: {
      /* user data */
    },
  });

  await tx.authorProfile.create({
    data: {
      userId: user.id,
      /* profile data */
    },
  });
});
```

### Full-Text Search

```typescript
import { searchRules, refreshRuleSearch } from "@repo/db";

// Search rules with ranking
const results = await searchRules("debugging javascript", {
  limit: 20,
  contentTypes: ["RULE", "GUIDE"],
  statuses: ["PUBLISHED"],
});

// Refresh search index for a specific rule
await refreshRuleSearch(ruleId);
```

### Trending and Analytics

```typescript
import { getTrendingRules, getRuleStats, updateRuleMetrics } from "@repo/db";

// Get trending rules from last 7 days
const trending = await getTrendingRules(7, 20);

// Get detailed rule statistics
const stats = await getRuleStats(ruleId);

// Update daily metrics
await updateRuleMetrics(ruleId, new Date(), {
  views: 10,
  copies: 2,
  score: 50,
});
```

### User Activity

```typescript
import { getUserActivitySummary } from "@repo/db";

const activity = await getUserActivitySummary(userId);
// Returns: { rulesCreated, commentsCount, votesCount, favoritesCount }
```

## Schema Overview

### Users & Authentication

- `User` - Core user accounts with Clerk integration
- `AuthorProfile` - Extended profiles for content creators

### Content Management

- `Rule` - Main content entities with versioning
- `RuleVersion` - Complete version history with semantic versioning
- `Tag` - Taxonomical organization
- `ResourceLink` - External references and documentation

### Community Features

- `Comment` - Threaded discussions with soft deletes
- `Vote` - Up/down voting on rules and versions
- `Favorite` - User bookmarking system
- `Follow` - Author subscription system
- `Watch` - Rule update notifications

### Metrics & Analytics

- `Event` - Raw activity tracking with anti-gaming measures
- `RuleMetricDaily` - Aggregated daily statistics
- `AuthorMetricDaily` - Author performance metrics

### Gamification

- `Badge` - Achievement system with criteria
- `UserBadge` - User achievement tracking
- `LeaderboardSnapshot` - Historical leaderboard data

### Monetization

- `Donation` - Stripe payment processing
- `PayoutAccount` - Creator payout management

### Moderation

- `Claim` - Authorship claims and disputes
- `AuditLog` - Complete change tracking

### Data Sources

- `Source` - External content sources
- `CrawlItem` - Imported content tracking

### Search

- `RuleSearch` - Full-text search with tsvector

## Database Constraints

### Check Constraints

- Vote values must be -1 or +1
- Donation amounts must be positive
- Currency codes must be 3 characters
- Rule slugs must match pattern `^[a-z0-9-]+$`

### Unique Constraints

- User handles and Clerk IDs
- Rule slugs
- Tag slugs
- Badge slugs
- Composite unique constraints on relationships

### Foreign Key Policies

- **CASCADE**: When parent should cascade delete (tags, metrics)
- **RESTRICT**: When deletion should be prevented (content creators)
- **SET NULL**: When reference should be cleared (optional relationships)

## Indexing Strategy

### Primary Indexes

- All foreign keys automatically indexed by Prisma
- Unique constraints create automatic indexes

### Performance Indexes

- `rules(status, createdAt)` - Rule listing queries
- `events(ruleId, createdAt)` - Activity queries
- `events(type, createdAt)` - Event type filtering
- `rule_metrics_daily(score)` - Trending calculations

### Partial Indexes

- `events(type, createdAt) WHERE type='VIEW' AND createdAt > now() - interval '30 days'`

### Full-Text Search

- `rule_search.tsv` - GIN index for fast text search
- Automatically maintained via triggers

## Full-Text Search

### Architecture

- PostgreSQL `tsvector` with English configuration
- `unaccent` extension for accent-insensitive search
- Automatic index maintenance via triggers
- Ranking with `ts_rank_cd` function

### Search Function

```sql
CREATE OR REPLACE FUNCTION update_rule_tsv(rule_id_param TEXT)
```

Combines rule title, summary, and current version body into searchable vector.

### Triggers

- Updates on rule title/summary changes
- Updates on rule version body changes
- Updates when currentVersionId changes
- Automatic cleanup on rule deletion

### Usage

```typescript
// Search with ranking
const results = await searchRules("prompt engineering", {
  limit: 20,
  contentTypes: ["RULE"],
  statuses: ["PUBLISHED"],
});

// Results include rank score for sorting
results.forEach((result) => {
  console.log(`${result.title} (rank: ${result.rank})`);
});
```

## Migrations

### Creating Migrations

```bash
# After schema changes
pnpm prisma migrate dev --name descriptive_name

# Deploy to production
pnpm prisma migrate deploy
```

### Migration Files

- `20241113000000_init/` - Initial schema with extensions and FTS
- Includes PostgreSQL extensions, constraints, and triggers
- FTS functions and triggers for automatic index maintenance

## Performance Considerations

### Query Optimization

- Use `include` and `select` strategically
- Leverage indexes for filtering and sorting
- Use `take` and `skip` for pagination
- Consider `cursor` pagination for large datasets

### Metrics Aggregation

- Daily metrics reduce query load
- Use `updateRuleMetrics()` helper for consistent updates
- Background jobs should handle metric calculations

### Search Performance

- FTS queries are fast with proper indexing
- Use `ts_rank_cd` for relevance scoring
- Consider search result caching for popular queries

### Connection Management

- Use connection pooling in production
- Monitor connection usage
- Consider read replicas for analytics queries

## Development Workflow

### Schema Changes

1. Modify `schema.prisma`
2. Run `pnpm prisma migrate dev`
3. Update seed data if needed
4. Test with `pnpm db:seed`

### Testing

```bash
# Reset database
pnpm prisma migrate reset

# Regenerate client
pnpm db:generate

# Reseed data
pnpm db:seed
```

### Production Deployment

```bash
# Deploy migrations
pnpm prisma migrate deploy

# Generate client
pnpm prisma generate

# Optional: seed production data
pnpm db:seed
```

## Troubleshooting

### Common Issues

**Migration Failures**

- Check PostgreSQL version (16+ required)
- Ensure extensions are available
- Verify database permissions

**Search Not Working**

- Run `refreshAllRuleSearch()` to rebuild index
- Check trigger function exists
- Verify `unaccent` extension installed

**Performance Issues**

- Check query execution plans
- Verify indexes are being used
- Consider query optimization
- Monitor connection pool usage

**Type Errors**

- Regenerate Prisma client: `pnpm db:generate`
- Check for schema/code mismatches
- Verify imports are correct

### Debugging Queries

```typescript
// Enable query logging
const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

// Use raw queries for complex operations
const result = await prisma.$queryRaw`
  SELECT * FROM rules 
  WHERE to_tsvector('english', title) @@ plainto_tsquery('english', ${query})
`;
```

## Contributing

### Adding New Models

1. Add to `schema.prisma`
2. Create migration: `pnpm prisma migrate dev`
3. Update exports in `src/index.ts`
4. Add seed data if applicable
5. Update documentation

### Adding Indexes

1. Add `@@index` to schema
2. Create migration
3. Test query performance
4. Document usage patterns

### Adding Constraints

1. Add to schema or migration SQL
2. Test constraint enforcement
3. Update seed data to comply
4. Document business rules

## Security Considerations

- Never expose raw database in client-side code
- Use Prisma's built-in SQL injection protection
- Validate input data before database operations
- Use transactions for multi-step operations
- Audit sensitive operations via `AuditLog`
- Hash IP addresses and user agents in events
- Implement rate limiting using event tracking

## License

This database schema and implementation is part of the Core Directory Engine project.
