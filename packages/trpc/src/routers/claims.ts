import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, createRateLimitedProcedure } from "../trpc";
import { prisma } from "@repo/db/client";
import { AbuseConfig } from "@repo/config/abuse";

const claimCreateProcedure = createRateLimitedProcedure({
  windowMs: AbuseConfig.windows.claimsPerUserPerHour * 60 * 60 * 1000,
  maxRequests: AbuseConfig.limits.claimsPerUserPerHour,
});

export const claimsRouter = createTRPCRouter({
  /**
   * Submit an author claim for a rule
   */
  submit: claimCreateProcedure
    .input(
      z.object({
        ruleId: z.string(),
        evidence: z.string().min(10).max(2000, "Evidence must be between 10 and 2000 characters"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { ruleId, evidence } = input;

      // Check if rule exists and is published
      const rule = await prisma.rule.findUnique({
        where: { id: ruleId },
        include: {
          createdBy: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        });
      }

      if (rule.status !== "PUBLISHED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only claim published rules",
        });
      }

      // Check if user is already the author
      if (rule.createdByUserId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already the author of this rule",
        });
      }

      // Check if user has already submitted a claim for this rule
      const existingClaim = await prisma.authorClaim.findUnique({
        where: {
          ruleId_claimantId: {
            ruleId,
            claimantId: ctx.user.id,
          },
        },
      });

      if (existingClaim) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already submitted a claim for this rule",
        });
      }

      // Create the claim
      const claim = await prisma.authorClaim.create({
        data: {
          ruleId,
          claimantId: ctx.user.id,
          evidence,
          status: "PENDING",
        },
      });

      return {
        id: claim.id,
        status: claim.status,
        createdAt: claim.createdAt,
      };
    }),

  /**
   * Get user's submitted claims
   */
  getMyClaims: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const claims = await prisma.authorClaim.findMany({
        where: {
          claimantId: ctx.user.id,
        },
        include: {
          rule: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              displayName: true,
              handle: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: input.limit + 1,
        ...(input.cursor && {
          cursor: { id: input.cursor },
          skip: 1,
        }),
      });

      const hasMore = claims.length > input.limit;
      const items = hasMore ? claims.slice(0, -1) : claims;
      const nextCursor = hasMore ? items[items.length - 1]?.id : null;

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * Get claim details
   */
  getClaim: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const claim = await prisma.authorClaim.findUnique({
        where: { id: input.id },
        include: {
          rule: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              createdBy: {
                select: {
                  id: true,
                  displayName: true,
                  handle: true,
                },
              },
            },
          },
          claimant: {
            select: {
              id: true,
              displayName: true,
              handle: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              displayName: true,
              handle: true,
            },
          },
        },
      });

      if (!claim) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Claim not found",
        });
      }

      // Only allow claimant or admins to view claim details
      if (claim.claimantId !== ctx.user.id && ctx.user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to view this claim",
        });
      }

      return claim;
    }),

  /**
   * Get claims for a specific rule (public, limited info)
   */
  getClaimsForRule: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .query(async ({ input }) => {
      const claims = await prisma.authorClaim.findMany({
        where: {
          ruleId: input.ruleId,
          status: "APPROVED", // Only show approved claims
        },
        include: {
          claimant: {
            select: {
              id: true,
              displayName: true,
              handle: true,
            },
          },
        },
        orderBy: {
          reviewedAt: "desc",
        },
      });

      return claims;
    }),

  /**
   * Cancel a pending claim
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const claim = await prisma.authorClaim.findUnique({
        where: { id: input.id },
      });

      if (!claim) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Claim not found",
        });
      }

      if (claim.claimantId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to cancel this claim",
        });
      }

      if (claim.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only cancel pending claims",
        });
      }

      // Delete the claim (since it's pending and user wants to cancel)
      await prisma.authorClaim.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
