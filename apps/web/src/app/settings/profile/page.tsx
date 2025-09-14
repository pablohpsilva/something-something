import { redirect } from "next/navigation";
import { getCurrentUserServer } from "@/lib/auth";
import { ProfileForm } from "@/components/auth/ProfileForm";

// Force Node.js runtime for Prisma compatibility
export const runtime = "nodejs";

export default async function ProfileSettingsPage() {
  const user = await getCurrentUserServer();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Profile Settings
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage your account information and preferences
                </p>
              </div>
              {/* Authentication removed */}
            </div>
          </div>

          {/* Profile Form */}
          <div className="px-6 py-6">
            <ProfileForm user={user} />
          </div>

          {/* Account Management */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Account Management
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Email & Password
                  </p>
                  <p className="text-sm text-gray-500">
                    Manage your email and password settings
                  </p>
                </div>
                {/* Authentication removed */}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Account Status
                  </p>
                  <p className="text-sm text-gray-500">
                    Role:{" "}
                    <span className="font-medium capitalize">
                      {user.role.toLowerCase()}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    Joined {user.createdAt.toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
