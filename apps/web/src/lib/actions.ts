import { redirect } from "next/navigation";
import { getCurrentUserServer, requireAuth, requireRole } from "./auth";
import type { AppUser } from "./auth-types";
import { prisma } from "@repo/db";
import { validateHandle, isHandleAvailable } from "./handle";
import { z } from "zod";

/**
 * Wrapper for server actions that require authentication
 */
export function withAuth<T extends any[], R>(
  fn: (ctx: { user: AppUser }, ...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const user = await requireAuth();
    return fn({ user }, ...args);
  };
}

/**
 * Wrapper for server actions that require a specific role
 */
export function withRole<T extends any[], R>(
  role: "MOD" | "ADMIN",
  fn: (ctx: { user: AppUser }, ...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const user = await requireRole(role);
    return fn({ user }, ...args);
  };
}

// Validation schemas
const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(100, "Display name must be at most 100 characters"),
  bio: z.string().max(500, "Bio must be at most 500 characters").optional(),
  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(30, "Handle must be at most 30 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "Handle can only contain lowercase letters, numbers, and hyphens"
    )
    .optional(),
});

export type UpdateProfileResult = {
  success: boolean;
  error?: string;
  user?: AppUser;
};

/**
 * Update user profile server action
 */
export const updateProfile = withAuth(
  async ({ user }, formData: FormData): Promise<UpdateProfileResult> => {
    try {
      const data = {
        displayName: formData.get("displayName") as string,
        bio: (formData.get("bio") as string) || undefined,
        handle: (formData.get("handle") as string) || undefined,
      };

      // Validate input
      const validation = updateProfileSchema.safeParse(data);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || "Invalid input",
        };
      }

      const { displayName, bio, handle } = validation.data;

      // If handle is being changed, validate it
      if (handle && handle !== user.handle) {
        const handleValidation = validateHandle(handle);
        if (!handleValidation.isValid) {
          return {
            success: false,
            error: handleValidation.error,
          };
        }

        const isAvailable = await isHandleAvailable(handle, user.id);
        if (!isAvailable) {
          return {
            success: false,
            error: "This handle is already taken",
          };
        }
      }

      // Update user in database
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          displayName,
          bio: bio || null,
          ...(handle && handle !== user.handle ? { handle } : {}),
        },
      });

      // Return updated user data
      const appUser: AppUser = {
        id: updatedUser.id,
        clerkId: updatedUser.clerkId,
        handle: updatedUser.handle,
        displayName: updatedUser.displayName,
        avatarUrl: updatedUser.avatarUrl,
        bio: updatedUser.bio,
        role: updatedUser.role,
        emailPrimary: user.emailPrimary,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      };

      return {
        success: true,
        user: appUser,
      };
    } catch (error) {
      console.error("Error updating profile:", error);
      return {
        success: false,
        error: "Failed to update profile. Please try again.",
      };
    }
  }
);

const completeOnboardingSchema = z.object({
  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(30, "Handle must be at most 30 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "Handle can only contain lowercase letters, numbers, and hyphens"
    ),
});

export type CompleteOnboardingResult = {
  success: boolean;
  error?: string;
  redirectTo?: string;
};

/**
 * Complete onboarding server action
 */
export const completeOnboarding = withAuth(
  async ({ user }, formData: FormData): Promise<CompleteOnboardingResult> => {
    try {
      const data = {
        handle: formData.get("handle") as string,
      };

      // Validate input
      const validation = completeOnboardingSchema.safeParse(data);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || "Invalid handle",
        };
      }

      const { handle } = validation.data;

      // Validate handle
      const handleValidation = validateHandle(handle);
      if (!handleValidation.isValid) {
        return {
          success: false,
          error: handleValidation.error,
        };
      }

      // Check if handle is available
      const isAvailable = await isHandleAvailable(handle, user.id);
      if (!isAvailable) {
        return {
          success: false,
          error: "This handle is already taken. Please choose another one.",
        };
      }

      // Update user handle
      await prisma.user.update({
        where: { id: user.id },
        data: { handle },
      });

      return {
        success: true,
        redirectTo: "/",
      };
    } catch (error) {
      console.error("Error completing onboarding:", error);
      return {
        success: false,
        error: "Failed to complete onboarding. Please try again.",
      };
    }
  }
);

/**
 * Check if handle is available (for real-time validation)
 */
export const checkHandleAvailability = withAuth(
  async (
    { user },
    handle: string
  ): Promise<{ available: boolean; error?: string }> => {
    try {
      const handleValidation = validateHandle(handle);
      if (!handleValidation.isValid) {
        return {
          available: false,
          error: handleValidation.error,
        };
      }

      const isAvailable = await isHandleAvailable(handle, user.id);
      return { available: isAvailable };
    } catch (error) {
      console.error("Error checking handle availability:", error);
      return {
        available: false,
        error: "Failed to check availability",
      };
    }
  }
);

/**
 * Admin action to update user role
 */
export const updateUserRole = withRole(
  "ADMIN",
  async (
    { user: currentUser },
    userId: string,
    newRole: "USER" | "MOD" | "ADMIN"
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      // Prevent users from changing their own role
      if (currentUser.id === userId) {
        return {
          success: false,
          error: "You cannot change your own role",
        };
      }

      // Update user role
      await prisma.user.update({
        where: { id: userId },
        data: { role: newRole },
      });

      return { success: true };
    } catch (error) {
      console.error("Error updating user role:", error);
      return {
        success: false,
        error: "Failed to update user role",
      };
    }
  }
);
