import Link from "next/link";
import { getCurrentUserServer } from "@/lib/auth";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";

// Force Node.js runtime for Prisma compatibility
export const runtime = "nodejs";

export default async function Home() {
  const user = await getCurrentUserServer();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                Core Directory Engine
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Authentication removed */}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            Welcome to{" "}
            <span className="text-blue-600">Core Directory Engine</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            A comprehensive directory for AI prompts, rules, and guides.
            Discover, share, and collaborate on the best AI content.
          </p>
        </div>

        {user ? (
          /* Authenticated User Dashboard */
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Your Profile</CardTitle>
                <CardDescription>
                  Manage your account and view your activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div>
                    {user.avatarUrl ? (
                      <img
                        className="h-16 w-16 rounded-full object-cover"
                        src={user.avatarUrl}
                        alt={user.displayName}
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-xl font-medium text-gray-700">
                          {user.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {user.displayName}
                    </h3>
                    <p className="text-sm text-gray-500">@{user.handle}</p>
                    <div className="mt-2 flex items-center space-x-2">
                      <Badge
                        variant={
                          user.role === "ADMIN"
                            ? "destructive"
                            : user.role === "MOD"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {user.role}
                      </Badge>
                      {user.emailPrimary && (
                        <span className="text-sm text-gray-500">
                          {user.emailPrimary}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Button asChild>
                      <Link href="/settings/profile">Edit Profile</Link>
                    </Button>
                    {(user.role === "MOD" || user.role === "ADMIN") && (
                      <Button variant="outline" asChild>
                        <Link href="/admin">Admin Dashboard</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Rules Created</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-600">0</p>
                  <p className="text-sm text-gray-500">Coming soon</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Favorites</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">0</p>
                  <p className="text-sm text-gray-500">Coming soon</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Comments</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-purple-600">0</p>
                  <p className="text-sm text-gray-500">Coming soon</p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Public Landing Page */
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Discover</CardTitle>
                  <CardDescription>
                    Find the best AI prompts and rules
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    Browse our comprehensive collection of AI prompts, rules,
                    and guides created by the community.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Share</CardTitle>
                  <CardDescription>Contribute your own content</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    Share your best prompts and rules with the community. Get
                    feedback and improve together.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Collaborate</CardTitle>
                  <CardDescription>Work together on better AI</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    Comment, vote, and collaborate on content. Build the future
                    of AI together.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="text-center">{/* Authentication removed */}</div>
          </div>
        )}
      </main>
    </div>
  );
}
