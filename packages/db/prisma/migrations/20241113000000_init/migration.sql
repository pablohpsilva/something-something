-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'MOD', 'ADMIN');
CREATE TYPE "content_type" AS ENUM ('PROMPT', 'RULE', 'MCP', 'GUIDE');
CREATE TYPE "rule_status" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');
CREATE TYPE "source_type" AS ENUM ('USER_SUBMISSION', 'CRAWLED', 'PARTNER_API');
CREATE TYPE "crawl_status" AS ENUM ('NEW', 'MERGED', 'SKIPPED');
CREATE TYPE "crawl_policy" AS ENUM ('OPEN', 'ROBOTS', 'PARTNER_ONLY', 'BLOCK');
CREATE TYPE "event_type" AS ENUM ('VIEW', 'COPY', 'SAVE', 'FORK', 'COMMENT', 'VOTE', 'DONATE', 'CLAIM');
CREATE TYPE "notification_type" AS ENUM ('NEW_VERSION', 'COMMENT_REPLY', 'AUTHOR_PUBLISHED', 'CLAIM_VERDICT', 'DONATION_RECEIVED');
CREATE TYPE "donation_status" AS ENUM ('INIT', 'SUCCEEDED', 'FAILED');
CREATE TYPE "provider" AS ENUM ('STRIPE');
CREATE TYPE "payout_status" AS ENUM ('NONE', 'PENDING', 'VERIFIED');
CREATE TYPE "leaderboard_period" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ALL');
CREATE TYPE "leaderboard_scope" AS ENUM ('GLOBAL', 'TAG', 'MODEL');
CREATE TYPE "claim_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" VARCHAR(255) NOT NULL,
    "handle" VARCHAR(50) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "author_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "website" VARCHAR(255),
    "github" VARCHAR(100),
    "x" VARCHAR(100),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "author_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "type" "source_type" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "crawlPolicy" "crawl_policy" NOT NULL DEFAULT 'OPEN',
    "lastCrawledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT,
    "contentType" "content_type" NOT NULL DEFAULT 'RULE',
    "status" "rule_status" NOT NULL DEFAULT 'DRAFT',
    "primaryModel" VARCHAR(100),
    "createdByUserId" TEXT NOT NULL,
    "sourceId" TEXT,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_versions" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "body" TEXT NOT NULL,
    "testedOn" JSONB NOT NULL,
    "changelog" TEXT,
    "parentVersionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_tags" (
    "ruleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "rule_tags_pkey" PRIMARY KEY ("ruleId","tagId")
);

-- CreateTable
CREATE TABLE "resource_links" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "kind" VARCHAR(50) NOT NULL,

    CONSTRAINT "resource_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "parentId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("userId","ruleId")
);

-- CreateTable
CREATE TABLE "vote_versions" (
    "userId" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "vote_versions_pkey" PRIMARY KEY ("userId","ruleVersionId")
);

-- CreateTable
CREATE TABLE "favorites" (
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("userId","ruleId")
);

-- CreateTable
CREATE TABLE "follows" (
    "followerUserId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("followerUserId","authorUserId")
);

-- CreateTable
CREATE TABLE "watches" (
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,

    CONSTRAINT "watches_pkey" PRIMARY KEY ("userId","ruleId")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ruleId" TEXT,
    "ruleVersionId" TEXT,
    "type" "event_type" NOT NULL,
    "ipHash" VARCHAR(64) NOT NULL,
    "uaHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_metrics_daily" (
    "date" DATE NOT NULL,
    "ruleId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "copies" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "rule_metrics_daily_pkey" PRIMARY KEY ("date","ruleId")
);

-- CreateTable
CREATE TABLE "author_metrics_daily" (
    "date" DATE NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "copies" INTEGER NOT NULL DEFAULT 0,
    "donations" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "author_metrics_daily_pkey" PRIMARY KEY ("date","authorUserId")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("userId","badgeId")
);

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" TEXT NOT NULL,
    "period" "leaderboard_period" NOT NULL,
    "scope" "leaderboard_scope" NOT NULL,
    "scopeRef" VARCHAR(100),
    "rank" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "claimantUserId" TEXT NOT NULL,
    "status" "claim_status" NOT NULL DEFAULT 'PENDING',
    "evidenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(255) NOT NULL,
    "diff" JSONB,
    "ipHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT NOT NULL,
    "ruleId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "donation_status" NOT NULL DEFAULT 'INIT',
    "provider" "provider" NOT NULL DEFAULT 'STRIPE',
    "providerRef" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerAccountId" VARCHAR(255) NOT NULL,
    "status" "payout_status" NOT NULL DEFAULT 'NONE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_items" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT,
    "raw" JSONB NOT NULL,
    "status" "crawl_status" NOT NULL DEFAULT 'NEW',
    "mergedRuleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_search" (
    "ruleId" TEXT NOT NULL,
    "tsv" tsvector NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_search_pkey" PRIMARY KEY ("ruleId")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");
CREATE UNIQUE INDEX "author_profiles_userId_key" ON "author_profiles"("userId");
CREATE UNIQUE INDEX "rules_slug_key" ON "rules"("slug");
CREATE UNIQUE INDEX "rule_versions_ruleId_version_key" ON "rule_versions"("ruleId", "version");
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");
CREATE UNIQUE INDEX "badges_slug_key" ON "badges"("slug");
CREATE UNIQUE INDEX "leaderboard_snapshots_period_scope_scopeRef_createdAt_key" ON "leaderboard_snapshots"("period", "scope", "scopeRef", "createdAt");
CREATE UNIQUE INDEX "payout_accounts_userId_key" ON "payout_accounts"("userId");
CREATE UNIQUE INDEX "crawl_items_sourceId_externalId_key" ON "crawl_items"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");
CREATE INDEX "sources_type_idx" ON "sources"("type");
CREATE INDEX "sources_crawlPolicy_idx" ON "sources"("crawlPolicy");
CREATE INDEX "sources_lastCrawledAt_idx" ON "sources"("lastCrawledAt");
CREATE INDEX "rules_status_idx" ON "rules"("status");
CREATE INDEX "rules_contentType_idx" ON "rules"("contentType");
CREATE INDEX "rules_createdByUserId_idx" ON "rules"("createdByUserId");
CREATE INDEX "rules_sourceId_idx" ON "rules"("sourceId");
CREATE INDEX "rules_currentVersionId_idx" ON "rules"("currentVersionId");
CREATE INDEX "rules_createdAt_idx" ON "rules"("createdAt");
CREATE INDEX "rules_deletedAt_idx" ON "rules"("deletedAt");
CREATE INDEX "rule_versions_ruleId_createdAt_idx" ON "rule_versions"("ruleId", "createdAt" DESC);
CREATE INDEX "rule_versions_createdByUserId_idx" ON "rule_versions"("createdByUserId");
CREATE INDEX "rule_versions_parentVersionId_idx" ON "rule_versions"("parentVersionId");
CREATE INDEX "resource_links_ruleId_idx" ON "resource_links"("ruleId");
CREATE INDEX "resource_links_kind_idx" ON "resource_links"("kind");
CREATE INDEX "comments_ruleId_parentId_idx" ON "comments"("ruleId", "parentId");
CREATE INDEX "comments_authorUserId_idx" ON "comments"("authorUserId");
CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");
CREATE INDEX "comments_deletedAt_idx" ON "comments"("deletedAt");
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");
CREATE INDEX "events_ruleId_createdAt_idx" ON "events"("ruleId", "createdAt");
CREATE INDEX "events_type_createdAt_idx" ON "events"("type", "createdAt");
CREATE INDEX "events_userId_createdAt_idx" ON "events"("userId", "createdAt");
CREATE INDEX "events_createdAt_idx" ON "events"("createdAt");
CREATE INDEX "rule_metrics_daily_date_idx" ON "rule_metrics_daily"("date");
CREATE INDEX "rule_metrics_daily_ruleId_idx" ON "rule_metrics_daily"("ruleId");
CREATE INDEX "rule_metrics_daily_score_idx" ON "rule_metrics_daily"("score");
CREATE INDEX "author_metrics_daily_date_idx" ON "author_metrics_daily"("date");
CREATE INDEX "author_metrics_daily_authorUserId_idx" ON "author_metrics_daily"("authorUserId");
CREATE INDEX "author_metrics_daily_score_idx" ON "author_metrics_daily"("score");
CREATE INDEX "user_badges_awardedAt_idx" ON "user_badges"("awardedAt");
CREATE INDEX "leaderboard_snapshots_period_scope_scopeRef_createdAt_idx" ON "leaderboard_snapshots"("period", "scope", "scopeRef", "createdAt");
CREATE INDEX "claims_ruleId_idx" ON "claims"("ruleId");
CREATE INDEX "claims_claimantUserId_idx" ON "claims"("claimantUserId");
CREATE INDEX "claims_status_idx" ON "claims"("status");
CREATE INDEX "claims_createdAt_idx" ON "claims"("createdAt");
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "donations_fromUserId_idx" ON "donations"("fromUserId");
CREATE INDEX "donations_toUserId_idx" ON "donations"("toUserId");
CREATE INDEX "donations_ruleId_idx" ON "donations"("ruleId");
CREATE INDEX "donations_status_idx" ON "donations"("status");
CREATE INDEX "donations_createdAt_idx" ON "donations"("createdAt");
CREATE INDEX "payout_accounts_status_idx" ON "payout_accounts"("status");
CREATE INDEX "crawl_items_sourceId_idx" ON "crawl_items"("sourceId");
CREATE INDEX "crawl_items_status_idx" ON "crawl_items"("status");
CREATE INDEX "crawl_items_createdAt_idx" ON "crawl_items"("createdAt");

-- Create GIN index for full-text search
CREATE INDEX "rule_search_tsv_idx" ON "rule_search" USING GIN ("tsv");

-- Partial index for recent view events (performance optimization)
CREATE INDEX "events_recent_views_idx" ON "events"("type", "createdAt") 
WHERE "type" = 'VIEW' AND "createdAt" > (NOW() - INTERVAL '30 days');

-- AddForeignKey
ALTER TABLE "author_profiles" ADD CONSTRAINT "author_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rules" ADD CONSTRAINT "rules_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rules" ADD CONSTRAINT "rules_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rules" ADD CONSTRAINT "rules_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "rule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "rule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rule_tags" ADD CONSTRAINT "rule_tags_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rule_tags" ADD CONSTRAINT "rule_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_links" ADD CONSTRAINT "resource_links_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "votes" ADD CONSTRAINT "votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "votes" ADD CONSTRAINT "votes_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vote_versions" ADD CONSTRAINT "vote_versions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vote_versions" ADD CONSTRAINT "vote_versions_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "rule_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerUserId_fkey" FOREIGN KEY ("followerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "watches" ADD CONSTRAINT "watches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "watches" ADD CONSTRAINT "watches_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "rule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rule_metrics_daily" ADD CONSTRAINT "rule_metrics_daily_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "author_metrics_daily" ADD CONSTRAINT "author_metrics_daily_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "claims" ADD CONSTRAINT "claims_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "claims" ADD CONSTRAINT "claims_claimantUserId_fkey" FOREIGN KEY ("claimantUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claims" ADD CONSTRAINT "claims_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "donations" ADD CONSTRAINT "donations_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "donations" ADD CONSTRAINT "donations_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "donations" ADD CONSTRAINT "donations_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crawl_items" ADD CONSTRAINT "crawl_items_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crawl_items" ADD CONSTRAINT "crawl_items_mergedRuleId_fkey" FOREIGN KEY ("mergedRuleId") REFERENCES "rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rule_search" ADD CONSTRAINT "rule_search_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add check constraints for vote values
ALTER TABLE "votes" ADD CONSTRAINT "votes_value_check" CHECK ("value" IN (-1, 1));
ALTER TABLE "vote_versions" ADD CONSTRAINT "vote_versions_value_check" CHECK ("value" IN (-1, 1));

-- Add check constraints for donations
ALTER TABLE "donations" ADD CONSTRAINT "donations_amountCents_check" CHECK ("amountCents" > 0);
ALTER TABLE "donations" ADD CONSTRAINT "donations_currency_check" CHECK (LENGTH("currency") = 3);

-- Add check constraint for rule slugs (basic pattern)
ALTER TABLE "rules" ADD CONSTRAINT "rules_slug_check" CHECK ("slug" ~ '^[a-z0-9-]+$');

-- Full-text search function and triggers
CREATE OR REPLACE FUNCTION update_rule_tsv(rule_id_param TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO rule_search (ruleId, tsv, updatedAt)
    SELECT 
        r.id,
        to_tsvector('english', 
            unaccent(
                COALESCE(r.title, '') || ' ' || 
                COALESCE(r.summary, '') || ' ' || 
                COALESCE(rv.body, '')
            )
        ),
        NOW()
    FROM rules r
    LEFT JOIN rule_versions rv ON r.currentVersionId = rv.id
    WHERE r.id = rule_id_param
    ON CONFLICT (ruleId) DO UPDATE SET
        tsv = EXCLUDED.tsv,
        updatedAt = EXCLUDED.updatedAt;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for rule changes
CREATE OR REPLACE FUNCTION trigger_update_rule_tsv()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_rule_tsv(NEW.id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM rule_search WHERE ruleId = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for rule version changes
CREATE OR REPLACE FUNCTION trigger_update_rule_tsv_from_version()
RETURNS TRIGGER AS $$
DECLARE
    affected_rule_id TEXT;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Check if this version is the current version of any rule
        SELECT id INTO affected_rule_id 
        FROM rules 
        WHERE currentVersionId = NEW.id;
        
        IF affected_rule_id IS NOT NULL THEN
            PERFORM update_rule_tsv(affected_rule_id);
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Check if this version was the current version of any rule
        SELECT id INTO affected_rule_id 
        FROM rules 
        WHERE currentVersionId = OLD.id;
        
        IF affected_rule_id IS NOT NULL THEN
            PERFORM update_rule_tsv(affected_rule_id);
        END IF;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER rule_search_update_trigger
    AFTER INSERT OR UPDATE OF title, summary, currentVersionId OR DELETE
    ON rules
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_rule_tsv();

CREATE TRIGGER rule_version_search_update_trigger
    AFTER INSERT OR UPDATE OF body OR DELETE
    ON rule_versions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_rule_tsv_from_version();
