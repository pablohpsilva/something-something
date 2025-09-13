import { beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "@repo/db/client";

// Setup test database
beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgres://test:test@localhost:5432/test_db";
  process.env.ABUSE_IP_SALT = "test-ip-salt";
  process.env.ABUSE_UA_SALT = "test-ua-salt";

  // Ensure database connection is ready
  try {
    await prisma.$connect();
  } catch (error) {
    console.error("Failed to connect to test database:", error);
    throw error;
  }
});

// Clean up after each test
afterEach(async () => {
  // Clean up test data in reverse dependency order
  await prisma.userBadge.deleteMany();
  await prisma.authorMetricDaily.deleteMany();
  await prisma.ruleMetricDaily.deleteMany();
  await prisma.event.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.watch.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.voteVersion.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.ruleTag.deleteMany();
  await prisma.ruleVersion.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.authorProfile.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
