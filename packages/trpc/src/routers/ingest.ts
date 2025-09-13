import { z } from "zod";
import {
  createTRPCRouter,
  rateLimitedProcedure,
  protectedProcedure,
} from "../server";

export const ingestRouter = createTRPCRouter({
  getEvents: protectedProcedure
    .input(
      z.object({
        processed: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(10),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const events = await ctx.db.ingestEvent.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        where: {
          processed: input.processed,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      let nextCursor: typeof input.cursor | undefined = undefined;
      if (events.length > input.limit) {
        const nextItem = events.pop();
        nextCursor = nextItem!.id;
      }

      return {
        events,
        nextCursor,
      };
    }),

  createEvent: rateLimitedProcedure
    .input(
      z.object({
        type: z.string().min(1),
        data: z.record(z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.ingestEvent.create({
        data: {
          type: input.type,
          data: input.data,
        },
      });
    }),

  markProcessed: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.ingestEvent.update({
        where: { id: input.id },
        data: { processed: true },
      });
    }),

  batchMarkProcessed: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.ingestEvent.updateMany({
        where: { id: { in: input.ids } },
        data: { processed: true },
      });
    }),
});
