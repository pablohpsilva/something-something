import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  publicProcedure,
  protectedProcedure,
  rateLimitedProcedure,
} from "../trpc";
import {
  voteRuleSchema,
  voteVersionSchema,
  voteScoreQuerySchema,
  userVotesQuerySchema,
  userVotesResponseSchema,
  voteValueToNumber,
} from "../schemas/vote";
import { voteSummaryDTOSchema } from "../schemas/dto";

// Rate limited procedure for votes (20 per minute)
const voteRateLimitedProcedure = rateLimitedProcedure("votes", 20);

export const votesRouter = router({
  upsertRuleVote: voteRateLimitedProcedure
    .input(voteRuleSchema)
    .output(voteSummaryDTOSchema)
    .mutation(async ({ input, ctx }) => {
      const { ruleId, value } = input;
      const userId = ctx.user!.id;
      const numericValue = voteValueToNumber(value);

      // Validate rule exists
      const rule = await ctx.prisma.rule.findUnique({
        where: { id: ruleId },
        select: { id: true },
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        });
      }

      // Perform vote operation in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        if (numericValue === 0) {
          // Remove vote
          await tx.vote.deleteMany({
            where: { userId, ruleId },
          });
        } else {
          // Upsert vote
          await tx.vote.upsert({
            where: {
              userId_ruleId: { userId, ruleId },
            },
            update: { value: numericValue },
            create: { userId, ruleId, value: numericValue },
          });
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: "vote.upsert",
            entityType: "rule",
            entityId: ruleId,
            userId,
            ipHash: ctx.reqIpHash,
            diff: {
              voteValue: numericValue,
              action: numericValue === 0 ? "remove" : "upsert",
            },
          },
        });

        // Get updated vote counts with single query
        const voteStats = await tx.vote.aggregate({
          where: { ruleId },
          _count: { value: true },
          _sum: { value: true },
        });

        const upCount = await tx.vote.count({
          where: { ruleId, value: 1 },
        });

        const downCount = await tx.vote.count({
          where: { ruleId, value: -1 },
        });

        const score = voteStats._sum.value || 0;

        // Get user's current vote
        const userVote = await tx.vote.findUnique({
          where: {
            userId_ruleId: { userId, ruleId },
          },
        });

        return {
          score,
          upCount,
          downCount,
          myVote: userVote?.value || 0,
        };
      });

      // Emit VOTE event to ingest (fire-and-forget, only for actual votes)
      if (numericValue !== 0) {
        try {
          const ingestBaseUrl = process.env.INGEST_BASE_URL;
          const ingestAppToken = process.env.INGEST_APP_TOKEN;

          if (ingestBaseUrl && ingestAppToken) {
            fetch(`${ingestBaseUrl}/ingest/events`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-app-token": ingestAppToken,
                "x-forwarded-for": ctx.reqIpHeader || "0.0.0.0",
                "user-agent": ctx.reqUAHeader || "",
              },
              body: JSON.stringify({
                events: [
                  {
                    type: "VOTE",
                    ruleId,
                    userId,
                    ts: new Date().toISOString(),
                  },
                ],
              }),
            }).catch(() => {}); // Fire-and-forget
          }
        } catch (error) {
          // Ignore ingest errors
        }
      }

      return result;
    }),

  upsertVersionVote: voteRateLimitedProcedure
    .input(voteVersionSchema)
    .output(voteSummaryDTOSchema)
    .mutation(async ({ input, ctx }) => {
      const { ruleVersionId, value } = input;
      const userId = ctx.user!.id;
      const numericValue = voteValueToNumber(value);

      // Validate version exists
      const version = await ctx.prisma.ruleVersion.findUnique({
        where: { id: ruleVersionId },
        select: { id: true, ruleId: true },
      });

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule version not found",
        });
      }

      // Perform vote operation in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        if (numericValue === 0) {
          // Remove vote
          await tx.voteVersion.deleteMany({
            where: { userId, ruleVersionId },
          });
        } else {
          // Upsert vote
          await tx.voteVersion.upsert({
            where: {
              userId_ruleVersionId: { userId, ruleVersionId },
            },
            update: { value: numericValue },
            create: { userId, ruleVersionId, value: numericValue },
          });
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: "vote.upsert",
            entityType: "rule_version",
            entityId: ruleVersionId,
            userId,
            ipHash: ctx.reqIpHash,
            diff: {
              voteValue: numericValue,
              action: numericValue === 0 ? "remove" : "upsert",
              ruleId: version.ruleId,
            },
          },
        });

        // Get updated vote counts
        const voteStats = await tx.voteVersion.aggregate({
          where: { ruleVersionId },
          _count: { value: true },
          _sum: { value: true },
        });

        const upCount = await tx.voteVersion.count({
          where: { ruleVersionId, value: 1 },
        });

        const downCount = await tx.voteVersion.count({
          where: { ruleVersionId, value: -1 },
        });

        const score = voteStats._sum.value || 0;

        // Get user's current vote
        const userVote = await tx.voteVersion.findUnique({
          where: {
            userId_ruleVersionId: { userId, ruleVersionId },
          },
        });

        return {
          score,
          upCount,
          downCount,
          myVote: userVote?.value || 0,
        };
      });

      // Emit VOTE event to ingest (fire-and-forget, only for actual votes)
      if (numericValue !== 0) {
        try {
          const ingestBaseUrl = process.env.INGEST_BASE_URL;
          const ingestAppToken = process.env.INGEST_APP_TOKEN;

          if (ingestBaseUrl && ingestAppToken) {
            fetch(`${ingestBaseUrl}/ingest/events`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-app-token": ingestAppToken,
                "x-forwarded-for": ctx.reqIpHeader || "0.0.0.0",
                "user-agent": ctx.reqUAHeader || "",
              },
              body: JSON.stringify({
                events: [
                  {
                    type: "VOTE",
                    ruleId: version.ruleId,
                    ruleVersionId,
                    userId,
                    ts: new Date().toISOString(),
                  },
                ],
              }),
            }).catch(() => {}); // Fire-and-forget
          }
        } catch (error) {
          // Ignore ingest errors
        }
      }

      return result;
    }),

  getRuleScore: publicProcedure
    .input(z.object({ ruleId: z.string() }))
    .output(voteSummaryDTOSchema)
    .query(async ({ input, ctx }) => {
      const { ruleId } = input;

      // Get vote counts efficiently
      const [voteStats, upCount, downCount] = await Promise.all([
        ctx.prisma.vote.aggregate({
          where: { ruleId },
          _sum: { value: true },
        }),
        ctx.prisma.vote.count({
          where: { ruleId, value: 1 },
        }),
        ctx.prisma.vote.count({
          where: { ruleId, value: -1 },
        }),
      ]);

      const score = voteStats._sum.value || 0;

      let myVote = 0;
      if (ctx.user) {
        const userVote = await ctx.prisma.vote.findUnique({
          where: {
            userId_ruleId: { userId: ctx.user.id, ruleId },
          },
        });
        myVote = userVote?.value || 0;
      }

      return {
        score,
        upCount,
        downCount,
        myVote,
      };
    }),

  getVersionScore: publicProcedure
    .input(z.object({ ruleVersionId: z.string() }))
    .output(voteSummaryDTOSchema)
    .query(async ({ input, ctx }) => {
      const { ruleVersionId } = input;

      // Get vote counts efficiently
      const [voteStats, upCount, downCount] = await Promise.all([
        ctx.prisma.voteVersion.aggregate({
          where: { ruleVersionId },
          _sum: { value: true },
        }),
        ctx.prisma.voteVersion.count({
          where: { ruleVersionId, value: 1 },
        }),
        ctx.prisma.voteVersion.count({
          where: { ruleVersionId, value: -1 },
        }),
      ]);

      const score = voteStats._sum.value || 0;

      let myVote = 0;
      if (ctx.user) {
        const userVote = await ctx.prisma.voteVersion.findUnique({
          where: {
            userId_ruleVersionId: { userId: ctx.user.id, ruleVersionId },
          },
        });
        myVote = userVote?.value || 0;
      }

      return {
        score,
        upCount,
        downCount,
        myVote,
      };
    }),

  getUserVotes: protectedProcedure
    .input(userVotesQuerySchema)
    .output(userVotesResponseSchema)
    .query(async ({ input, ctx }) => {
      const { ruleIds, ruleVersionIds } = input;
      const userId = ctx.user!.id;

      const ruleVotes: Record<string, number> = {};
      const versionVotes: Record<string, number> = {};

      if (ruleIds && ruleIds.length > 0) {
        const votes = await ctx.prisma.vote.findMany({
          where: {
            userId,
            ruleId: { in: ruleIds },
          },
        });

        for (const vote of votes) {
          ruleVotes[vote.ruleId] = vote.value;
        }
      }

      if (ruleVersionIds && ruleVersionIds.length > 0) {
        const votes = await ctx.prisma.voteVersion.findMany({
          where: {
            userId,
            ruleVersionId: { in: ruleVersionIds },
          },
        });

        for (const vote of votes) {
          versionVotes[vote.ruleVersionId] = vote.value;
        }
      }

      return { ruleVotes, versionVotes };
    }),
});
