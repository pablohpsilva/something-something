# Better-auth Protected Procedures Guide

This guide explains how to use the enhanced authentication system in tRPC with Better-auth.

## Available Protected Procedures

### Basic Authentication

#### `protectedProcedure`

Requires user to be logged in with a valid session.

```typescript
import { protectedProcedure } from "@repo/trpc";

export const myRouter = router({
  getUserProfile: protectedProcedure.query(async ({ ctx }) => {
    // ctx.authUser is guaranteed to exist
    return ctx.authUser;
  }),
});
```

#### `verifiedProcedure`

Requires user to be logged in AND have verified their email.

```typescript
import { verifiedProcedure } from "@repo/trpc";

export const myRouter = router({
  createPost: verifiedProcedure
    .input(createPostSchema)
    .mutation(async ({ ctx, input }) => {
      // User is authenticated and email verified
    }),
});
```

#### `completeProcedure`

Requires user to be logged in, email verified, AND have complete profile (handle, displayName).

```typescript
import { completeProcedure } from "@repo/trpc";

export const myRouter = router({
  publishContent: completeProcedure
    .input(publishSchema)
    .mutation(async ({ ctx, input }) => {
      // User has complete profile setup
    }),
});
```

### Role-Based Authentication

#### `modProcedure`

Requires MOD or ADMIN role.

```typescript
import { modProcedure } from "@repo/trpc";

export const adminRouter = router({
  moderateContent: modProcedure
    .input(moderateSchema)
    .mutation(async ({ ctx, input }) => {
      // User has moderation privileges
    }),
});
```

#### `adminProcedure`

Requires ADMIN role only.

```typescript
import { adminProcedure } from "@repo/trpc";

export const adminRouter = router({
  deleteUser: adminProcedure
    .input(deleteUserSchema)
    .mutation(async ({ ctx, input }) => {
      // User has admin privileges
    }),
});
```

### Rate-Limited Procedures

#### `rateLimitedProcedure`

Basic protected procedure with rate limiting (10 requests/minute).

```typescript
import { rateLimitedProcedure } from "@repo/trpc";

export const myRouter = router({
  updateProfile: rateLimitedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      // Rate limited to prevent abuse
    }),
});
```

#### `strictRateLimitedProcedure`

Stricter rate limiting (6 requests/minute) for sensitive operations.

```typescript
import { strictRateLimitedProcedure } from "@repo/trpc";

export const authRouter = router({
  changePassword: strictRateLimitedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      // Strict rate limiting for security
    }),
});
```

### Specialized Procedures

#### `contentCreationProcedure`

For creating content (requires complete profile + rate limiting).

```typescript
import { contentCreationProcedure } from "@repo/trpc";

export const rulesRouter = router({
  createRule: contentCreationProcedure
    .input(createRuleSchema)
    .mutation(async ({ ctx, input }) => {
      // User can create content
    }),
});
```

#### `discussionProcedure`

For comments and discussions (verified email + moderate rate limiting).

```typescript
import { discussionProcedure } from "@repo/trpc";

export const commentsRouter = router({
  createComment: discussionProcedure
    .input(createCommentSchema)
    .mutation(async ({ ctx, input }) => {
      // User can participate in discussions
    }),
});
```

#### `socialProcedure`

For social interactions (following, liking, etc.).

```typescript
import { socialProcedure } from "@repo/trpc";

export const socialRouter = router({
  followUser: socialProcedure
    .input(followSchema)
    .mutation(async ({ ctx, input }) => {
      // Social interaction with rate limiting
    }),
});
```

#### `votingProcedure`

For voting actions (higher rate limits).

```typescript
import { votingProcedure } from "@repo/trpc";

export const votesRouter = router({
  voteOnRule: votingProcedure
    .input(voteSchema)
    .mutation(async ({ ctx, input }) => {
      // Voting with appropriate rate limits
    }),
});
```

## Middleware Helpers

### `requireOwnershipOrMod`

Ensures user owns resource or has moderation privileges.

```typescript
import { requireOwnershipOrMod, protectedProcedure } from "@repo/trpc";

export const myRouter = router({
  editPost: protectedProcedure
    .input(editPostSchema)
    .use(requireOwnershipOrMod((input) => input.authorId))
    .mutation(async ({ ctx, input }) => {
      // User owns the post or is a moderator
    }),
});
```

### `audit` Middleware

Automatically logs actions for auditing.

```typescript
import { protectedProcedure, audit } from "@repo/trpc";

export const myRouter = router({
  deletePost: protectedProcedure
    .input(deletePostSchema)
    .use(audit("post.delete"))
    .mutation(async ({ ctx, input }) => {
      // Action will be logged to audit_logs table
    }),
});
```

## Helper Functions

### `getCurrentUser(ctx)`

Safely get current authenticated user.

```typescript
import { getCurrentUser } from "@repo/trpc";

// In any protected procedure
const user = getCurrentUser(ctx);
console.log(user.id, user.handle, user.role);
```

### `getCurrentUserId(ctx)`

Get just the user ID.

```typescript
import { getCurrentUserId } from "@repo/trpc";

const userId = getCurrentUserId(ctx);
```

### `canUserEditResource(ctx, resourceUserId)`

Check if user can edit a resource.

```typescript
import { canUserEditResource } from "@repo/trpc";

const canEdit = await canUserEditResource(ctx, post.authorId);
if (!canEdit) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Cannot edit this post",
  });
}
```

## Custom Rate-Limited Procedures

Create custom procedures with specific requirements:

```typescript
import { createRateLimitedProcedure, protectedProcedure } from "@repo/trpc";

// Custom procedure for file uploads
const fileUploadProcedure = createRateLimitedProcedure(
  protectedProcedure,
  "fileUpload",
  {
    limit: 5, // 5 uploads
    windowMs: 60 * 1000, // per minute
    requireVerified: true,
    requireComplete: true,
  }
);

export const filesRouter = router({
  uploadAvatar: fileUploadProcedure
    .input(uploadSchema)
    .mutation(async ({ ctx, input }) => {
      // Custom rate-limited file upload
    }),
});
```

## Error Handling

The auth procedures provide detailed error messages:

- `UNAUTHORIZED`: Not logged in
- `FORBIDDEN`: Logged in but insufficient permissions
- `TOO_MANY_REQUESTS`: Rate limit exceeded

```typescript
// Errors are automatically thrown with helpful messages:
// "Authentication required. Please sign in to continue."
// "Please verify your email address to access this feature."
// "This action requires moderator privileges. Your current role: user."
// "Rate limit exceeded. Try again in 45 seconds."
```

## Migration from Old Procedures

Replace old procedures with new enhanced ones:

```typescript
// Old way
import { protectedProcedure } from "../trpc";

// New way - more specific and secure
import {
  contentCreationProcedure, // For content creation
  discussionProcedure, // For comments/discussions
  socialProcedure, // For social interactions
  votingProcedure, // For voting
  moderationProcedure, // For mod actions
} from "@repo/trpc";
```

## Best Practices

1. **Use the most specific procedure** for your use case
2. **Always use audit middleware** for important actions
3. **Prefer ownership middleware** over manual checks
4. **Use helper functions** for consistent user access
5. **Handle rate limiting gracefully** in your frontend
6. **Provide clear error messages** to users

## Example: Complete Router

See `comments-enhanced.ts` for a complete example of a router using all these patterns.
