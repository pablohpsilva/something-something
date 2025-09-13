import { describe, it, expect, beforeEach } from "vitest";
import { createCallerFactory } from "@trpc/server";
import { appRouter } from "../index";
import { prisma } from "@repo/db/client";
import { generateId } from "@repo/utils";

const createCaller = createCallerFactory(appRouter);

describe("Rules Router Integration", () => {
  let testUser: any;
  let caller: any;

  beforeEach(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: generateId(),
        clerkId: `test_${generateId()}`,
        email: "test@example.com",
        displayName: "Test User",
      },
    });

    // Create caller with test context
    caller = createCaller({
      user: testUser,
      req: {} as any,
      res: {} as any,
    });
  });

  describe("create", () => {
    it("should create a new rule successfully", async () => {
      const ruleData = {
        title: "Test Rule",
        slug: "test-rule",
        summary: "A test rule for integration testing",
        contentType: "PROMPT" as const,
        primaryModel: "gpt-4",
        body: "This is a test prompt body",
        tags: ["testing", "ai"],
      };

      const result = await caller.rules.create(ruleData);

      expect(result).toMatchObject({
        title: ruleData.title,
        slug: ruleData.slug,
        summary: ruleData.summary,
        contentType: ruleData.contentType,
        primaryModel: ruleData.primaryModel,
        createdByUserId: testUser.id,
        status: "DRAFT",
      });

      // Verify rule was created in database
      const dbRule = await prisma.rule.findUnique({
        where: { id: result.id },
        include: { tags: { include: { tag: true } } },
      });

      expect(dbRule).toBeTruthy();
      expect(dbRule?.tags).toHaveLength(2);
    });

    it("should create rule version automatically", async () => {
      const ruleData = {
        title: "Test Rule with Version",
        slug: "test-rule-version",
        summary: "A test rule to check version creation",
        contentType: "PROMPT" as const,
        primaryModel: "gpt-4",
        body: "This is a test prompt body",
        tags: ["testing"],
      };

      const result = await caller.rules.create(ruleData);

      // Check that a version was created
      const versions = await prisma.ruleVersion.findMany({
        where: { ruleId: result.id },
      });

      expect(versions).toHaveLength(1);
      expect(versions[0]).toMatchObject({
        version: "1.0.0",
        body: ruleData.body,
        createdByUserId: testUser.id,
      });
    });
  });

  describe("publish", () => {
    it("should publish a draft rule", async () => {
      // Create a draft rule first
      const rule = await prisma.rule.create({
        data: {
          id: generateId(),
          title: "Draft Rule",
          slug: "draft-rule",
          summary: "A draft rule to be published",
          contentType: "PROMPT",
          primaryModel: "gpt-4",
          createdByUserId: testUser.id,
          status: "DRAFT",
        },
      });

      const result = await caller.rules.publish({ id: rule.id });

      expect(result.status).toBe("PUBLISHED");
      expect(result.publishedAt).toBeTruthy();

      // Verify in database
      const dbRule = await prisma.rule.findUnique({
        where: { id: rule.id },
      });

      expect(dbRule?.status).toBe("PUBLISHED");
      expect(dbRule?.publishedAt).toBeTruthy();
    });
  });

  describe("vote", () => {
    it("should allow voting on published rules", async () => {
      // Create and publish a rule
      const rule = await prisma.rule.create({
        data: {
          id: generateId(),
          title: "Votable Rule",
          slug: "votable-rule",
          summary: "A rule that can be voted on",
          contentType: "PROMPT",
          primaryModel: "gpt-4",
          createdByUserId: testUser.id,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      const result = await caller.rules.vote({
        ruleId: rule.id,
        value: 1, // upvote
      });

      expect(result.success).toBe(true);

      // Verify vote was recorded
      const vote = await prisma.vote.findUnique({
        where: {
          userId_ruleId: {
            userId: testUser.id,
            ruleId: rule.id,
          },
        },
      });

      expect(vote).toBeTruthy();
      expect(vote?.value).toBe(1);
    });

    it("should update existing vote", async () => {
      // Create rule and initial vote
      const rule = await prisma.rule.create({
        data: {
          id: generateId(),
          title: "Votable Rule 2",
          slug: "votable-rule-2",
          summary: "Another votable rule",
          contentType: "PROMPT",
          primaryModel: "gpt-4",
          createdByUserId: testUser.id,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      await prisma.vote.create({
        data: {
          userId: testUser.id,
          ruleId: rule.id,
          value: 1,
        },
      });

      // Change vote to downvote
      const result = await caller.rules.vote({
        ruleId: rule.id,
        value: -1,
      });

      expect(result.success).toBe(true);

      // Verify vote was updated
      const vote = await prisma.vote.findUnique({
        where: {
          userId_ruleId: {
            userId: testUser.id,
            ruleId: rule.id,
          },
        },
      });

      expect(vote?.value).toBe(-1);
    });
  });

  describe("list", () => {
    it("should return published rules with proper pagination", async () => {
      // Create multiple rules
      const rules = await Promise.all([
        prisma.rule.create({
          data: {
            id: generateId(),
            title: "Published Rule 1",
            slug: "published-rule-1",
            summary: "First published rule",
            contentType: "PROMPT",
            primaryModel: "gpt-4",
            createdByUserId: testUser.id,
            status: "PUBLISHED",
            publishedAt: new Date(Date.now() - 2000),
          },
        }),
        prisma.rule.create({
          data: {
            id: generateId(),
            title: "Published Rule 2",
            slug: "published-rule-2",
            summary: "Second published rule",
            contentType: "GUIDE",
            primaryModel: "claude-3-sonnet",
            createdByUserId: testUser.id,
            status: "PUBLISHED",
            publishedAt: new Date(Date.now() - 1000),
          },
        }),
        prisma.rule.create({
          data: {
            id: generateId(),
            title: "Draft Rule",
            slug: "draft-rule-list",
            summary: "A draft rule that should not appear",
            contentType: "PROMPT",
            primaryModel: "gpt-4",
            createdByUserId: testUser.id,
            status: "DRAFT",
          },
        }),
      ]);

      const result = await caller.rules.list({
        limit: 10,
        cursor: null,
      });

      expect(result.items).toHaveLength(2); // Only published rules
      expect(result.items[0].title).toBe("Published Rule 2"); // Most recent first
      expect(result.items[1].title).toBe("Published Rule 1");
      expect(result.nextCursor).toBeNull(); // No more items
    });
  });
});
