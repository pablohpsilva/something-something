# Better-auth Integration

This document describes the Better-auth integration in the `@repo/db` and `@repo/trpc` packages.

## Overview

Better-auth provides modern, type-safe authentication for the application with support for:

- Email and password authentication
- Session management
- User profile management
- Role-based access control
- PostgreSQL database adapter

## Database Schema

The following tables are added to support Better-auth:

### `accounts`

- Stores authentication provider accounts
- Links to `users` table

### `sessions`

- Stores active user sessions
- Includes expiration and metadata

### `verifications`

- Stores email verification tokens and other verification data

### Updated `users` table

- Added `email` field (required, unique)
- Added `emailVerified` field (boolean)
- Added `image` field (optional avatar URL)
- Relations to `accounts` and `sessions`

## Configuration

The auth configuration is in `packages/db/src/auth.ts`:

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      handle: { type: "string", required: true, unique: true },
      displayName: { type: "string", required: true },
      avatarUrl: { type: "string", required: false },
      bio: { type: "string", required: false },
      role: { type: "string", required: true, defaultValue: "USER" },
    },
  },
});
```

## Usage

### In tRPC

The tRPC integration provides authentication middleware and context:

```typescript
import { createTRPCContext, protectedProcedure } from "@repo/trpc"

// Create context with auth
const ctx = await createTRPCContext({ req, res })

// Use protected procedures
const myProcedure = protectedProcedure
  .input(z.object({ ... }))
  .mutation(async ({ ctx, input }) => {
    // ctx.authUser and ctx.session are available
    console.log(ctx.authUser.id)
  })
```

### Authentication Routes

The auth router provides:

- `auth.signUp` - Create new account
- `auth.signIn` - Sign in with email/password
- `auth.signOut` - Sign out current session
- `auth.getSession` - Get current session
- `auth.updateProfile` - Update user profile
- `auth.changePassword` - Change password

### Middleware

Available middleware:

- `authMiddleware` - Require authentication
- `roleMiddleware(role)` - Require specific role
- `adminMiddleware` - Require ADMIN role
- `modMiddleware` - Require MOD or ADMIN role

## Migration

To migrate from Clerk:

1. Install dependencies: `better-auth`, `@better-auth/prisma`
2. Add Better-auth schema to Prisma
3. Run database migration: `pnpm db:migrate`
4. Update seed data to use email instead of clerkId
5. Update frontend to use Better-auth client

## Environment Variables

No additional environment variables required. Better-auth uses the existing `DATABASE_URL`.

## Security

- Sessions expire after 7 days
- Passwords are hashed using industry standards
- IP addresses and user agents are tracked for audit logs
- Rate limiting is applied to auth endpoints

## Type Safety

Better-auth provides full TypeScript support:

```typescript
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;
```

## Testing

Use the mock context for testing:

```typescript
import { createMockContext } from "@repo/trpc/context";

const ctx = createMockContext({
  userId: "test-user-id",
  userRole: "USER",
});
```
