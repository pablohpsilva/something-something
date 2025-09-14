import type { UserRole } from "@repo/db";

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
