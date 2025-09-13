import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma, type User, type UserRole } from "@repo/db";
import { generateUniqueHandle, slugifyHandle } from "./handle";

export type AppUser = {
  id: string;
  clerkId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  emailPrimary?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Get authentication info or redirect to sign-in
 * Use this in server components/actions that require authentication
 */
export async function getAuthOrRedirect() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return { userId };
}

/**
 * Get optional authentication info
 * Returns auth if present, otherwise null
 */
export async function getOptionalAuth() {
  const { userId } = await auth();
  return userId ? { userId } : null;
}

/**
 * Get the current user from the server with database mirroring
 * This function ensures the user exists in our database and is up-to-date
 */
export async function getCurrentUserServer(): Promise<AppUser | null> {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  // Get primary email address
  const primaryEmail = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId
  );

  // Prepare user data for upsert
  const userData = {
    clerkId: clerkUser.id,
    displayName:
      clerkUser.fullName || clerkUser.username || clerkUser.firstName || "User",
    avatarUrl: clerkUser.imageUrl || null,
  };

  // Try to find existing user
  let dbUser = await prisma.user.findUnique({
    where: { clerkId: clerkUser.id },
  });

  if (!dbUser) {
    // Create new user - generate unique handle
    const baseHandle =
      clerkUser.username ||
      primaryEmail?.emailAddress.split("@")[0] ||
      clerkUser.firstName ||
      "user";

    const uniqueHandle = await generateUniqueHandle(baseHandle);

    dbUser = await prisma.user.create({
      data: {
        clerkId: clerkUser.id,
        handle: uniqueHandle,
        displayName: userData.displayName,
        avatarUrl: userData.avatarUrl,
        role: "USER", // Default role
      },
    });
  } else {
    // Update existing user if data has changed
    const needsUpdate =
      dbUser.displayName !== userData.displayName ||
      dbUser.avatarUrl !== userData.avatarUrl;

    if (needsUpdate) {
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          displayName: userData.displayName,
          avatarUrl: userData.avatarUrl,
        },
      });
    }
  }

  // Return AppUser with merged data
  return {
    id: dbUser.id,
    clerkId: dbUser.clerkId,
    handle: dbUser.handle,
    displayName: dbUser.displayName,
    avatarUrl: dbUser.avatarUrl,
    bio: dbUser.bio,
    role: dbUser.role,
    emailPrimary: primaryEmail?.emailAddress || null,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  };
}

/**
 * Require authentication and return current user
 * Redirects to sign-in if not authenticated
 */
export async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUserServer();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}

/**
 * Require specific role or redirect to forbidden page
 */
export async function requireRole(role: "MOD" | "ADMIN"): Promise<AppUser> {
  const user = await requireAuth();

  if (!hasRole(user, role)) {
    redirect("/forbidden");
  }

  return user;
}

/**
 * Check if user has the required role
 */
export function hasRole(user: AppUser, role: "MOD" | "ADMIN"): boolean {
  if (role === "ADMIN") {
    return user.role === "ADMIN";
  }

  if (role === "MOD") {
    return user.role === "MOD" || user.role === "ADMIN";
  }

  return false;
}

/**
 * Upsert user from Clerk webhook data
 * Used by the webhook endpoint to keep users in sync
 */
export async function upsertUserFromClerk(clerkData: {
  id: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  email_addresses?: Array<{
    id: string;
    email_address: string;
  }>;
  primary_email_address_id?: string | null;
}): Promise<User> {
  const displayName =
    [clerkData.first_name, clerkData.last_name].filter(Boolean).join(" ") ||
    clerkData.username ||
    "User";

  // Try to find existing user
  let dbUser = await prisma.user.findUnique({
    where: { clerkId: clerkData.id },
  });

  if (!dbUser) {
    // Create new user
    const baseHandle =
      clerkData.username ||
      clerkData.email_addresses
        ?.find((e) => e.id === clerkData.primary_email_address_id)
        ?.email_address.split("@")[0] ||
      clerkData.first_name ||
      "user";

    const uniqueHandle = await generateUniqueHandle(baseHandle);

    dbUser = await prisma.user.create({
      data: {
        clerkId: clerkData.id,
        handle: uniqueHandle,
        displayName,
        avatarUrl: clerkData.image_url || null,
        role: "USER",
      },
    });
  } else {
    // Update existing user (but don't change role via webhook)
    dbUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        displayName,
        avatarUrl: clerkData.image_url || null,
      },
    });
  }

  return dbUser;
}
