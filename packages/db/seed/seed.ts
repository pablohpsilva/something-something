#!/usr/bin/env tsx

import { prisma, refreshAllRuleSearch } from "../src";
import { generateUserId, generateId } from "@repo/utils";
import { faker } from "@faker-js/faker";

// Set seed for deterministic data
faker.seed(42);

async function main() {
  console.log("🌱 Starting database seeding...");

  try {
    // Clear existing data in proper order (respecting foreign keys)
    console.log("🧹 Clearing existing data...");
    await prisma.auditLog.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.event.deleteMany();
    await prisma.ruleMetricDaily.deleteMany();
    await prisma.authorMetricDaily.deleteMany();
    await prisma.userBadge.deleteMany();
    await prisma.leaderboardSnapshot.deleteMany();
    await prisma.donation.deleteMany();
    await prisma.payoutAccount.deleteMany();
    await prisma.claim.deleteMany();
    await prisma.crawlItem.deleteMany();
    await prisma.ruleSearch.deleteMany();
    await prisma.resourceLink.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.vote.deleteMany();
    await prisma.voteVersion.deleteMany();
    await prisma.favorite.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.watch.deleteMany();
    await prisma.ruleTag.deleteMany();
    await prisma.ruleVersion.deleteMany();
    await prisma.rule.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.source.deleteMany();
    await prisma.badge.deleteMany();
    await prisma.authorProfile.deleteMany();
    await prisma.user.deleteMany();

    // Create Users
    console.log("👥 Creating users...");
    const users = await Promise.all([
      prisma.user.create({
        data: {
          id: generateUserId(),
          handle: "alice-dev",
          displayName: "Alice Johnson",
          avatarUrl:
            "https://images.unsplash.com/photo-1494790108755-2616b612b1e5?w=150",
          bio: "Full-stack developer passionate about AI and prompt engineering. Love creating efficient workflows.",
          role: "USER",
        },
      }),
      prisma.user.create({
        data: {
          id: generateUserId(),
          handle: "bob-prompt-master",
          displayName: "Bob Smith",
          avatarUrl:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
          bio: "Prompt engineering specialist with 5+ years in ML/AI. Creator of popular prompt libraries.",
          role: "MOD",
        },
      }),
      prisma.user.create({
        data: {
          id: generateUserId(),
          handle: "charlie-ai",
          displayName: "Charlie Brown",
          avatarUrl:
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
          bio: "AI researcher and educator. Building the future of human-AI collaboration.",
          role: "ADMIN",
        },
      }),
      prisma.user.create({
        data: {
          id: generateUserId(),
          handle: "diana-coder",
          displayName: "Diana Prince",
          avatarUrl:
            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
          bio: "Software architect specializing in developer tools and automation.",
          role: "USER",
        },
      }),
      prisma.user.create({
        data: {
          id: generateUserId(),
          handle: "evan-ml",
          displayName: "Evan Chen",
          avatarUrl:
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
          bio: "Machine learning engineer focused on practical AI applications.",
          role: "USER",
        },
      }),
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create Author Profiles for verified users
    console.log("📝 Creating author profiles...");
    const authorProfiles = await Promise.all([
      prisma.authorProfile.create({
        data: {
          userId: users[1].id, // Bob
          website: "https://bobsmith.dev",
          github: "bobsmith",
          x: "bobprompts",
          isVerified: true,
          claimedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        },
      }),
      prisma.authorProfile.create({
        data: {
          userId: users[2].id, // Charlie
          website: "https://charlie-ai.com",
          github: "charlie-ai",
          x: "charlieAI",
          isVerified: true,
          claimedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        },
      }),
    ]);

    console.log(`✅ Created ${authorProfiles.length} author profiles`);

    // Create Sources
    console.log("🔗 Creating sources...");
    const sources = await Promise.all([
      prisma.source.create({
        data: {
          type: "USER_SUBMISSION",
          name: "Community Submissions",
          url: "https://community.example.com",
          crawlPolicy: "OPEN",
        },
      }),
      prisma.source.create({
        data: {
          type: "CRAWLED",
          name: "Awesome Prompts GitHub",
          url: "https://github.com/awesome-prompts/awesome-prompts",
          crawlPolicy: "ROBOTS",
          lastCrawledAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        },
      }),
      prisma.source.create({
        data: {
          type: "PARTNER_API",
          name: "PromptBase API",
          url: "https://api.promptbase.com",
          crawlPolicy: "PARTNER_ONLY",
          lastCrawledAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        },
      }),
    ]);

    console.log(`✅ Created ${sources.length} sources`);

    // Create Tags
    console.log("🏷️ Creating tags...");
    const tagData = [
      { slug: "coding", name: "Coding" },
      { slug: "writing", name: "Writing" },
      { slug: "analysis", name: "Analysis" },
      { slug: "creative", name: "Creative" },
      { slug: "debugging", name: "Debugging" },
      { slug: "documentation", name: "Documentation" },
      { slug: "testing", name: "Testing" },
      { slug: "productivity", name: "Productivity" },
      { slug: "learning", name: "Learning" },
      { slug: "research", name: "Research" },
    ];

    const tags = await Promise.all(
      tagData.map((tag) =>
        prisma.tag.create({
          data: {
            id: generateId(),
            slug: tag.slug,
            name: tag.name,
          },
        })
      )
    );

    console.log(`✅ Created ${tags.length} tags`);

    // Create Rules
    console.log("📋 Creating rules...");
    const ruleData = [
      {
        slug: "code-review-assistant",
        title: "Code Review Assistant",
        summary:
          "Comprehensive code review prompts for better code quality and security analysis.",
        contentType: "RULE",
        status: "PUBLISHED",
        primaryModel: "gpt-4",
        createdByUserId: users[1].id,
        sourceId: sources[0].id,
      },
      {
        slug: "technical-writer-helper",
        title: "Technical Writing Helper",
        summary: "Prompts to improve technical documentation and API guides.",
        contentType: "GUIDE",
        status: "PUBLISHED",
        primaryModel: "claude-3-sonnet",
        createdByUserId: users[2].id,
        sourceId: sources[0].id,
      },
      {
        slug: "debug-wizard",
        title: "Debug Wizard",
        summary:
          "Step-by-step debugging prompts for various programming languages.",
        contentType: "PROMPT",
        status: "PUBLISHED",
        primaryModel: "gpt-4",
        createdByUserId: users[0].id,
        sourceId: sources[1].id,
      },
      {
        slug: "test-case-generator",
        title: "Test Case Generator",
        summary:
          "Generate comprehensive test cases for your functions and APIs.",
        contentType: "RULE",
        status: "PUBLISHED",
        primaryModel: "claude-3-haiku",
        createdByUserId: users[3].id,
        sourceId: sources[0].id,
      },
      {
        slug: "creative-story-builder",
        title: "Creative Story Builder",
        summary:
          "Build engaging narratives with structured prompts for storytelling.",
        contentType: "PROMPT",
        status: "PUBLISHED",
        primaryModel: "gpt-4",
        createdByUserId: users[4].id,
        sourceId: sources[0].id,
      },
      {
        slug: "data-analysis-expert",
        title: "Data Analysis Expert",
        summary:
          "Analyze datasets and generate insights with structured prompts.",
        contentType: "RULE",
        status: "PUBLISHED",
        primaryModel: "gpt-4",
        createdByUserId: users[1].id,
        sourceId: sources[2].id,
      },
      {
        slug: "mcp-server-template",
        title: "MCP Server Template",
        summary: "Template for creating Model Context Protocol servers.",
        contentType: "MCP",
        status: "PUBLISHED",
        primaryModel: null,
        createdByUserId: users[2].id,
        sourceId: sources[0].id,
      },
      {
        slug: "learning-path-creator",
        title: "Learning Path Creator",
        summary: "Create structured learning paths for any topic or skill.",
        contentType: "GUIDE",
        status: "PUBLISHED",
        primaryModel: "claude-3-sonnet",
        createdByUserId: users[0].id,
        sourceId: sources[0].id,
      },
      {
        slug: "api-documentation-writer",
        title: "API Documentation Writer",
        summary:
          "Generate comprehensive API documentation from code and specs.",
        contentType: "RULE",
        status: "DRAFT",
        primaryModel: "gpt-4",
        createdByUserId: users[3].id,
        sourceId: sources[0].id,
      },
      {
        slug: "research-paper-analyzer",
        title: "Research Paper Analyzer",
        summary: "Analyze and summarize academic papers with key insights.",
        contentType: "PROMPT",
        status: "PUBLISHED",
        primaryModel: "claude-3-sonnet",
        createdByUserId: users[4].id,
        sourceId: sources[1].id,
      },
      {
        slug: "sql-query-optimizer",
        title: "SQL Query Optimizer",
        summary: "Optimize SQL queries for better performance and readability.",
        contentType: "RULE",
        status: "PUBLISHED",
        primaryModel: "gpt-4",
        createdByUserId: users[1].id,
        sourceId: sources[0].id,
      },
      {
        slug: "meeting-notes-summarizer",
        title: "Meeting Notes Summarizer",
        summary:
          "Transform meeting transcripts into actionable summaries and tasks.",
        contentType: "PROMPT",
        status: "PUBLISHED",
        primaryModel: "claude-3-haiku",
        createdByUserId: users[2].id,
        sourceId: sources[0].id,
      },
      {
        slug: "code-architecture-reviewer",
        title: "Code Architecture Reviewer",
        summary: "Review system architecture and suggest improvements.",
        contentType: "RULE",
        status: "PUBLISHED",
        primaryModel: "gpt-4",
        createdByUserId: users[0].id,
        sourceId: sources[0].id,
      },
      {
        slug: "email-template-generator",
        title: "Email Template Generator",
        summary: "Generate professional email templates for various scenarios.",
        contentType: "PROMPT",
        status: "PUBLISHED",
        primaryModel: "claude-3-haiku",
        createdByUserId: users[3].id,
        sourceId: sources[0].id,
      },
      {
        slug: "performance-optimization-guide",
        title: "Performance Optimization Guide",
        summary: "Comprehensive guide for optimizing application performance.",
        contentType: "GUIDE",
        status: "PUBLISHED",
        primaryModel: "gpt-4",
        createdByUserId: users[4].id,
        sourceId: sources[0].id,
      },
      {
        slug: "security-audit-checklist",
        title: "Security Audit Checklist",
        summary: "Comprehensive security audit checklist for web applications.",
        contentType: "RULE",
        status: "PUBLISHED",
        primaryModel: "gpt-4",
        createdByUserId: users[1].id,
        sourceId: sources[0].id,
      },
      {
        slug: "ui-ux-feedback-analyzer",
        title: "UI/UX Feedback Analyzer",
        summary: "Analyze user feedback to improve interface design.",
        contentType: "PROMPT",
        status: "PUBLISHED",
        primaryModel: "claude-3-sonnet",
        createdByUserId: users[2].id,
        sourceId: sources[0].id,
      },
      {
        slug: "agile-retrospective-facilitator",
        title: "Agile Retrospective Facilitator",
        summary:
          "Facilitate productive team retrospectives with structured prompts.",
        contentType: "GUIDE",
        status: "PUBLISHED",
        primaryModel: "gpt-4",
        createdByUserId: users[0].id,
        sourceId: sources[0].id,
      },
      {
        slug: "database-schema-designer",
        title: "Database Schema Designer",
        summary: "Design optimal database schemas for your applications.",
        contentType: "RULE",
        status: "DRAFT",
        primaryModel: "gpt-4",
        createdByUserId: users[3].id,
        sourceId: sources[0].id,
      },
      {
        slug: "content-strategy-planner",
        title: "Content Strategy Planner",
        summary:
          "Plan comprehensive content strategies for marketing campaigns.",
        contentType: "PROMPT",
        status: "PUBLISHED",
        primaryModel: "claude-3-sonnet",
        createdByUserId: users[4].id,
        sourceId: sources[0].id,
      },
    ];

    const rules = [];
    for (const ruleInfo of ruleData) {
      const rule = await prisma.rule.create({
        data: {
          id: generateId(),
          ...ruleInfo,
        },
      });
      rules.push(rule);
    }

    console.log(`✅ Created ${rules.length} rules`);

    // Create Rule Versions
    console.log("📄 Creating rule versions...");
    const ruleVersions = [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];

      // Create initial version
      const version1 = await prisma.ruleVersion.create({
        data: {
          id: generateId(),
          ruleId: rule.id,
          version: "1.0.0",
          body: generateRuleBody(rule.title, rule.summary || ""),
          testedOn: {
            models: rule.primaryModel ? [rule.primaryModel] : ["gpt-4"],
            stacks: ["javascript", "typescript", "node.js"],
          },
          changelog: "Initial version",
          createdByUserId: rule.createdByUserId,
        },
      });
      ruleVersions.push(version1);

      // Create a second version for some rules
      if (i % 3 === 0) {
        const version2 = await prisma.ruleVersion.create({
          data: {
            id: generateId(),
            ruleId: rule.id,
            version: "1.1.0",
            body: generateRuleBody(rule.title, rule.summary || "", true),
            testedOn: {
              models: rule.primaryModel
                ? [rule.primaryModel, "claude-3-sonnet"]
                : ["gpt-4", "claude-3-sonnet"],
              stacks: ["javascript", "typescript", "node.js", "python"],
            },
            changelog: "Added support for more models and improved accuracy",
            parentVersionId: version1.id,
            createdByUserId: rule.createdByUserId,
          },
        });
        ruleVersions.push(version2);

        // Update rule to point to latest version
        await prisma.rule.update({
          where: { id: rule.id },
          data: { currentVersionId: version2.id },
        });
      } else {
        // Update rule to point to initial version
        await prisma.rule.update({
          where: { id: rule.id },
          data: { currentVersionId: version1.id },
        });
      }
    }

    console.log(`✅ Created ${ruleVersions.length} rule versions`);

    // Create Rule Tags (many-to-many relationships)
    console.log("🔗 Creating rule-tag relationships...");
    const ruleTagRelations = [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const numTags = Math.floor(Math.random() * 3) + 1; // 1-3 tags per rule
      const selectedTags = faker.helpers.arrayElements(tags, numTags);

      for (const tag of selectedTags) {
        await prisma.ruleTag.create({
          data: {
            ruleId: rule.id,
            tagId: tag.id,
          },
        });
        ruleTagRelations.push({ ruleId: rule.id, tagId: tag.id });
      }
    }

    console.log(`✅ Created ${ruleTagRelations.length} rule-tag relationships`);

    // Create Resource Links
    console.log("🔗 Creating resource links...");
    const resourceLinks = [];

    for (const rule of rules.slice(0, 10)) {
      // Add links to first 10 rules
      const links = [
        {
          ruleId: rule.id,
          label: "Official Documentation",
          url: `https://docs.example.com/${rule.slug}`,
          kind: "DOCS",
        },
        {
          ruleId: rule.id,
          label: "GitHub Repository",
          url: `https://github.com/example/${rule.slug}`,
          kind: "GITHUB",
        },
        {
          ruleId: rule.id,
          label: "Tutorial Video",
          url: `https://youtube.com/watch?v=${rule.slug}`,
          kind: "VIDEO",
        },
      ];

      for (const link of links) {
        const resourceLink = await prisma.resourceLink.create({
          data: {
            id: generateId(),
            ...link,
          },
        });
        resourceLinks.push(resourceLink);
      }
    }

    console.log(`✅ Created ${resourceLinks.length} resource links`);

    // Create Comments (with threading)
    console.log("💬 Creating comments...");
    const comments = [];

    for (const rule of rules.slice(0, 15)) {
      // Add comments to first 15 rules
      const numComments = Math.floor(Math.random() * 4) + 1; // 1-4 comments per rule

      for (let i = 0; i < numComments; i++) {
        const author = faker.helpers.arrayElement(users);
        const comment = await prisma.comment.create({
          data: {
            id: generateId(),
            ruleId: rule.id,
            authorUserId: author.id,
            body: generateCommentBody(),
            createdAt: faker.date.recent({ days: 30 }),
          },
        });
        comments.push(comment);

        // Sometimes add a reply
        if (Math.random() < 0.3) {
          const replyAuthor = faker.helpers.arrayElement(
            users.filter((u) => u.id !== author.id)
          );
          const reply = await prisma.comment.create({
            data: {
              id: generateId(),
              ruleId: rule.id,
              parentId: comment.id,
              authorUserId: replyAuthor.id,
              body: generateReplyBody(),
              createdAt: faker.date.recent({ days: 25 }),
            },
          });
          comments.push(reply);
        }
      }
    }

    console.log(`✅ Created ${comments.length} comments`);

    // Create Votes
    console.log("👍 Creating votes...");
    const votes = [];

    for (const rule of rules.slice(0, 18)) {
      // Add votes to first 18 rules
      const numVotes = Math.floor(Math.random() * 8) + 2; // 2-9 votes per rule
      const votingUsers = faker.helpers.arrayElements(
        users,
        Math.min(numVotes, users.length)
      );

      for (const user of votingUsers) {
        const vote = await prisma.vote.create({
          data: {
            userId: user.id,
            ruleId: rule.id,
            value: Math.random() < 0.8 ? 1 : -1, // 80% upvotes
          },
        });
        votes.push(vote);
      }
    }

    console.log(`✅ Created ${votes.length} votes`);

    // Create Favorites
    console.log("⭐ Creating favorites...");
    const favorites = [];

    for (const rule of rules.slice(0, 12)) {
      // Add favorites to first 12 rules
      const numFavorites = Math.floor(Math.random() * 3) + 1; // 1-3 favorites per rule
      const favoritingUsers = faker.helpers.arrayElements(
        users,
        Math.min(numFavorites, users.length)
      );

      for (const user of favoritingUsers) {
        const favorite = await prisma.favorite.create({
          data: {
            userId: user.id,
            ruleId: rule.id,
          },
        });
        favorites.push(favorite);
      }
    }

    console.log(`✅ Created ${favorites.length} favorites`);

    // Create Follows
    console.log("👥 Creating follow relationships...");
    const follows = [];

    // Create some follow relationships
    const followPairs = [
      { follower: users[0], author: users[1] },
      { follower: users[0], author: users[2] },
      { follower: users[1], author: users[2] },
      { follower: users[3], author: users[1] },
      { follower: users[3], author: users[2] },
      { follower: users[4], author: users[1] },
      { follower: users[4], author: users[0] },
    ];

    for (const pair of followPairs) {
      const follow = await prisma.follow.create({
        data: {
          followerUserId: pair.follower.id,
          authorUserId: pair.author.id,
        },
      });
      follows.push(follow);
    }

    console.log(`✅ Created ${follows.length} follow relationships`);

    // Create Watch relationships
    console.log("👀 Creating watch relationships...");
    const watches = [];

    for (const rule of rules.slice(0, 8)) {
      // Add watches to first 8 rules
      const numWatches = Math.floor(Math.random() * 2) + 1; // 1-2 watches per rule
      const watchingUsers = faker.helpers.arrayElements(
        users,
        Math.min(numWatches, users.length)
      );

      for (const user of watchingUsers) {
        const watch = await prisma.watch.create({
          data: {
            userId: user.id,
            ruleId: rule.id,
          },
        });
        watches.push(watch);
      }
    }

    console.log(`✅ Created ${watches.length} watch relationships`);

    // Create Events (7 days of data)
    console.log("📊 Creating event data...");
    const events = [];
    const eventTypes = ["VIEW", "COPY", "SAVE", "FORK", "COMMENT", "VOTE"];

    for (let day = 0; day < 7; day++) {
      const date = new Date();
      date.setDate(date.getDate() - day);

      const numEvents = Math.floor(Math.random() * 50) + 20; // 20-69 events per day

      for (let i = 0; i < numEvents; i++) {
        const eventType = faker.helpers.arrayElement(eventTypes);
        const rule = faker.helpers.arrayElement(rules);
        const user =
          Math.random() < 0.7 ? faker.helpers.arrayElement(users) : null; // 70% logged in users

        const event = await prisma.event.create({
          data: {
            id: generateId(),
            userId: user?.id || null,
            ruleId: rule.id,
            ruleVersionId: Math.random() < 0.8 ? rule.currentVersionId : null,
            type: eventType as any,
            ipHash: faker.internet
              .ipv4()
              .split(".")
              .map((n) => parseInt(n).toString(16).padStart(2, "0"))
              .join(""),
            uaHash: faker.string.alphanumeric(32),
            createdAt: faker.date.between({
              from: new Date(date.getTime()),
              to: new Date(date.getTime() + 24 * 60 * 60 * 1000),
            }),
          },
        });
        events.push(event);
      }
    }

    console.log(`✅ Created ${events.length} events`);

    // Create Badges
    console.log("🏆 Creating badges...");
    const badgeData = [
      {
        slug: "first-rule",
        name: "First Rule",
        description: "Created your first rule",
        criteria: { type: "rule_count", threshold: 1 },
      },
      {
        slug: "popular-author",
        name: "Popular Author",
        description: "Received 100+ votes on your rules",
        criteria: { type: "total_votes", threshold: 100 },
      },
      {
        slug: "helpful-commenter",
        name: "Helpful Commenter",
        description: "Made 50+ helpful comments",
        criteria: { type: "comment_count", threshold: 50 },
      },
      {
        slug: "early-adopter",
        name: "Early Adopter",
        description: "Joined in the first month",
        criteria: { type: "join_date", before: "2024-02-01" },
      },
      {
        slug: "verified-author",
        name: "Verified Author",
        description: "Verified author with quality contributions",
        criteria: { type: "verified", value: true },
      },
    ];

    const badges = await Promise.all(
      badgeData.map((badge) =>
        prisma.badge.create({
          data: {
            id: generateId(),
            ...badge,
          },
        })
      )
    );

    console.log(`✅ Created ${badges.length} badges`);

    // Award some badges to users
    console.log("🎖️ Awarding badges...");
    const userBadges = [];

    // Award "First Rule" badge to users with rules
    const usersWithRules = [...new Set(rules.map((r) => r.createdByUserId))];
    for (const userId of usersWithRules) {
      const userBadge = await prisma.userBadge.create({
        data: {
          userId,
          badgeId: badges[0].id, // First Rule badge
          awardedAt: faker.date.recent({ days: 20 }),
        },
      });
      userBadges.push(userBadge);
    }

    // Award "Verified Author" badge to verified users
    for (const profile of authorProfiles) {
      const userBadge = await prisma.userBadge.create({
        data: {
          userId: profile.userId,
          badgeId: badges[4].id, // Verified Author badge
          awardedAt: profile.claimedAt || new Date(),
        },
      });
      userBadges.push(userBadge);
    }

    console.log(`✅ Awarded ${userBadges.length} badges`);

    // Create some Donations
    console.log("💰 Creating donations...");
    const donations = [];

    for (let i = 0; i < 5; i++) {
      const fromUser = faker.helpers.arrayElement(users);
      const toUser = faker.helpers.arrayElement(
        users.filter((u) => u.id !== fromUser.id)
      );
      const rule = faker.helpers.arrayElement(rules);

      const donation = await prisma.donation.create({
        data: {
          id: generateId(),
          fromUserId: fromUser.id,
          toUserId: toUser.id,
          ruleId: rule.id,
          amountCents: faker.number.int({ min: 100, max: 5000 }), // $1-$50
          currency: "USD",
          status: faker.helpers.arrayElement(["INIT", "SUCCEEDED", "FAILED"]),
          provider: "STRIPE",
          providerRef: `pi_${faker.string.alphanumeric(24)}`,
          createdAt: faker.date.recent({ days: 30 }),
        },
      });
      donations.push(donation);
    }

    console.log(`✅ Created ${donations.length} donations`);

    // Create Rule Metrics (aggregate from events)
    console.log("📈 Creating rule metrics...");
    const ruleMetrics = [];

    for (let day = 0; day < 7; day++) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      const dateOnly = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );

      for (const rule of rules.slice(0, 15)) {
        // Metrics for first 15 rules
        const dayEvents = events.filter(
          (e) =>
            e.ruleId === rule.id &&
            e.createdAt.toDateString() === date.toDateString()
        );

        const views = dayEvents.filter((e) => e.type === "VIEW").length;
        const copies = dayEvents.filter((e) => e.type === "COPY").length;
        const saves = dayEvents.filter((e) => e.type === "SAVE").length;
        const forks = dayEvents.filter((e) => e.type === "FORK").length;
        const voteEvents = dayEvents.filter((e) => e.type === "VOTE").length;

        // Calculate score based on weighted activities
        const score =
          views * 1 + copies * 3 + saves * 2 + forks * 5 + voteEvents * 4;

        if (
          views > 0 ||
          copies > 0 ||
          saves > 0 ||
          forks > 0 ||
          voteEvents > 0
        ) {
          const metric = await prisma.ruleMetricDaily.create({
            data: {
              date: dateOnly,
              ruleId: rule.id,
              views,
              copies,
              saves,
              forks,
              votes: voteEvents,
              score,
            },
          });
          ruleMetrics.push(metric);
        }
      }
    }

    console.log(`✅ Created ${ruleMetrics.length} rule metrics`);

    // Refresh full-text search for all rules
    console.log("🔍 Refreshing full-text search...");
    await refreshAllRuleSearch();
    console.log("✅ Full-text search refreshed");

    console.log("🎉 Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`- Users: ${users.length}`);
    console.log(`- Author Profiles: ${authorProfiles.length}`);
    console.log(`- Sources: ${sources.length}`);
    console.log(`- Tags: ${tags.length}`);
    console.log(`- Rules: ${rules.length}`);
    console.log(`- Rule Versions: ${ruleVersions.length}`);
    console.log(`- Rule-Tag Relations: ${ruleTagRelations.length}`);
    console.log(`- Resource Links: ${resourceLinks.length}`);
    console.log(`- Comments: ${comments.length}`);
    console.log(`- Votes: ${votes.length}`);
    console.log(`- Favorites: ${favorites.length}`);
    console.log(`- Follows: ${follows.length}`);
    console.log(`- Watches: ${watches.length}`);
    console.log(`- Events: ${events.length}`);
    console.log(`- Badges: ${badges.length}`);
    console.log(`- User Badges: ${userBadges.length}`);
    console.log(`- Donations: ${donations.length}`);
    console.log(`- Rule Metrics: ${ruleMetrics.length}`);
  } catch (error) {
    console.error("❌ Seeding failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper functions for generating content
function generateRuleBody(
  title: string,
  summary: string,
  enhanced = false
): string {
  const baseContent = `# ${title}

${summary}

## Prompt Template

\`\`\`
You are an expert assistant specializing in ${title.toLowerCase()}.

Context: {context}
Task: {task}
Requirements: {requirements}

Please provide a comprehensive response that:
1. Addresses the specific requirements
2. Includes practical examples
3. Follows best practices
4. Provides clear explanations

Response format: {format}
\`\`\`

## Usage Examples

### Example 1: Basic Usage
\`\`\`
Context: Web application development
Task: Review code for security vulnerabilities
Requirements: Focus on authentication and data validation
Format: Structured report with severity levels
\`\`\`

### Example 2: Advanced Usage
\`\`\`
Context: Enterprise application
Task: Comprehensive security audit
Requirements: Include OWASP Top 10 analysis
Format: Executive summary with detailed findings
\`\`\`

## Best Practices

- Always provide specific, actionable feedback
- Include examples when possible
- Consider edge cases and error handling
- Follow industry standards and guidelines

## Tips for Better Results

- Be specific in your context and requirements
- Use clear, concise language
- Provide relevant background information
- Specify the desired output format`;

  if (enhanced) {
    return (
      baseContent +
      `

## Version 1.1 Improvements

- Enhanced prompt clarity and structure
- Added support for multiple AI models
- Improved example scenarios
- Better error handling guidance
- Extended best practices section

## Model-Specific Notes

### GPT-4
- Excellent for complex analysis and reasoning
- Provide detailed context for best results

### Claude-3-Sonnet
- Great for structured outputs
- Works well with step-by-step instructions

### Claude-3-Haiku
- Fast and efficient for simpler tasks
- Good for standardized formats`
    );
  }

  return baseContent;
}

function generateCommentBody(): string {
  const comments = [
    "This is incredibly helpful! I've been struggling with this exact problem for weeks.",
    "Great work on this prompt. The examples really clarify how to use it effectively.",
    "I tried this with GPT-4 and the results were amazing. Thanks for sharing!",
    "Could you add an example for handling edge cases? That would make this even better.",
    "This saved me hours of work. The structured approach is exactly what I needed.",
    "Excellent prompt engineering. The step-by-step format produces consistent results.",
    "I've been using this for my projects and it's become my go-to solution.",
    "The clarity of instructions here is outstanding. Very well documented.",
    "This works great with Claude too. Have you tested it with other models?",
    "Perfect timing! I was just looking for something like this for my team.",
  ];

  return faker.helpers.arrayElement(comments);
}

function generateReplyBody(): string {
  const replies = [
    "Thanks for the feedback! I'm glad you found it useful.",
    "Great suggestion! I'll add that example in the next version.",
    "Yes, I've tested it with Claude and Gemini as well. Works great across models.",
    "I appreciate the kind words. Let me know if you have any other questions!",
    "That's awesome to hear! Feel free to share any improvements you discover.",
    "Thanks! I tried to make it as clear as possible based on my own experience.",
    "Glad it's working well for your team. That's exactly what I hoped for.",
    "You're welcome! Don't hesitate to reach out if you need any clarifications.",
  ];

  return faker.helpers.arrayElement(replies);
}

// Run the seeding script
if (require.main === module) {
  main();
}
