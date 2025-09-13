import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  router,
  protectedProcedure,
  voteRateLimitedProcedure,
  audit,
} from "../trpc";
import {
  upsertRuleVoteSchema,
  upsertVersionVoteSchema,
  removeRuleVoteSchema,
  removeVersionVoteSchema,
  getRuleScoreSchema,
  getVersionScoreSchema,
  getUserVotesSchema,
} from "../schemas/vote";
import { voteSummaryDTOSchema } from "../schemas/dto";

export const votesRouter = router({
  // Upsert rule vote
  upsertRuleVote: voteRateLimitedProcedure
    .input(upsertRuleVoteSchema)
    .use(audit("vote.upsert"))
    .output(voteSummaryDTOSchema)
    .mutation(async ({ input, ctx }) => {
      const { ruleId, value } = input;

      // Check if rule exists and is not deleted
      const rule = await ctx.prisma.rule.findUnique({
        where: { id: ruleId, deletedAt: null },
        select: { id: true, status: true },
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        });
      }

      const voteValue = value === "up" ? 1 : -1;

      // Upsert vote and calculate new score in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Upsert the vote
        await tx.vote.upsert({
          where: {
            userId_ruleId: {
              userId: ctx.user.id,
              ruleId,
            },
          },
          update: { value: voteValue },
          create: {
            userId: ctx.user.id,
            ruleId,
            value: voteValue,
          },
        });

        // Record event
        await tx.event.create({
          data: {
            type: "VOTE",
            userId: ctx.user.id,
            ruleId,
            ipHash: ctx.reqIpHash,
            uaHash: ctx.uaHash,
          },
        });

        // Calculate new score
        const voteStats = await tx.vote.aggregate({
          where: { ruleId },
          _sum: { value: true },
          _count: { value: true },
        });

        const upVotes = await tx.vote.count({
          where: { ruleId, value: 1 },
        });

        const downVotes = await tx.vote.count({
          where: { ruleId, value: -1 },
        });

        const score = voteStats._sum.value || 0;

        // Update rule score
        await tx.rule.update({
          where: { id: ruleId },
          data: { score },
        });

        // Get user's current vote
        const userVote = await tx.vote.findUnique({
          where: {
            userId_ruleId: {
              userId: ctx.user.id,
              ruleId,
            },
          },
        });

        return {
          score,
          upCount: upVotes,
          downCount: downVotes,
          userVote: userVote ? (userVote.value > 0 ? "up" : "down") : null,
        };
      });

      return result;
    }),

  // Upsert version vote
  upsertVersionVote: voteRateLimitedProcedure
    .input(upsertVersionVoteSchema)
    .use(audit("vote.version.upsert"))
    .output(voteSummaryDTOSchema)
    .mutation(async ({ input, ctx }) => {
      const { ruleVersionId, value } = input;

      // Check if version exists
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

      const voteValue = value === "up" ? 1 : -1;

      // Upsert vote and calculate score
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Upsert the vote
        await tx.voteVersion.upsert({
          where: {
            userId_ruleVersionId: {
              userId: ctx.user.id,
              ruleVersionId,
            },
          },
          update: { value: voteValue },
          create: {
            userId: ctx.user.id,
            ruleVersionId,
            value: voteValue,
          },
        });

        // Record event
        await tx.event.create({
          data: {
            type: "VOTE",
            userId: ctx.user.id,
            ruleId: version.ruleId,
            ruleVersionId,
            ipHash: ctx.reqIpHash,
            uaHash: ctx.uaHash,
          },
        });

        // Calculate score
        const voteStats = await tx.voteVersion.aggregate({
          where: { ruleVersionId },
          _sum: { value: true },
        });

        const upVotes = await tx.voteVersion.count({
          where: { ruleVersionId, value: 1 },
        });

        const downVotes = await tx.voteVersion.count({
          where: { ruleVersionId, value: -1 },
        });

        // Get user's current vote
        const userVote = await tx.voteVersion.findUnique({
          where: {
            userId_ruleVersionId: {
              userId: ctx.user.id,
              ruleVersionId,
            },
          },
        });

        return {
          score: voteStats._sum.value || 0,
          upCount: upVotes,
          downCount: downVotes,
          userVote: userVote ? (userVote.value > 0 ? "up" : "down") : null,
        };
      });

      return result;
    }),

  // Remove rule vote
  removeRuleVote: voteRateLimitedProcedure
    .input(removeRuleVoteSchema)
    .use(audit("vote.remove"))
    .output(voteSummaryDTOSchema)
    .mutation(async ({ input, ctx }) => {
      const { ruleId } = input;

      const result = await ctx.prisma.$transaction(async (tx) => {
        // Remove the vote
        await tx.vote.deleteMany({
          where: {
            userId: ctx.user.id,
            ruleId,
          },
        });

        // Calculate new score
        const voteStats = await tx.vote.aggregate({
          where: { ruleId },
          _sum: { value: true },
        });

        const upVotes = await tx.vote.count({
          where: { ruleId, value: 1 },
        });

        const downVotes = await tx.vote.count({
          where: { ruleId, value: -1 },
        });

        const score = voteStats._sum.value || 0;

        // Update rule score
        await tx.rule.update({
          where: { id: ruleId },
          data: { score },
        });

        return {
          score,
          upCount: upVotes,
          downCount: downVotes,
          userVote: null,
        };
      });

      return result;
    }),

  // Get rule score
  getRuleScore: protectedProcedure
    .input(getRuleScoreSchema)
    .output(voteSummaryDTOSchema)
    .query(async ({ input, ctx }) => {
      const { ruleId, includeUserVote } = input;

      const [voteStats, upVotes, downVotes, userVote] = await Promise.all([
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
        includeUserVote
          ? ctx.prisma.vote.findUnique({
              where: {
                userId_ruleId: {
                  userId: ctx.user.id,
                  ruleId,
                },
              },
            })
          : null,
      ]);

      return {
        score: voteStats._sum.value || 0,
        upCount: upVotes,
        downCount: downVotes,
        userVote: userVote ? (userVote.value > 0 ? "up" : "down") : null,
      };
    }),

  // Get version score
  getVersionScore: protectedProcedure
    .input(getVersionScoreSchema)
    .output(voteSummaryDTOSchema)
    .query(async ({ input, ctx }) => {
      const { ruleVersionId, includeUserVote } = input;

      const [voteStats, upVotes, downVotes, userVote] = await Promise.all([
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
        includeUserVote
          ? ctx.prisma.voteVersion.findUnique({
              where: {
                userId_ruleVersionId: {
                  userId: ctx.user.id,
                  ruleVersionId,
                },
              },
            })
          : null,
      ]);

      return {
        score: voteStats._sum.value || 0,
        upCount: upVotes,
        downCount: downVotes,
        userVote: userVote ? (userVote.value > 0 ? "up" : "down") : null,
      };
    }),

  // Get user votes for multiple rules/versions
  getUserVotes: protectedProcedure
    .input(getUserVotesSchema)
    .output(
      z.object({
        ruleVotes: z.record(z.enum(["up", "down"])),
        versionVotes: z.record(z.enum(["up", "down"])),
      })
    )
    .query(async ({ input, ctx }) => {
      const { ruleIds, versionIds } = input;

      const [ruleVotes, versionVotes] = await Promise.all([
        ruleIds
          ? ctx.prisma.vote.findMany({
              where: {
                userId: ctx.user.id,
                ruleId: { in: ruleIds },
              },
              select: { ruleId: true, value: true },
            })
          : [],
        versionIds
          ? ctx.prisma.voteVersion.findMany({
              where: {
                userId: ctx.user.id,
                ruleVersionId: { in: versionIds },
              },
              select: { ruleVersionId: true, value: true },
            })
          : [],
      ]);

      return {
        ruleVotes: Object.fromEntries(
          ruleVotes.map((v) => [v.ruleId, v.value > 0 ? "up" : "down"])
        ),
        versionVotes: Object.fromEntries(
          versionVotes.map((v) => [
            v.ruleVersionId,
            v.value > 0 ? "up" : "down",
          ])
        ),
      };
    }),
});
