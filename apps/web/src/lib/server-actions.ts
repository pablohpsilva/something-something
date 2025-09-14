"use server";

import { redirect } from "next/navigation";
import { requireAuth, requireRole } from "./auth";
import { prisma } from "@repo/db";
import { validateHandle, isHandleAvailable } from "./handle";
import { z } from "zod";

// Validation schemas
const profileUpdateSchema = z.object({
  displayName: z.string().min(1).max(50),
  bio: z.string().max(500).optional(),
  handle: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/),
});

const onboardingSchema = z.object({
  handle: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(50),
  bio: z.string().max(500).optional(),
});

/**
 * Complete user onboarding
 */
export async function completeOnboarding(formData: FormData) {
  try {
    const user = await requireAuth();

    const data = {
      handle: formData.get("handle") as string,
      displayName: formData.get("displayName") as string,
      bio: (formData.get("bio") as string) || null,
    };

    // Validate input
    const result = onboardingSchema.safeParse(data);
    if (!result.success) {
      return { success: false, error: "Invalid input data" };
    }

    const { handle, displayName, bio } = result.data;

    // Validate handle format and availability
    if (!validateHandle(handle)) {
      return { success: false, error: "Invalid handle format" };
    }

    if (!(await isHandleAvailable(handle))) {
      return { success: false, error: "Handle is already taken" };
    }

    // Update user profile
    await prisma.user.update({
      where: { id: user.id },
      data: {
        handle,
        displayName,
        bio,
        // onboardedAt: new Date(), // Field doesn't exist in schema
      },
    });

    return { success: true, redirectTo: "/dashboard" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}

/**
 * Update user profile
 */
export async function updateProfile(formData: FormData) {
  try {
    const user = await requireAuth();
    const data = {
      displayName: formData.get("displayName") as string,
      bio: (formData.get("bio") as string) || null,
      handle: formData.get("handle") as string,
    };

    // Validate input
    const result = profileUpdateSchema.safeParse(data);
    if (!result.success) {
      return { success: false, error: "Invalid input data" };
    }

    const { handle, displayName, bio } = result.data;

    // If handle changed, validate it
    if (handle !== user.handle) {
      if (!validateHandle(handle)) {
        return { success: false, error: "Invalid handle format" };
      }

      if (!(await isHandleAvailable(handle))) {
        return { success: false, error: "Handle is already taken" };
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        handle,
        displayName,
        bio,
      },
    });

    return { success: true, user: updatedUser };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}
