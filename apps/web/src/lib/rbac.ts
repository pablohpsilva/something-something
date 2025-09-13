import { redirect } from "next/navigation";
import type { AppUser } from "./auth";

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
 * Assert that user has the required role, redirect if not
 */
export function assertRole(user: AppUser, role: "MOD" | "ADMIN"): void {
  if (!hasRole(user, role)) {
    redirect("/forbidden");
  }
}

/**
 * Check if user can perform admin actions
 */
export function canAdmin(user: AppUser): boolean {
  return user.role === "ADMIN";
}

/**
 * Check if user can perform moderation actions
 */
export function canModerate(user: AppUser): boolean {
  return user.role === "MOD" || user.role === "ADMIN";
}

/**
 * Check if user can edit a resource they own
 */
export function canEdit(user: AppUser, resourceOwnerId: string): boolean {
  // Users can edit their own content
  if (user.id === resourceOwnerId) {
    return true;
  }

  // Moderators and admins can edit any content
  return canModerate(user);
}

/**
 * Check if user can delete a resource
 */
export function canDelete(user: AppUser, resourceOwnerId: string): boolean {
  // Users can delete their own content
  if (user.id === resourceOwnerId) {
    return true;
  }

  // Moderators and admins can delete any content
  return canModerate(user);
}

/**
 * Check if user can manage other users
 */
export function canManageUsers(user: AppUser): boolean {
  return user.role === "ADMIN";
}

/**
 * Check if user can assign roles
 */
export function canAssignRoles(user: AppUser): boolean {
  return user.role === "ADMIN";
}

/**
 * Check if user can view admin dashboard
 */
export function canViewAdmin(user: AppUser): boolean {
  return canModerate(user);
}

/**
 * Get user's permissions as a simple object
 */
export function getUserPermissions(user: AppUser) {
  return {
    canAdmin: canAdmin(user),
    canModerate: canModerate(user),
    canManageUsers: canManageUsers(user),
    canAssignRoles: canAssignRoles(user),
    canViewAdmin: canViewAdmin(user),
    role: user.role,
  };
}
