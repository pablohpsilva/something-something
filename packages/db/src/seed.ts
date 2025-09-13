import { db } from "./client";

async function main() {
  console.log("🌱 Seeding database...");

  // Create sample users
  const user1 = await db.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      name: "Alice Johnson",
    },
  });

  const user2 = await db.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      name: "Bob Smith",
    },
  });

  // Create sample posts
  await db.post.upsert({
    where: { id: "sample-post-1" },
    update: {},
    create: {
      id: "sample-post-1",
      title: "Hello World",
      content: "This is my first post!",
      published: true,
      authorId: user1.id,
    },
  });

  await db.post.upsert({
    where: { id: "sample-post-2" },
    update: {},
    create: {
      id: "sample-post-2",
      title: "Draft Post",
      content: "This is a draft post.",
      published: false,
      authorId: user2.id,
    },
  });

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
