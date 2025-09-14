import { Suspense } from "react";
import { createServerCaller } from "@/server/trpc";
import {
  RulesListExample,
  CreateRuleExample,
} from "./client-component-example";
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

/**
 * Server component that demonstrates server-side tRPC usage
 */
async function ServerSideExample() {
  const trpc = await createServerCaller();
  const user = null; // Authentication removed

  // Example: Get rules list on server
  const rulesData = await trpc.rules.list({
    limit: 5,
    sort: "new",
  });

  // Example: Get tags list
  const tagsData = await trpc.tags.list({
    limit: 10,
    includeCount: true,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Server-Side tRPC Data</CardTitle>
          <CardDescription>
            This data was fetched on the server using tRPC
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Authentication Status:</h4>
              <Badge variant="outline">Authentication Removed</Badge>
            </div>

            <div>
              <h4 className="font-semibold mb-2">
                Recent Rules ({rulesData.items.length}):
              </h4>
              {rulesData.items.length > 0 ? (
                <div className="space-y-2">
                  {rulesData.items.map((rule) => (
                    <div
                      key={rule.id}
                      className="border-l-4 border-blue-500 pl-4"
                    >
                      <div className="font-medium">{rule.title}</div>
                      <div className="text-sm text-gray-600">
                        {rule.summary}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">{rule.contentType}</Badge>
                        <Badge variant="outline">Score: {rule.score}</Badge>
                        <Badge variant="outline">
                          By @{rule.author.handle}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No rules found</p>
              )}
            </div>

            <div>
              <h4 className="font-semibold mb-2">
                Popular Tags ({tagsData.items.length}):
              </h4>
              <div className="flex flex-wrap gap-2">
                {tagsData.items.map((tag) => (
                  <Badge key={tag.id} variant="outline">
                    {tag.name} {tag.count && `(${tag.count})`}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Main examples page
 */
export default function ExamplesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            tRPC Integration Examples
          </h1>
          <p className="mt-2 text-gray-600">
            Demonstrating server-side and client-side tRPC usage in the Core
            Directory Engine
          </p>
        </div>

        <div className="space-y-8">
          {/* Server-side example */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">Server-Side Usage</h2>
            <Suspense
              fallback={
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="text-gray-500">Loading server data...</div>
                  </CardContent>
                </Card>
              }
            >
              <ServerSideExample />
            </Suspense>
          </section>

          {/* Client-side examples */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">Client-Side Usage</h2>
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <h3 className="text-xl font-medium mb-4">
                  Rules List with Search
                </h3>
                <RulesListExample />
              </div>

              <div>
                <h3 className="text-xl font-medium mb-4">Create New Rule</h3>
                <CreateRuleExample />
              </div>
            </div>
          </section>

          {/* API Information */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">API Information</h2>
            <Card>
              <CardHeader>
                <CardTitle>Available tRPC Routers</CardTitle>
                <CardDescription>
                  The following routers are available in the tRPC API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <h4 className="font-semibold">rules</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• list - Get paginated rules</li>
                      <li>• getBySlug - Get rule by slug</li>
                      <li>• create - Create new rule</li>
                      <li>• update - Update rule</li>
                      <li>• publish - Publish rule</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">votes</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• upsertRuleVote - Vote on rule</li>
                      <li>• upsertVersionVote - Vote on version</li>
                      <li>• getRuleScore - Get rule score</li>
                      <li>• getUserVotes - Get user votes</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">comments</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• list - Get rule comments</li>
                      <li>• create - Create comment</li>
                      <li>• update - Update comment</li>
                      <li>• softDelete - Delete comment</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">search</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• query - Full-text search</li>
                      <li>• suggestions - Search suggestions</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">tags</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• list - Get all tags</li>
                      <li>• getBySlug - Get tag by slug</li>
                      <li>• attach - Attach tags to rule</li>
                      <li>• getPopular - Get popular tags</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">social</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• followAuthor - Follow/unfollow</li>
                      <li>• favoriteRule - Favorite/unfavorite</li>
                      <li>• listNotifications - Get notifications</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
