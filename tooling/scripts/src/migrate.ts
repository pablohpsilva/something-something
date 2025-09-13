#!/usr/bin/env tsx

import { db } from "@repo/db";

/**
 * Database migration script for one-time data transformations
 * This is separate from Prisma migrations and handles data migrations
 */

async function migrationExample() {
  console.log("🔄 Running example migration...");

  // Example: Update all posts without content to have default content
  const result = await db.post.updateMany({
    where: {
      content: null,
    },
    data: {
      content: "This post has no content yet.",
    },
  });

  console.log(`✅ Updated ${result.count} posts with default content`);
  return result.count;
}

async function backfillUserIds() {
  console.log("🔄 Backfilling user IDs...");

  // Example: Find users without proper ID format and update them
  const users = await db.user.findMany({
    where: {
      id: {
        not: {
          startsWith: "usr_",
        },
      },
    },
  });

  console.log(`Found ${users.length} users to update`);

  let updatedCount = 0;

  for (const user of users) {
    try {
      // Generate new ID with proper format
      const newId = `usr_${user.id}`;

      // Update user with new ID (this would require careful handling of foreign keys)
      // This is just an example - in practice, you'd need to handle relationships
      console.log(`Would update user ${user.id} to ${newId}`);
      updatedCount++;
    } catch (error) {
      console.error(`Failed to update user ${user.id}:`, error);
    }
  }

  console.log(`✅ Would update ${updatedCount} users`);
  return updatedCount;
}

async function cleanupDuplicateEvents() {
  console.log("🧹 Cleaning up duplicate ingest events...");

  // Find duplicate events based on type and data
  const duplicates = await db.$queryRaw<
    Array<{ type: string; data: any; count: number }>
  >`
    SELECT type, data, COUNT(*) as count
    FROM ingest_events
    GROUP BY type, data
    HAVING COUNT(*) > 1
  `;

  console.log(`Found ${duplicates.length} groups of duplicate events`);

  let deletedCount = 0;

  for (const duplicate of duplicates) {
    try {
      // Keep the oldest event, delete the rest
      const events = await db.ingestEvent.findMany({
        where: {
          type: duplicate.type,
          data: duplicate.data,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (events.length > 1) {
        const toDelete = events.slice(1); // Keep first, delete rest

        await db.ingestEvent.deleteMany({
          where: {
            id: {
              in: toDelete.map((e) => e.id),
            },
          },
        });

        deletedCount += toDelete.length;
        console.log(
          `Deleted ${toDelete.length} duplicate events for type: ${duplicate.type}`
        );
      }
    } catch (error) {
      console.error(
        `Failed to clean duplicates for type ${duplicate.type}:`,
        error
      );
    }
  }

  console.log(`✅ Deleted ${deletedCount} duplicate events`);
  return deletedCount;
}

async function updateTimestamps() {
  console.log("🕒 Updating timestamp formats...");

  // Example: Convert old timestamp format to new format
  // This is just an example - adjust based on your needs

  const events = await db.ingestEvent.findMany({
    where: {
      // Add conditions to find events that need timestamp updates
      updatedAt: {
        lt: new Date("2024-01-01"),
      },
    },
    take: 100, // Process in batches
  });

  console.log(`Found ${events.length} events to update`);

  let updatedCount = 0;

  for (const event of events) {
    try {
      await db.ingestEvent.update({
        where: { id: event.id },
        data: {
          updatedAt: new Date(),
        },
      });

      updatedCount++;
    } catch (error) {
      console.error(`Failed to update event ${event.id}:`, error);
    }
  }

  console.log(`✅ Updated ${updatedCount} event timestamps`);
  return updatedCount;
}

async function main() {
  console.log("🚀 Starting database migration...");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const results = {
    migrationExample: 0,
    backfillUserIds: 0,
    cleanupDuplicates: 0,
    updateTimestamps: 0,
  };

  try {
    // Run migrations in order
    console.log("\n" + "=".repeat(50));
    results.migrationExample = await migrationExample();

    console.log("\n" + "=".repeat(50));
    results.backfillUserIds = await backfillUserIds();

    console.log("\n" + "=".repeat(50));
    results.cleanupDuplicates = await cleanupDuplicateEvents();

    console.log("\n" + "=".repeat(50));
    results.updateTimestamps = await updateTimestamps();

    console.log("\n" + "=".repeat(50));
    console.log("🎉 Migration completed successfully!");
    console.log("Summary:", results);
  } catch (error) {
    console.error("❌ Migration failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run the migration
if (require.main === module) {
  main();
}
