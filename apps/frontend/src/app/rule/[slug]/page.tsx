"use client";

import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CalendarIcon,
  EyeIcon,
  BookmarkIcon,
  HeartIcon,
  UserIcon,
  TagIcon,
  ArrowTopRightOnSquareIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import {
  HeartIcon as HeartSolidIcon,
  BookmarkIcon as BookmarkSolidIcon,
} from "@heroicons/react/24/solid";

interface RuleDetailPageProps {
  params: {
    slug: string;
  };
}

export default function RuleDetailPage({ params }: RuleDetailPageProps) {
  const trpc = useTRPC();

  // Fetch rule details using tRPC
  const ruleQuery = useQuery(
    trpc.rules.getBySlug.queryOptions({
      slug: params.slug,
      includeMetrics: true,
      includeUserActions: true,
    })
  );

  // Handle loading state
  if (ruleQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-8"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (ruleQuery.isError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Error Loading Rule
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {ruleQuery.error?.message || "Failed to load rule details"}
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Handle not found
  if (!ruleQuery.data) {
    notFound();
  }

  const rule = ruleQuery.data;

  const handleCopyRule = async () => {
    if (rule.body) {
      try {
        await navigator.clipboard.writeText(rule.body);
        // Could add a toast notification here
        console.log("Rule copied to clipboard!");
      } catch (err) {
        console.error("Failed to copy rule:", err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Rules
          </Link>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            {/* Rule Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {rule.title}
                    </h1>
                    <span className="px-3 py-1 text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                      {rule.contentType}
                    </span>
                    {rule.status && (
                      <span className="px-3 py-1 text-sm font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                        {rule.status}
                      </span>
                    )}
                  </div>

                  {rule.summary && (
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
                      {rule.summary}
                    </p>
                  )}

                  {/* Author and Metadata */}
                  <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {rule.author.displayName}
                      </span>
                      {rule.author.isVerified && (
                        <span className="text-blue-500">✓</span>
                      )}
                    </div>

                    {rule.primaryModel && (
                      <div className="flex items-center gap-1">
                        <span>Model:</span>
                        <span className="font-medium">{rule.primaryModel}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />
                      <span>
                        {new Date(rule.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {rule.currentVersion && (
                      <span className="text-xs">
                        v{rule.currentVersion.version}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {rule.score}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    score
                  </div>
                </div>
              </div>

              {/* Tags */}
              {rule.tags.length > 0 && (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {rule.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                      >
                        <TagIcon className="w-3 h-3 mr-1" />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stats and Actions */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <EyeIcon className="w-4 h-4" />
                  <span>{rule.metrics.views7} views</span>
                </div>
                <div className="flex items-center gap-1">
                  <DocumentDuplicateIcon className="w-4 h-4" />
                  <span>{rule.metrics.copies7} copies</span>
                </div>
                <div className="flex items-center gap-1">
                  <BookmarkIcon className="w-4 h-4" />
                  <span>{rule.metrics.saves7} saves</span>
                </div>
                <div className="flex items-center gap-1">
                  <HeartIcon className="w-4 h-4" />
                  <span>{rule.favoritesCount} favorites</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyRule}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <DocumentDuplicateIcon className="w-4 h-4 mr-2" />
                  Copy Rule
                </button>

                <button className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  {rule.userFavorited ? (
                    <HeartSolidIcon className="w-4 h-4 mr-2 text-red-500" />
                  ) : (
                    <HeartIcon className="w-4 h-4 mr-2" />
                  )}
                  {rule.userFavorited ? "Favorited" : "Favorite"}
                </button>
              </div>
            </div>

            {/* Rule Content */}
            {rule.body && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Rule Content
                </h2>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono leading-relaxed">
                    {rule.body}
                  </pre>
                </div>
              </div>
            )}

            {/* Resource Links */}
            {rule.resourceLinks && rule.resourceLinks.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Resources
                </h2>
                <div className="grid gap-3">
                  {rule.resourceLinks.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-3 text-gray-500 dark:text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {link.label}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {link.kind} • {new URL(link.url).hostname}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Tested On */}
            {rule.currentVersion?.testedOn && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Tested On
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {rule.currentVersion.testedOn.models &&
                    rule.currentVersion.testedOn.models.length > 0 && (
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                          Models
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {rule.currentVersion.testedOn.models.map((model) => (
                            <span
                              key={model}
                              className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full"
                            >
                              {model}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {rule.currentVersion.testedOn.stacks &&
                    rule.currentVersion.testedOn.stacks.length > 0 && (
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                          Stacks
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {rule.currentVersion.testedOn.stacks.map((stack) => (
                            <span
                              key={stack}
                              className="px-3 py-1 text-sm bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full"
                            >
                              {stack}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
