#!/usr/bin/env tsx

import { db } from "@repo/db";
import { getCurrentTimestamp, formatDate } from "@repo/utils";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Database backup script
 * Creates JSON backups of important data
 */

interface BackupData {
  metadata: {
    timestamp: number;
    date: string;
    version: string;
  };
  users: any[];
  posts: any[];
  ingestEvents: any[];
}

async function createBackupDirectory(): Promise<string> {
  const backupDir = path.join(process.cwd(), "backups");

  try {
    await fs.access(backupDir);
  } catch {
    await fs.mkdir(backupDir, { recursive: true });
    console.log(`📁 Created backup directory: ${backupDir}`);
  }

  return backupDir;
}

async function exportUsers(): Promise<any[]> {
  console.log("👥 Exporting users...");

  const users = await db.user.findMany({
    include: {
      posts: {
        select: {
          id: true,
          title: true,
          published: true,
          createdAt: true,
        },
      },
    },
  });

  console.log(`✅ Exported ${users.length} users`);
  return users;
}

async function exportPosts(): Promise<any[]> {
  console.log("📝 Exporting posts...");

  const posts = await db.post.findMany({
    include: {
      author: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  console.log(`✅ Exported ${posts.length} posts`);
  return posts;
}

async function exportIngestEvents(): Promise<any[]> {
  console.log("📊 Exporting ingest events...");

  const events = await db.ingestEvent.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 10000, // Limit to recent events
  });

  console.log(`✅ Exported ${events.length} ingest events`);
  return events;
}

async function createBackup(): Promise<string> {
  const timestamp = getCurrentTimestamp();
  const date = formatDate(new Date(), "short");
  const filename = `backup-${date.replace(/\//g, "-")}-${timestamp}.json`;

  console.log(`📦 Creating backup: ${filename}`);

  // Export all data
  const [users, posts, ingestEvents] = await Promise.all([
    exportUsers(),
    exportPosts(),
    exportIngestEvents(),
  ]);

  const backupData: BackupData = {
    metadata: {
      timestamp,
      date: new Date().toISOString(),
      version: "1.0.0",
    },
    users,
    posts,
    ingestEvents,
  };

  // Write backup file
  const backupDir = await createBackupDirectory();
  const backupPath = path.join(backupDir, filename);

  await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), "utf-8");

  console.log(`✅ Backup created: ${backupPath}`);

  // Get file size
  const stats = await fs.stat(backupPath);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`📏 Backup size: ${sizeInMB} MB`);

  return backupPath;
}

async function cleanupOldBackups(keepCount: number = 5): Promise<number> {
  console.log(
    `🧹 Cleaning up old backups (keeping ${keepCount} most recent)...`
  );

  const backupDir = await createBackupDirectory();
  const files = await fs.readdir(backupDir);

  // Filter backup files and sort by creation time
  const backupFiles = files
    .filter((file) => file.startsWith("backup-") && file.endsWith(".json"))
    .map((file) => ({
      name: file,
      path: path.join(backupDir, file),
    }));

  if (backupFiles.length <= keepCount) {
    console.log(`✅ No cleanup needed (${backupFiles.length} backups found)`);
    return 0;
  }

  // Get file stats and sort by modification time (newest first)
  const filesWithStats = await Promise.all(
    backupFiles.map(async (file) => {
      const stats = await fs.stat(file.path);
      return {
        ...file,
        mtime: stats.mtime,
      };
    })
  );

  filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  // Delete old backups
  const filesToDelete = filesWithStats.slice(keepCount);

  for (const file of filesToDelete) {
    await fs.unlink(file.path);
    console.log(`🗑️  Deleted old backup: ${file.name}`);
  }

  console.log(`✅ Cleaned up ${filesToDelete.length} old backups`);
  return filesToDelete.length;
}

async function validateBackup(backupPath: string): Promise<boolean> {
  console.log("🔍 Validating backup...");

  try {
    const backupContent = await fs.readFile(backupPath, "utf-8");
    const backupData: BackupData = JSON.parse(backupContent);

    // Validate structure
    if (
      !backupData.metadata ||
      !backupData.users ||
      !backupData.posts ||
      !backupData.ingestEvents
    ) {
      throw new Error("Invalid backup structure");
    }

    // Validate metadata
    if (!backupData.metadata.timestamp || !backupData.metadata.date) {
      throw new Error("Invalid backup metadata");
    }

    // Validate data arrays
    if (
      !Array.isArray(backupData.users) ||
      !Array.isArray(backupData.posts) ||
      !Array.isArray(backupData.ingestEvents)
    ) {
      throw new Error("Invalid backup data arrays");
    }

    console.log("✅ Backup validation passed");
    console.log(`   - Users: ${backupData.users.length}`);
    console.log(`   - Posts: ${backupData.posts.length}`);
    console.log(`   - Events: ${backupData.ingestEvents.length}`);

    return true;
  } catch (error) {
    console.error("❌ Backup validation failed:", error);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting database backup...");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    // Create backup
    const backupPath = await createBackup();

    // Validate backup
    const isValid = await validateBackup(backupPath);
    if (!isValid) {
      throw new Error("Backup validation failed");
    }

    // Cleanup old backups
    const cleanedCount = await cleanupOldBackups(5);

    console.log("🎉 Backup completed successfully!");
    console.log(`📁 Backup location: ${backupPath}`);
    console.log(`🧹 Cleaned up: ${cleanedCount} old backups`);
  } catch (error) {
    console.error("❌ Backup failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run the backup
if (require.main === module) {
  main();
}
