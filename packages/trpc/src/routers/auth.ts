import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { auth } from "@repo/db/auth";

export const authRouter = createTRPCRouter({
  // Get current session
  getSession: publicProcedure.query(async ({ ctx }) => {
    return {
      session: ctx.session,
      user: ctx.authUser,
    };
  }),

  // Sign up with email and password
  signUp: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Generate a handle from the email (username part + random suffix for uniqueness)
        const emailUsername = input.email.split("@")[0].toLowerCase();
        const cleanHandle = emailUsername.replace(/[^a-z0-9_-]/g, "");
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const handle = `${cleanHandle}-${randomSuffix}`;

        // Use better-auth to create the user
        const result = await auth.api.signUpEmail({
          body: {
            email: input.email,
            password: input.password,
            displayName: input.name,
            handle: handle,
          },
        });

        if (result.error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error.message || "Failed to create account",
          });
        }

        return {
          user: result.user,
          session: result.session,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create account",
          cause: error,
        });
      }
    }),

  // Sign in with email and password
  signIn: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await auth.api.signInEmail({
          body: {
            email: input.email,
            password: input.password,
          },
        });

        return result;
      } catch (error) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
          cause: error,
        });
      }
    }),

  // Sign out
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "No active session",
      });
    }

    try {
      await auth.api.signOut({
        headers: {
          authorization: `Bearer ${(ctx.session as any)?.token || ""}`,
        },
      });

      return { success: true };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to sign out",
        cause: error,
      });
    }
  }),

  // Update profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(100).optional(),
        bio: z.string().max(500).optional(),
        avatarUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.authUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      try {
        const updatedUser = await ctx.prisma.user.update({
          where: { id: (ctx.authUser as any).id },
          data: {
            displayName: input.displayName,
            bio: input.bio,
            avatarUrl: input.avatarUrl,
          },
        });

        return updatedUser;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update profile",
          cause: error,
        });
      }
    }),

  // Change password
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active session",
        });
      }

      try {
        await auth.api.changePassword({
          body: {
            currentPassword: input.currentPassword,
            newPassword: input.newPassword,
          },
          headers: {
            authorization: `Bearer ${(ctx.session as any)?.token || ""}`,
          },
        });

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid current password or failed to change password",
          cause: error,
        });
      }
    }),
});
