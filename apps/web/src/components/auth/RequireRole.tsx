"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { hasRole } from "@/lib/rbac";
import type { AppUser } from "@/lib/auth-types";

interface RequireRoleProps {
  role: "MOD" | "ADMIN";
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireRole({ role, children, fallback }: RequireRoleProps) {
  const { user: clerkUser, isLoaded } = useUser();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAppUser() {
      if (!clerkUser) {
        setLoading(false);
        return;
      }

      try {
        // Fetch the app user data from our API
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const userData = await response.json();
          setAppUser(userData);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (isLoaded) {
      fetchAppUser();
    }
  }, [clerkUser, isLoaded]);

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!clerkUser || !appUser) {
    return (
      fallback || (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Access Denied
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              You need to be signed in to access this content.
            </p>
          </div>
        </div>
      )
    );
  }

  if (!hasRole(appUser, role)) {
    return (
      fallback || (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Insufficient Permissions
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              You don't have the required permissions to access this content.
            </p>
            <p className="mt-1 text-xs text-gray-500">Required role: {role}</p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
