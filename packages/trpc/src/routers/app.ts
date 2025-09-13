import { createTRPCRouter } from "../server";
import { usersRouter } from "./users";
import { postsRouter } from "./posts";
import { ingestRouter } from "./ingest";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  users: usersRouter,
  posts: postsRouter,
  ingest: ingestRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
