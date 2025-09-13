#!/usr/bin/env tsx

import { db } from "@repo/db";
import { generateUserId, generatePostId } from "@repo/utils";

async function main() {
  console.log("🌱 Starting database seeding...");

  try {
    // Clear existing data (optional - remove in production)
    console.log("🧹 Clearing existing data...");
    await db.post.deleteMany();
    await db.user.deleteMany();
    await db.ingestEvent.deleteMany();

    // Create users
    console.log("👥 Creating users...");
    const users = await Promise.all([
      db.user.create({
        data: {
          id: generateUserId(),
          email: "alice@example.com",
          name: "Alice Johnson",
        },
      }),
      db.user.create({
        data: {
          id: generateUserId(),
          email: "bob@example.com",
          name: "Bob Smith",
        },
      }),
      db.user.create({
        data: {
          id: generateUserId(),
          email: "charlie@example.com",
          name: "Charlie Brown",
        },
      }),
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create posts
    console.log("📝 Creating posts...");
    const posts = await Promise.all([
      db.post.create({
        data: {
          id: generatePostId(),
          title: "Welcome to Something Something",
          content:
            "This is our first blog post! We're excited to share our journey with you.",
          published: true,
          authorId: users[0].id,
        },
      }),
      db.post.create({
        data: {
          id: generatePostId(),
          title: "Getting Started with Our Platform",
          content:
            "Here's a comprehensive guide on how to get started with our platform...",
          published: true,
          authorId: users[1].id,
        },
      }),
      db.post.create({
        data: {
          id: generatePostId(),
          title: "Draft: Upcoming Features",
          content:
            "We're working on some exciting new features that will be released soon...",
          published: false,
          authorId: users[0].id,
        },
      }),
      db.post.create({
        data: {
          id: generatePostId(),
          title: "Best Practices for Development",
          content:
            "Here are some best practices we follow in our development process...",
          published: true,
          authorId: users[2].id,
        },
      }),
    ]);

    console.log(`✅ Created ${posts.length} posts`);

    // Create sample ingest events
    console.log("📊 Creating sample ingest events...");
    const ingestEvents = await Promise.all([
      db.ingestEvent.create({
        data: {
          type: "user_signup",
          data: {
            userId: users[0].id,
            email: users[0].email,
            timestamp: new Date().toISOString(),
            source: "web",
          },
          processed: true,
        },
      }),
      db.ingestEvent.create({
        data: {
          type: "post_created",
          data: {
            postId: posts[0].id,
            authorId: users[0].id,
            title: posts[0].title,
            timestamp: new Date().toISOString(),
          },
          processed: true,
        },
      }),
      db.ingestEvent.create({
        data: {
          type: "page_view",
          data: {
            path: "/",
            userId: users[1].id,
            timestamp: new Date().toISOString(),
            userAgent:
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
          processed: false,
        },
      }),
    ]);

    console.log(`✅ Created ${ingestEvents.length} ingest events`);

    console.log("🎉 Database seeding completed successfully!");
    console.log("\nSummary:");
    console.log(`- Users: ${users.length}`);
    console.log(`- Posts: ${posts.length}`);
    console.log(`- Ingest Events: ${ingestEvents.length}`);
  } catch (error) {
    console.error("❌ Seeding failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run the seeding script
if (require.main === module) {
  main();
}
