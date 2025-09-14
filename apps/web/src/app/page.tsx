import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center py-12">
          <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
            Welcome to{" "}
            <span className="text-blue-600">Core Directory Engine</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            A comprehensive directory for AI prompts, rules, and guides.
            Discover, share, and collaborate on the best AI content.
          </p>
        </div>

        {/* Public Landing Page */}
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
                  Browse our comprehensive collection of AI prompts, rules, and
                  guides created by the community.
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
                  Share your knowledge and help others by contributing
                  high-quality prompts and rules.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Collaborate</CardTitle>
                <CardDescription>
                  Work together with the community
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Vote, comment, and improve content together to build the best
                  AI resource library.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Authentication Removed
              </h2>
              <p className="text-gray-600 mb-4">
                This application no longer requires authentication. Browse and
                explore the content freely.
              </p>
              <Link href="/rules">
                <Button size="lg">Browse Rules</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
