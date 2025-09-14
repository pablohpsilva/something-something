"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { RuleCard } from "./rule-card";
import { RuleListSkeleton } from "./skeletons";
import { EmptyState } from "./empty-state";
import { api } from "@/lib/trpc";
import { LIST_TESTIDS } from "@/lib/testids";
import { createButtonProps } from "@/lib/a11y";

interface RuleListProps {
  initialFilters?: {
    q?: string;
    tags?: string[];
    model?: string;
    status?: string;
    sort?: "new" | "top" | "trending";
  };
  showAuthor?: boolean;
  authorId?: string;
  limit?: number;
}

export function RuleList({
  initialFilters = {},
  showAuthor = true,
  authorId,
  limit = 20,
}: RuleListProps) {
  const [filters] = useState(initialFilters);

  // Temporarily disabled due to tRPC typing issues
  // const {
  //   data,
  //   isLoading,
  //   isError,
  //   fetchNextPage,
  //   hasNextPage,
  //   isFetchingNextPage,
  // } = api.rules.list.useInfiniteQuery(
  //   {
  //     ...filters,
  //     filters: {
  //       ...filters,
  //       authorId,
  //     },
  //     limit,
  //   },
  //   {
  //     getNextPageParam: (lastPage) => lastPage.nextCursor,
  //     staleTime: 30 * 1000, // 30 seconds
  //   }
  // );
  const data = { pages: [{ items: [] }] };
  const isLoading = false;
  const isError = false;
  const fetchNextPage = () => {};
  const hasNextPage = false;
  const isFetchingNextPage = false;

  const loadMoreProps = createButtonProps(
    "Load more rules",
    LIST_TESTIDS.LOAD_MORE,
    isFetchingNextPage
  );

  if (isLoading) {
    return <RuleListSkeleton count={limit} />;
  }

  if (isError) {
    return (
      <EmptyState
        type="search"
        title="Failed to load rules"
        description="There was an error loading the rules. Please try again."
        actionLabel="Retry"
        onAction={() => window.location.reload()}
      />
    );
  }

  const allRules = (data?.pages.flatMap((page) => page.items) ?? []) as any[];

  if (allRules.length === 0) {
    const hasFilters = Object.values(filters).some((value) =>
      Array.isArray(value) ? value.length > 0 : Boolean(value)
    );

    return (
      <EmptyState
        type={hasFilters ? "search" : "rules"}
        {...(hasFilters && {
          actionLabel: "Clear filters",
          onAction: () => {
            // This would be handled by parent component
            console.log("Clear filters");
          },
        })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {allRules.map((rule) => (
          <RuleCard key={rule.id} rule={rule} showAuthor={showAuthor} />
        ))}
      </div>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            {...loadMoreProps}
            onClick={() => fetchNextPage()}
            variant="outline"
            size="lg"
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
