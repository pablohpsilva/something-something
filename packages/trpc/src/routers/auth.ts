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
        handle: z
          .string()
          .min(2)
          .max(50)
          .regex(/^[a-zA-Z0-9_-]+$/),
        displayName: z.string().min(1).max(100),
        bio: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Note: Handle validation would need to be implemented in Better-auth
        // For now, we'll let Better-auth handle the signup process

        const result = await auth.api.signUpEmail({
          body: {
            email: input.email,
            password: input.password,
            handle: input.handle,
            displayName: input.displayName,
            bio: input.bio,
          },
        });

        return result;
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
          authorization: `Bearer ${ctx.session.token}`,
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
          where: { id: ctx.authUser.id },
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
            authorization: `Bearer ${ctx.session.token}`,
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
