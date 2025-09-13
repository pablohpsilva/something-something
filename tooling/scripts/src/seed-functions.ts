import { prisma } from "@repo/db/client"; // Use the pre-configured prisma instance
import { generateId } from "@repo/utils";

export async function clearExistingData() {
  console.log("🧹 Clearing existing data...");

  // Clear in dependency order
  await prisma.userBadge.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.event.deleteMany();
  await prisma.ruleMetricDaily.deleteMany();
  await prisma.authorMetricDaily.deleteMany();
  await prisma.watch.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.voteVersion.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.resourceLink.deleteMany();
  await prisma.ruleTag.deleteMany();
  await prisma.ruleVersion.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.authorProfile.deleteMany();
  await prisma.user.deleteMany();

  console.log("✅ Existing data cleared");
}

export async function createUsers(userData: any[]) {
  console.log("👥 Creating users...");

  const users = [];
  for (const user of userData) {
    const newUser = await prisma.user.create({
      data: {
        id: generateId(),
        clerkId: user.clerkId,
        handle: user.handle,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        role: "USER",
      },
    });
    users.push(newUser);

    // Create author profile for verified users
    if (user.isVerified) {
      await prisma.authorProfile.create({
        data: {
          userId: newUser.id,
          isVerified: true,
          claimedAt: new Date(),
          website: `https://${user.handle}.dev`,
          github: `https://github.com/${user.handle}`,
          x: `https://twitter.com/${user.handle}`,
        },
      });
    }
  }

  console.log(
    `✅ Created ${users.length} users (${
      userData.filter((u) => u.isVerified).length
    } verified authors)`
  );
  return users;
}

export async function createTags(tagData: any[]) {
  console.log("🏷️ Creating tags...");

  const tags = [];
  for (const tag of tagData) {
    const newTag = await prisma.tag.create({
      data: {
        id: generateId(),
        name: tag.name,
        slug: tag.slug,
      },
    });
    tags.push(newTag);
  }

  console.log(`✅ Created ${tags.length} tags`);
  return tags;
}

export async function createBadges(badgeData: any[]) {
  console.log("🏆 Creating badges...");

  const badges = [];
  for (const badge of badgeData) {
    const newBadge = await prisma.badge.create({
      data: {
        id: generateId(),
        name: badge.name,
        slug: badge.slug,
        description: badge.description,
        criteria: badge.criteria,
      },
    });
    badges.push(newBadge);
  }

  console.log(`✅ Created ${badges.length} badges`);
  return badges;
}

export async function createRulesAndVersions(
  users: any[],
  tags: any[],
  ruleData: any[]
) {
  console.log("📝 Creating rules and versions...");

  const rules = [];
  const versions = [];

  for (let i = 0; i < ruleData.length; i++) {
    const rule = ruleData[i];
    const author = users[i % users.length];

    // Create rule
    const newRule = await prisma.rule.create({
      data: {
        id: generateId(),
        slug: rule.slug,
        title: rule.title,
        summary: rule.summary,
        contentType: rule.contentType,
        status: "PUBLISHED",
        primaryModel: rule.primaryModel,
        createdByUserId: author.id,
        createdAt: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        ),
      },
    });
    rules.push(newRule);

    // Create initial version
    const version1 = await prisma.ruleVersion.create({
      data: {
        id: generateId(),
        ruleId: newRule.id,
        version: "1.0.0",
        body: rule.body,
        testedOn: {
          models: [rule.primaryModel],
          stacks: ["web", "api"],
        },
        changelog: "Initial version",
        createdByUserId: author.id,
        createdAt: newRule.createdAt,
      },
    });
    versions.push(version1);

    // Create a second version for some rules
    if (i % 3 === 0) {
      const version2 = await prisma.ruleVersion.create({
        data: {
          id: generateId(),
          ruleId: newRule.id,
          version: "1.1.0",
          body:
            rule.body +
            "\n\n## Updates\n- Improved clarity and examples\n- Added edge case handling\n- Enhanced error messages",
          testedOn: {
            models: [rule.primaryModel, "gpt-3.5-turbo"],
            stacks: ["web", "api", "mobile"],
          },
          changelog:
            "Improved clarity, added examples, enhanced error handling",
          parentVersionId: version1.id,
          createdByUserId: author.id,
          createdAt: new Date(
            newRule.createdAt.getTime() +
              Math.random() * 7 * 24 * 60 * 60 * 1000
          ),
        },
      });
      versions.push(version2);

      // Update rule to use latest version
      await prisma.rule.update({
        where: { id: newRule.id },
        data: { currentVersionId: version2.id },
      });
    } else {
      // Update rule to use initial version
      await prisma.rule.update({
        where: { id: newRule.id },
        data: { currentVersionId: version1.id },
      });
    }

    // Add tags to rule
    const ruleTags = rule.tags.slice(0, 3);
    for (const tagSlug of ruleTags) {
      const tag = tags.find((t) => t.slug === tagSlug);
      if (tag) {
        await prisma.ruleTag.create({
          data: {
            ruleId: newRule.id,
            tagId: tag.id,
          },
        });
      }
    }

    // Add resource links for some rules
    if (i % 4 === 0) {
      await prisma.resourceLink.create({
        data: {
          id: generateId(),
          ruleId: newRule.id,
          label: "Official Documentation",
          url: `https://docs.example.com/${rule.slug}`,
          kind: "DOCS",
        },
      });
    }
  }

  console.log(
    `✅ Created ${rules.length} rules with ${versions.length} versions`
  );
  return { rules, versions };
}

export async function createInteractions(
  users: any[],
  rules: any[],
  versions: any[]
) {
  console.log("💬 Creating comments, votes, and social interactions...");

  const comments = [];
  const votes = [];
  const follows = [];
  const watches = [];
  const favorites = [];

  const sampleComments = [
    "This is incredibly helpful! I've been struggling with this exact problem.",
    "Great work! The examples really clarify the concept.",
    "Thanks for sharing this. Have you tested it with the latest model versions?",
    "This could be improved by adding error handling for edge cases.",
    "Excellent guide! I'll definitely be using this in my next project.",
    "Clear and concise. Exactly what I was looking for.",
    "Would love to see a video walkthrough of this process.",
    "This saved me hours of work. Much appreciated!",
  ];

  // Create comments
  const numComments = 30 + Math.floor(Math.random() * 21);
  for (let i = 0; i < numComments; i++) {
    const rule = rules[Math.floor(Math.random() * rules.length)];
    const author = users[Math.floor(Math.random() * users.length)];
    const commentText =
      sampleComments[Math.floor(Math.random() * sampleComments.length)];

    const comment = await prisma.comment.create({
      data: {
        id: generateId(),
        ruleId: rule.id,
        authorUserId: author.id,
        body: commentText,
        createdAt: new Date(
          Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000
        ),
      },
    });
    comments.push(comment);
  }

  // Create votes
  for (const rule of rules) {
    for (const user of users) {
      if (Math.random() < 0.7) {
        const voteValue = Math.random() < 0.8 ? "UP" : "DOWN";

        const vote = await prisma.vote.create({
          data: {
            userId: user.id,
            ruleId: rule.id,
            value: voteValue === "UP" ? 1 : -1,
          },
        });
        votes.push(vote);
      }
    }
  }

  // Create follows
  for (const follower of users) {
    for (const followee of users) {
      if (follower.id !== followee.id && Math.random() < 0.4) {
        const follow = await prisma.follow.create({
          data: {
            followerUserId: follower.id,
            authorUserId: followee.id,
          },
        });
        follows.push(follow);
      }
    }
  }

  // Create watches
  for (const user of users) {
    for (const rule of rules) {
      if (Math.random() < 0.3) {
        const watch = await prisma.watch.create({
          data: {
            userId: user.id,
            ruleId: rule.id,
          },
        });
        watches.push(watch);
      }
    }
  }

  // Create favorites
  for (const user of users) {
    for (const rule of rules) {
      if (Math.random() < 0.25) {
        const favorite = await prisma.favorite.create({
          data: {
            userId: user.id,
            ruleId: rule.id,
          },
        });
        favorites.push(favorite);
      }
    }
  }

  console.log(
    `✅ Created ${comments.length} comments, ${votes.length} votes, ${follows.length} follows, ${watches.length} watches, ${favorites.length} favorites`
  );
  return { comments, votes, follows, watches, favorites };
}

export async function createEventsAndDonations(
  users: any[],
  rules: any[],
  versions: any[]
) {
  console.log("📊 Creating events and donations...");

  const events = [];
  const donations = [];
  const eventTypes = ["VIEW", "COPY", "SAVE", "FORK"];

  // Create events
  const numEvents = 200 + Math.floor(Math.random() * 101);
  for (let i = 0; i < numEvents; i++) {
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const rule = rules[Math.floor(Math.random() * rules.length)];
    const user =
      Math.random() < 0.7
        ? users[Math.floor(Math.random() * users.length)]
        : null;
    const version =
      Math.random() < 0.6 ? versions.find((v) => v.ruleId === rule.id) : null;

    const event = await prisma.event.create({
      data: {
        id: generateId(),
        type: eventType,
        userId: user?.id,
        ruleId: rule.id,
        ruleVersionId: version?.id,
        ipHash: `hash_${Math.random().toString(36).substring(7)}`,
        uaHash: `ua_${Math.random().toString(36).substring(7)}`,
        createdAt: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        ),
      },
    });
    events.push(event);
  }

  // Create donations
  const numDonations = 15 + Math.floor(Math.random() * 11);
  for (let i = 0; i < numDonations; i++) {
    const donor = users[Math.floor(Math.random() * users.length)];
    const recipient = users[Math.floor(Math.random() * users.length)];
    const rule =
      Math.random() < 0.8
        ? rules[Math.floor(Math.random() * rules.length)]
        : null;

    if (donor.id !== recipient.id) {
      const amounts = [5, 10, 15, 20, 25, 50, 100];
      const amount = amounts[Math.floor(Math.random() * amounts.length)];

      const donation = await prisma.donation.create({
        data: {
          id: generateId(),
          fromUserId: donor.id,
          toUserId: recipient.id,
          ruleId: rule?.id,
          amountCents: amount * 100,
          currency: "USD",
          status: "INIT",
          provider: "STRIPE",
          providerRef: `pi_${Math.random().toString(36).substring(7)}`,
          createdAt: new Date(
            Date.now() - Math.random() * 25 * 24 * 60 * 60 * 1000
          ),
        },
      });
      donations.push(donation);
    }
  }

  console.log(
    `✅ Created ${events.length} events and ${donations.length} donations`
  );
  return { events, donations };
}

export async function createMetrics(rules: any[]) {
  console.log("📈 Creating metrics...");

  const ruleMetrics = [];
  const authorMetrics = [];

  // Create daily metrics for the last 30 days
  const days = 30;
  for (let day = 0; day < days; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);

    // Rule metrics
    for (const rule of rules) {
      const views = Math.floor(Math.random() * 50) + 1;
      const copies = Math.floor(Math.random() * 10);
      const saves = Math.floor(Math.random() * 5);
      const forks = Math.floor(Math.random() * 3);
      const votes = Math.floor(Math.random() * 8);
      const score = views * 1 + copies * 3 + saves * 2 + forks * 5 + votes * 2;

      const metric = await prisma.ruleMetricDaily.create({
        data: {
          date,
          ruleId: rule.id,
          views,
          copies,
          saves,
          forks,
          votes,
          score,
        },
      });
      ruleMetrics.push(metric);
    }

    // Author metrics
    const authorStats = new Map();
    for (const rule of rules) {
      if (!authorStats.has(rule.createdByUserId)) {
        authorStats.set(rule.createdByUserId, {
          views: 0,
          copies: 0,
          donations: 0,
        });
      }
      const stats = authorStats.get(rule.createdByUserId);
      stats.views += Math.floor(Math.random() * 20) + 1;
      stats.copies += Math.floor(Math.random() * 5);
      stats.donations += Math.floor(Math.random() * 100);
    }

    for (const [authorId, stats] of authorStats) {
      const metric = await prisma.authorMetricDaily.create({
        data: {
          date,
          authorUserId: authorId,
          views: stats.views,
          copies: stats.copies,
          donations: stats.donations,
        },
      });
      authorMetrics.push(metric);
    }
  }

  console.log(
    `✅ Created ${ruleMetrics.length} rule metrics and ${authorMetrics.length} author metrics`
  );
  return { ruleMetrics, authorMetrics };
}

export async function awardBadges(users: any[], badges: any[]) {
  console.log("🏆 Awarding badges...");

  const userBadges = [];

  // Award "Early Adopter" to first 3 users
  const earlyAdopterBadge = badges.find((b) => b.slug === "early-adopter");
  if (earlyAdopterBadge) {
    for (let i = 0; i < Math.min(3, users.length); i++) {
      const userBadge = await prisma.userBadge.create({
        data: {
          userId: users[i].id,
          badgeId: earlyAdopterBadge.id,
          awardedAt: new Date(
            Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
          ),
        },
      });
      userBadges.push(userBadge);
    }
  }

  // Award "Verified Author" to users with author profiles
  const verifiedBadge = badges.find((b) => b.slug === "verified-author");
  if (verifiedBadge) {
    const verifiedUsers = await prisma.user.findMany({
      where: { authorProfile: { isVerified: true } },
    });

    for (const user of verifiedUsers) {
      const userBadge = await prisma.userBadge.create({
        data: {
          userId: user.id,
          badgeId: verifiedBadge.id,
          awardedAt: new Date(
            Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000
          ),
        },
      });
      userBadges.push(userBadge);
    }
  }

  // Award random badges to some users
  const otherBadges = badges.filter(
    (b) => !["early-adopter", "verified-author"].includes(b.slug)
  );
  for (const user of users) {
    if (Math.random() < 0.6) {
      const badge = otherBadges[Math.floor(Math.random() * otherBadges.length)];

      const existing = await prisma.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId: user.id,
            badgeId: badge.id,
          },
        },
      });

      if (!existing) {
        const userBadge = await prisma.userBadge.create({
          data: {
            userId: user.id,
            badgeId: badge.id,
            awardedAt: new Date(
              Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000
            ),
          },
        });
        userBadges.push(userBadge);
      }
    }
  }

  console.log(`✅ Awarded ${userBadges.length} badges`);
  return userBadges;
}

export async function printSummary() {
  console.log("\n📊 Database Summary:");
  console.log("==================");

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.authorProfile.count(),
    prisma.tag.count(),
    prisma.badge.count(),
    prisma.rule.count(),
    prisma.ruleVersion.count(),
    prisma.comment.count(),
    prisma.vote.count(),
    prisma.voteVersion.count(),
    prisma.follow.count(),
    prisma.watch.count(),
    prisma.favorite.count(),
    prisma.event.count(),
    prisma.donation.count(),
    prisma.ruleMetricDaily.count(),
    prisma.authorMetricDaily.count(),
    prisma.userBadge.count(),
  ]);

  const [
    userCount,
    authorCount,
    tagCount,
    badgeCount,
    ruleCount,
    versionCount,
    commentCount,
    voteCount,
    voteVersionCount,
    followCount,
    watchCount,
    favoriteCount,
    eventCount,
    donationCount,
    ruleMetricCount,
    authorMetricCount,
    userBadgeCount,
  ] = counts;

  console.log(`👥 Users: ${userCount} (${authorCount} verified authors)`);
  console.log(`🏷️ Tags: ${tagCount}`);
  console.log(`🏆 Badges: ${badgeCount}`);
  console.log(`📝 Rules: ${ruleCount}`);
  console.log(`📄 Rule Versions: ${versionCount}`);
  console.log(`💬 Comments: ${commentCount}`);
  console.log(`👍 Votes: ${voteCount} (${voteVersionCount} version votes)`);
  console.log(`👥 Follows: ${followCount}`);
  console.log(`👀 Watches: ${watchCount}`);
  console.log(`⭐ Favorites: ${favoriteCount}`);
  console.log(`📊 Events: ${eventCount}`);
  console.log(`💰 Donations: ${donationCount}`);
  console.log(`📈 Rule Metrics: ${ruleMetricCount}`);
  console.log(`📊 Author Metrics: ${authorMetricCount}`);
  console.log(`🏆 User Badges: ${userBadgeCount}`);

  // Calculate totals
  const totalDonationAmount = await prisma.donation.aggregate({
    _sum: { amountCents: true },
  });

  const totalViews = await prisma.ruleMetricDaily.aggregate({
    _sum: { views: true },
  });

  console.log("\n💡 Key Metrics:");
  console.log(
    `💰 Total Donations: $${(
      (totalDonationAmount._sum.amountCents || 0) / 100
    ).toFixed(2)}`
  );
  console.log(`👀 Total Views: ${totalViews._sum.views || 0}`);

  console.log("\n🎉 Seeding completed successfully!");
  console.log("The platform is now populated with realistic demo data.");
}

export { prisma };
