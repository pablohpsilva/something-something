import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "../server";

export const usersRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      select: {
        id: true,
        handle: true,
        displayName: true,
        createdAt: true,
      },
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          role: true,
          createdAt: true,
          rulesCreated: {
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        handle: z.string().min(1).max(50),
        displayName: z.string().min(1).max(100),
        avatarUrl: z.string().url().optional(),
        bio: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.create({
        data: {
          handle: input.handle,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          bio: input.bio,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        displayName: z.string().min(1).max(100).optional(),
        avatarUrl: z.string().url().optional(),
        bio: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: input.id },
        data: {
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          bio: input.bio,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.delete({
        where: { id: input.id },
      });
    }),
});
