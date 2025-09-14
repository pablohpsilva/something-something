import { redirect } from "next/navigation";
import { prisma, type User, type UserRole } from "@repo/db";
import { generateUniqueHandle, slugifyHandle } from "./handle";
import type { AppUser } from "./auth-types";

export type { AppUser } from "./auth-types";

/**
 * Get authentication info or redirect to sign-in
 * Use this in server components/actions that require authentication
 *
 * NOTE: Authentication has been removed. This function now returns null.
 */
export async function getAuthOrRedirect() {
  // Authentication removed - redirect to home or handle as needed
  redirect("/");
}

/**
 * Get optional authentication info
 * Returns auth if present, otherwise null
 *
 * NOTE: Authentication has been removed. This function now returns null.
 */
export async function getOptionalAuth() {
  return null;
}

/**
 * Get the current user from the server
 *
 * NOTE: Authentication has been removed. This function now returns null.
 */
export async function getCurrentUserServer(): Promise<AppUser | null> {
  return null;
}

/**
 * Require authentication and return current user
 * Redirects to home since authentication is removed
 */
export async function requireAuth(): Promise<AppUser> {
  // Authentication removed - redirect to home
  redirect("/");
}

/**
 * Require specific role or redirect to forbidden page
 *
 * NOTE: Authentication has been removed. This function now redirects to home.
 */
export async function requireRole(role: "MOD" | "ADMIN"): Promise<AppUser> {
  // Authentication removed - redirect to home
  redirect("/");
}

/**
 * Check if user has the required role
 *
 * NOTE: Authentication has been removed. This function now returns false.
 */
export function hasRole(user: AppUser, role: "MOD" | "ADMIN"): boolean {
  return false;
}
