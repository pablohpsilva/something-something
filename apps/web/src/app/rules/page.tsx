import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchResults } from "./search-results";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Search Rules",
  description: "Search and discover rules, prompts, and guides",
};

function SearchResultsLoading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Search Header Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters Sidebar Skeleton */}
        <div className="lg:col-span-1 space-y-4">
          <div className="space-y-3">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </div>
        </div>

        {/* Results Skeleton */}
        <div className="lg:col-span-3 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-6 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-14" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<SearchResultsLoading />}>
      <SearchResults />
    </Suspense>
  );
}
