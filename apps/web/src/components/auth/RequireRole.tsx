"use client";

import type { AppUser } from "@/lib/auth-types";

interface RequireRoleProps {
  role: "MOD" | "ADMIN";
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireRole({ role, children, fallback }: RequireRoleProps) {
  // Authentication has been removed - always show access denied
  return (
    fallback || (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-sm text-gray-600">
            Authentication has been removed from this application.
          </p>
          <p className="mt-1 text-xs text-gray-500">Required role: {role}</p>
        </div>
      </div>
    )
  );
}
