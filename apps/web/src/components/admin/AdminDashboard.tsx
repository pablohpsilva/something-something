"use client";

import { RequireRole } from "@/components/auth/RequireRole";
import type { AppUser } from "@/lib/auth-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";

interface AdminDashboardProps {
  user: AppUser;
}

export function AdminDashboard({ user }: AdminDashboardProps) {
  return (
    <div className="space-y-6">
      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>Your Admin Access</CardTitle>
          <CardDescription>
            Current permissions and role information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div>
              {user.avatarUrl ? (
                <img
                  className="h-12 w-12 rounded-full object-cover"
                  src={user.avatarUrl}
                  alt={user.displayName}
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-lg font-medium text-gray-700">
                    {user.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">{user.displayName}</p>
              <p className="text-sm text-gray-500">@{user.handle}</p>
              <Badge
                variant={user.role === "ADMIN" ? "destructive" : "default"}
              >
                {user.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage user accounts and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RequireRole
              role="ADMIN"
              fallback={
                <p className="text-sm text-gray-500">Admin access required</p>
              }
            >
              <Button className="w-full">Manage Users</Button>
            </RequireRole>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content Moderation</CardTitle>
            <CardDescription>Review and moderate user content</CardDescription>
          </CardHeader>
          <CardContent>
            <RequireRole
              role="MOD"
              fallback={
                <p className="text-sm text-gray-500">
                  Moderator access required
                </p>
              }
            >
              <Button className="w-full">Moderate Content</Button>
            </RequireRole>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>
              View platform statistics and metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RequireRole
              role="MOD"
              fallback={
                <p className="text-sm text-gray-500">
                  Moderator access required
                </p>
              }
            >
              <Button className="w-full">View Analytics</Button>
            </RequireRole>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>Configure platform settings</CardDescription>
          </CardHeader>
          <CardContent>
            <RequireRole
              role="ADMIN"
              fallback={
                <p className="text-sm text-gray-500">Admin access required</p>
              }
            >
              <Button className="w-full">System Settings</Button>
            </RequireRole>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
            <CardDescription>Review user reports and flags</CardDescription>
          </CardHeader>
          <CardContent>
            <RequireRole
              role="MOD"
              fallback={
                <p className="text-sm text-gray-500">
                  Moderator access required
                </p>
              }
            >
              <Button className="w-full">View Reports</Button>
            </RequireRole>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Logs</CardTitle>
            <CardDescription>View system audit logs</CardDescription>
          </CardHeader>
          <CardContent>
            <RequireRole
              role="ADMIN"
              fallback={
                <p className="text-sm text-gray-500">Admin access required</p>
              }
            >
              <Button className="w-full">Audit Logs</Button>
            </RequireRole>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
          <CardDescription>Platform overview and key metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">-</p>
              <p className="text-sm text-gray-500">Total Users</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">-</p>
              <p className="text-sm text-gray-500">Active Rules</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">-</p>
              <p className="text-sm text-gray-500">Comments</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">-</p>
              <p className="text-sm text-gray-500">Reports</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500 text-center">
            Connect to analytics service to view real-time stats
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
