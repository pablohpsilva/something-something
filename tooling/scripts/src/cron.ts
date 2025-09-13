#!/usr/bin/env tsx

import { db } from "@repo/db";
import { getCurrentTimestamp, subtractTime } from "@repo/utils";

/**
 * Cron job script for periodic maintenance tasks
 * This can be run via GitHub Actions, Vercel Cron, or any cron scheduler
 */

async function cleanupOldIngestEvents() {
  console.log("🧹 Cleaning up old processed ingest events...");

  // Delete processed events older than 30 days
  const cutoffDate = subtractTime(new Date(), 30, "days");

  const result = await db.ingestEvent.deleteMany({
    where: {
      processed: true,
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`✅ Deleted ${result.count} old ingest events`);
  return result.count;
}

async function processUnprocessedEvents() {
  console.log("⚡ Processing unprocessed ingest events...");

  // Get unprocessed events (limit to 100 at a time)
  const unprocessedEvents = await db.ingestEvent.findMany({
    where: {
      processed: false,
    },
    take: 100,
    orderBy: {
      createdAt: "asc",
    },
  });

  console.log(`Found ${unprocessedEvents.length} unprocessed events`);

  let processedCount = 0;

  for (const event of unprocessedEvents) {
    try {
      // Process the event based on its type
      switch (event.type) {
        case "user_signup":
          console.log(`Processing user signup: ${JSON.stringify(event.data)}`);
          // TODO: Add user signup processing logic
          break;

        case "post_created":
          console.log(
            `Processing post creation: ${JSON.stringify(event.data)}`
          );
          // TODO: Add post creation processing logic
          break;

        case "page_view":
          console.log(`Processing page view: ${JSON.stringify(event.data)}`);
          // TODO: Add analytics processing logic
          break;

        default:
          console.log(`Unknown event type: ${event.type}`);
      }

      // Mark as processed
      await db.ingestEvent.update({
        where: { id: event.id },
        data: { processed: true },
      });

      processedCount++;
    } catch (error) {
      console.error(`Failed to process event ${event.id}:`, error);
      // Continue with other events
    }
  }

  console.log(`✅ Processed ${processedCount} events`);
  return processedCount;
}

async function generateDailyStats() {
  console.log("📊 Generating daily statistics...");

  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  // Count various metrics for today
  const [userCount, postCount, eventCount] = await Promise.all([
    db.user.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    }),
    db.post.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    }),
    db.ingestEvent.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    }),
  ]);

  const stats = {
    date: today.toISOString().split("T")[0],
    newUsers: userCount,
    newPosts: postCount,
    totalEvents: eventCount,
    timestamp: getCurrentTimestamp(),
  };

  console.log("Daily stats:", stats);

  // TODO: Store stats in database or send to analytics service
  // await db.dailyStats.create({ data: stats });

  return stats;
}

async function healthCheck() {
  console.log("🏥 Running health check...");

  try {
    // Test database connection
    await db.$queryRaw`SELECT 1`;
    console.log("✅ Database connection: OK");

    // Check for any critical issues
    const unprocessedCount = await db.ingestEvent.count({
      where: { processed: false },
    });

    if (unprocessedCount > 1000) {
      console.warn(
        `⚠️  High number of unprocessed events: ${unprocessedCount}`
      );
    } else {
      console.log(`✅ Unprocessed events: ${unprocessedCount}`);
    }

    return { status: "healthy", unprocessedEvents: unprocessedCount };
  } catch (error) {
    console.error("❌ Health check failed:", error);
    return { status: "unhealthy", error: error.message };
  }
}

async function main() {
  console.log("🚀 Starting cron job...");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const results = {
    healthCheck: null as any,
    cleanupCount: 0,
    processedCount: 0,
    dailyStats: null as any,
  };

  try {
    // Run health check first
    results.healthCheck = await healthCheck();

    if (results.healthCheck.status === "unhealthy") {
      console.error("❌ Health check failed, skipping other tasks");
      process.exit(1);
    }

    // Run cleanup tasks
    results.cleanupCount = await cleanupOldIngestEvents();

    // Process unprocessed events
    results.processedCount = await processUnprocessedEvents();

    // Generate daily stats
    results.dailyStats = await generateDailyStats();

    console.log("🎉 Cron job completed successfully!");
    console.log("Summary:", results);
  } catch (error) {
    console.error("❌ Cron job failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run the cron job
if (require.main === module) {
  main();
}
