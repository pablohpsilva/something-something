"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Filter,
  X,
  Clock,
  TrendingUp,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@/lib/trpc";
import { formatRelativeTime, debounce } from "@/lib/utils";
import { createButtonProps } from "@/lib/a11y";
import { sanitizeHtml, isHtmlSafe } from "@/lib/sanitize";
import type { SearchResultDTO } from "@repo/trpc";

interface SearchResultsProps {
  initialQuery?: string;
  initialFilters?: {
    tags?: string[];
    model?: string;
    status?: string;
    contentType?: string;
    authorHandle?: string;
  };
}

export function SearchResults({
  initialQuery = "",
  initialFilters = {},
}: SearchResultsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search state
  const [query, setQuery] = useState(
    initialQuery || searchParams.get("q") || ""
  );
  const [filters, setFilters] = useState({
    tags:
      initialFilters.tags ||
      searchParams.get("tags")?.split(",").filter(Boolean) ||
      [],
    model: initialFilters.model || searchParams.get("model") || "",
    status: initialFilters.status || searchParams.get("status") || "PUBLISHED",
    contentType:
      initialFilters.contentType || searchParams.get("contentType") || "",
    authorHandle:
      initialFilters.authorHandle || searchParams.get("authorHandle") || "",
  });

  const [isSearching, setIsSearching] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Update URL when filters change
  const updateURL = (newQuery: string, newFilters: typeof filters) => {
    const params = new URLSearchParams();

    if (newQuery) params.set("q", newQuery);
    if (newFilters.tags.length > 0)
      params.set("tags", newFilters.tags.join(","));
    if (newFilters.model) params.set("model", newFilters.model);
    if (newFilters.status && newFilters.status !== "PUBLISHED")
      params.set("status", newFilters.status);
    if (newFilters.contentType)
      params.set("contentType", newFilters.contentType);
    if (newFilters.authorHandle)
      params.set("authorHandle", newFilters.authorHandle);

    const newURL = `/rules${params.toString() ? `?${params.toString()}` : ""}`;
    router.replace(newURL, { scroll: false });
  };

  // Debounced search
  const debouncedSearch = debounce(
    (searchQuery: string, searchFilters: typeof filters) => {
      updateURL(searchQuery, searchFilters);
      setOffset(0);
    },
    500
  );

  // Rules API call - use list endpoint for basic functionality
  const {
    data: rulesData,
    isLoading,
    error,
    refetch,
  } = api.rules.list.useQuery({
    limit,
    cursor: undefined,
    sort: "new",
    filters: Object.fromEntries(
      Object.entries({
        status:
          filters.status === "ALL"
            ? undefined
            : (filters.status as "PUBLISHED" | "DEPRECATED"),
        contentType:
          filters.contentType && filters.contentType.trim()
            ? (filters.contentType as "PROMPT" | "RULE" | "MCP" | "GUIDE")
            : undefined,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
        model:
          filters.model && filters.model.trim() ? filters.model : undefined,
      }).filter(([_, value]) => value !== undefined)
    ),
  });

  // Transform the data to match search results format
  const searchResults = rulesData
    ? {
        results: rulesData.items
          .filter(
            (rule) =>
              !query.trim() ||
              rule.title.toLowerCase().includes(query.toLowerCase()) ||
              rule.summary?.toLowerCase().includes(query.toLowerCase()) ||
              rule.tags.some((tag) =>
                tag.name.toLowerCase().includes(query.toLowerCase())
              )
          )
          .map((rule) => ({
            id: rule.id,
            slug: rule.slug,
            title: rule.title,
            summary: rule.summary,
            author: rule.author,
            tags: rule.tags.map((tag) => tag.name),
            primaryModel: rule.primaryModel,
            status: rule.status,
            score: 0.9, // Default score since we don't have search scoring
            trending: 0,
            snippetHtml: null,
            createdAt: rule.createdAt,
            updatedAt: rule.updatedAt,
          })),
        pagination: {
          total: rulesData.items.length,
          hasMore: rulesData.hasMore,
        },
      }
    : null;

  // Get facets for filters - temporarily disabled
  const facets = null;

  // Handle search input change
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    if (newQuery.trim()) {
      setIsSearching(true);
      debouncedSearch(newQuery, filters);
    }
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    if (query.trim()) {
      debouncedSearch(query, newFilters);
    }
  };

  // Add tag filter
  const addTagFilter = (tag: string) => {
    if (!filters.tags.includes(tag)) {
      handleFilterChange("tags", [...filters.tags, tag]);
    }
  };

  // Remove tag filter
  const removeTagFilter = (tag: string) => {
    handleFilterChange(
      "tags",
      filters.tags.filter((t) => t !== tag)
    );
  };

  // Clear all filters
  const clearFilters = () => {
    const clearedFilters = {
      tags: [],
      model: "",
      status: "PUBLISHED",
      contentType: "",
      authorHandle: "",
    };
    setFilters(clearedFilters);
    if (query.trim()) {
      debouncedSearch(query, clearedFilters);
    }
  };

  // Load more results
  const loadMore = () => {
    setOffset((prev) => prev + limit);
  };

  // Stop loading indicator when search completes
  useEffect(() => {
    if (!isLoading) {
      setIsSearching(false);
    }
  }, [isLoading]);

  const hasActiveFilters =
    filters.tags.length > 0 ||
    filters.model ||
    filters.status !== "PUBLISHED" ||
    filters.contentType ||
    filters.authorHandle;

  const searchButtonProps = createButtonProps(
    "Search",
    "search-submit",
    isLoading
  );
  const clearButtonProps = createButtonProps(
    "Clear search",
    "search-clear",
    false
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Search Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search rules..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="pl-10 pr-10"
              data-testid="rules-search-input"
            />
            {query && (
              <Button
                {...clearButtonProps}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  router.replace("/rules");
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {(isLoading || isSearching) && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Searching...</span>
            </div>
          )}
        </div>

        {/* Search Stats */}
        {searchResults && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {searchResults.results.length} rule
              {searchResults.results.length !== 1 ? "s" : ""} found
              {query.trim() && ` for "${query}"`}
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Status
                </label>
                <Select
                  value={filters.status}
                  onValueChange={(value: string) =>
                    handleFilterChange("status", value)
                  }
                  data-testid="rules-filter-status"
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                    <SelectItem value="ALL">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Content Type Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Content Type
                </label>
                <Select
                  value={filters.contentType}
                  onValueChange={(value: string) =>
                    handleFilterChange("contentType", value)
                  }
                  data-testid="rules-filter-content-type"
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All types</SelectItem>
                    <SelectItem value="PROMPT">Prompt</SelectItem>
                    <SelectItem value="RULE">Rule</SelectItem>
                    <SelectItem value="MCP">MCP</SelectItem>
                    <SelectItem value="GUIDE">Guide</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Model Filter */}
              {false && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Model
                  </label>
                  <Select
                    value={filters.model}
                    onValueChange={(value: string) =>
                      handleFilterChange("model", value)
                    }
                    data-testid="rules-filter-model"
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="All models" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All models</SelectItem>
                      {[].map((model: any) => (
                        <SelectItem key={model.name} value={model.name}>
                          {model.name} ({model.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tags Filter */}
              {false && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tags
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {[].map((tag: any) => (
                      <div
                        key={tag.slug}
                        className="flex items-center justify-between text-xs"
                      >
                        <Button
                          variant={
                            filters.tags.includes(tag.slug)
                              ? "default"
                              : "ghost"
                          }
                          size="sm"
                          onClick={() =>
                            filters.tags.includes(tag.slug)
                              ? removeTagFilter(tag.slug)
                              : addTagFilter(tag.slug)
                          }
                          className="h-6 px-2 text-xs justify-start flex-1"
                          data-testid={`rules-filter-tag-${tag.slug}`}
                        >
                          {tag.name}
                        </Button>
                        <span className="text-muted-foreground ml-2">
                          {tag.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Filters */}
              {hasActiveFilters && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Active Filters
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {filters.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs cursor-pointer"
                        onClick={() => removeTagFilter(tag)}
                      >
                        {tag} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                    {filters.model && (
                      <Badge
                        variant="secondary"
                        className="text-xs cursor-pointer"
                        onClick={() => handleFilterChange("model", "")}
                      >
                        {filters.model} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          {isLoading ? (
            // Loading state
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="h-5 bg-muted animate-pulse rounded w-3/4"></div>
                          <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
                        </div>
                        <div className="h-6 bg-muted animate-pulse rounded w-12"></div>
                      </div>
                      <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
                      <div className="h-4 bg-muted animate-pulse rounded w-2/3"></div>
                      <div className="flex gap-2">
                        <div className="h-5 bg-muted animate-pulse rounded w-16"></div>
                        <div className="h-5 bg-muted animate-pulse rounded w-20"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            // Error state
            <Card>
              <CardContent className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
                <h3 className="text-lg font-semibold mb-2">
                  Error Loading Rules
                </h3>
                <p className="text-muted-foreground mb-4">
                  Something went wrong while loading rules. Please try again.
                </p>
                <Button onClick={() => refetch()}>Try Again</Button>
              </CardContent>
            </Card>
          ) : !searchResults || searchResults.results.length === 0 ? (
            // No results
            <Card>
              <CardContent className="text-center py-12">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  {query.trim() ? "No Results Found" : "Browse Rules"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {query.trim()
                    ? `No rules found${query.trim() ? ` for "${query}"` : ""}${
                        hasActiveFilters ? " with the selected filters" : ""
                      }`
                    : "Enter a search term to find specific rules, or browse all available rules below"}
                </p>
                {query.trim() && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Try:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Using different keywords</li>
                      <li>• Removing some filters</li>
                      <li>• Checking for typos</li>
                    </ul>
                  </div>
                )}
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="mt-4"
                  >
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            // Results list
            <div className="space-y-4" data-testid="rules-search-results">
              {searchResults.results.map((result: any) => (
                <SearchResultCard
                  key={result.id}
                  result={result}
                  query={query}
                  onTagClick={addTagFilter}
                />
              ))}

              {/* Load More */}
              {searchResults.pagination.hasMore && (
                <div className="text-center pt-4">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Search result card component
function SearchResultCard({
  result,
  query,
  onTagClick,
}: {
  result: SearchResultDTO;
  query: string;
  onTagClick: (tag: string) => void;
}) {
  const router = useRouter();

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push(`/rules/${result.slug}`)}
      data-testid="rules-result-item"
    >
      <CardContent className="p-6">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg leading-tight mb-1">
                {result.title}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={result.author.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {result.author.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>@{result.author.handle}</span>
                <span>•</span>
                <span>{formatRelativeTime(result.updatedAt)}</span>
                {result.primaryModel && (
                  <>
                    <span>•</span>
                    <Badge variant="outline" className="text-xs">
                      {result.primaryModel}
                    </Badge>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>{Math.round(result.score * 100)}</span>
              </div>
              {result.trending > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Trending
                </Badge>
              )}
            </div>
          </div>

          {/* Snippet */}
          {result.snippetHtml ? (
            <div
              className="text-sm text-muted-foreground"
              dangerouslySetInnerHTML={{
                __html: isHtmlSafe(result.snippetHtml)
                  ? sanitizeHtml(result.snippetHtml)
                  : result.summary || "",
              }}
            />
          ) : result.summary ? (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {result.summary}
            </p>
          ) : null}

          {/* Tags */}
          {result.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.tags.slice(0, 5).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick(tag);
                  }}
                >
                  {tag}
                </Badge>
              ))}
              {result.tags.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{result.tags.length - 5} more
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
