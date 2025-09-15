import { prisma } from "./client";
import { generateId } from "@repo/utils";

async function main() {
  console.log("🌱 Seeding database...");

  // Create sample users
  const user1 = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      id: generateId(),
      email: "alice@example.com",
      emailVerified: true,
      handle: "alice_dev",
      displayName: "Alice Johnson",
      bio: "Full-stack developer passionate about AI and automation.",
      role: "USER",
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      id: generateId(),
      email: "bob@example.com",
      emailVerified: true,
      handle: "bob_ai",
      displayName: "Bob Smith",
      bio: "AI researcher and prompt engineer.",
      role: "USER",
    },
  });

  console.log(`✅ Created users: ${user1.handle}, ${user2.handle}`);
  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
