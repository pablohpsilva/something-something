"use client";

import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";

export default function Home() {
  const trpc = useTRPC();

  // Query rules list with tRPC - API is working!
  const rulesQuery = useQuery(
    trpc.rules.list.queryOptions({
      limit: 10,
      sort: "new",
    })
  );

  return (
    <div className="font-sans min-h-screen p-8 pb-20 sm:p-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col items-center gap-8 mb-12">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={180}
            height={38}
            priority
          />
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Rules & Prompts</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Discover and share AI prompts, rules, and guides
            </p>
          </div>
        </header>

        {/* Rules List */}
        <main className="space-y-6">
          {rulesQuery.isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">
                Loading rules...
              </span>
            </div>
          )}

          {rulesQuery.isError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h3 className="text-red-800 dark:text-red-200 font-medium mb-2">
                Failed to load rules
              </h3>
              <p className="text-red-600 dark:text-red-400 text-sm">
                {rulesQuery.error?.message || "An unexpected error occurred"}
              </p>
            </div>
          )}

          {rulesQuery.data?.items && rulesQuery.data.items.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                No rules found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Be the first to create a rule or prompt!
              </p>
            </div>
          )}

          {rulesQuery.data?.items && rulesQuery.data.items.length > 0 && (
            <div className="grid gap-6">
              <h2 className="text-2xl font-semibold mb-4">Latest Rules</h2>
              {rulesQuery.data.items.map((rule) => (
                <article
                  key={rule.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {rule.title}
                        </h3>
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                          {rule.contentType}
                        </span>
                        {rule.status && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                            {rule.status}
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        {rule.summary}
                      </p>

                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                        <span>By {rule.author.displayName}</span>
                        {rule.primaryModel && (
                          <span>Model: {rule.primaryModel}</span>
                        )}
                        <span>
                          {new Date(rule.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {rule.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {rule.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end text-sm text-gray-500 dark:text-gray-400">
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {rule.score}
                      </div>
                      <div>score</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>{rule.metrics.views7} views</span>
                      <span>{rule.metrics.copies7} copies</span>
                      <span>{rule.metrics.saves7} saves</span>
                    </div>

                    {rule.currentVersion && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        v{rule.currentVersion.version}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
