import { db } from "@repo/db"
import type { inferAsyncReturnType } from "@trpc/server"

/**
 * Creates context for tRPC requests
 * This is where you can add authentication, database connections, etc.
 */
export async function createTRPCContext(opts: {
  headers: Headers
  // Add more context options as needed
  userId?: string
}) {
  return {
    db,
    userId: opts.userId,
    headers: opts.headers,
  }
}

export type Context = inferAsyncReturnType<typeof createTRPCContext>
