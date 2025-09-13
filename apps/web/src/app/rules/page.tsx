"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Filter } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { RuleList } from "@/components/rules/rule-list";
import { TagFilter } from "@/components/rules/tag-filter";
import { FILTER_TESTIDS } from "@/lib/testids";
import { createFieldProps } from "@/lib/a11y";

export default function RulesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize filters from URL params
  const [filters, setFilters] = useState({
    q: searchParams.get("q") || "",
    tags: searchParams.get("tags")?.split(",").filter(Boolean) || [],
    model: searchParams.get("model") || "",
    status: searchParams.get("status") || "",
    sort: (searchParams.get("sort") as "new" | "top" | "trending") || "new",
  });

  const [searchInput, setSearchInput] = useState(filters.q);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.q) params.set("q", filters.q);
    if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
    if (filters.model) params.set("model", filters.model);
    if (filters.status) params.set("status", filters.status);
    if (filters.sort !== "new") params.set("sort", filters.sort);

    const newUrl = `/rules${params.toString() ? `?${params.toString()}` : ""}`;
    router.replace(newUrl, { scroll: false });
  }, [filters, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, q: searchInput }));
  };

  const handleFilterChange = (key: string, value: string | string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      q: "",
      tags: [],
      model: "",
      status: "",
      sort: "new",
    });
    setSearchInput("");
  };

  const hasActiveFilters =
    filters.q ||
    filters.tags.length > 0 ||
    filters.model ||
    filters.status ||
    filters.sort !== "new";

  const searchProps = createFieldProps(
    "rules-search",
    "Search rules",
    FILTER_TESTIDS.SEARCH_INPUT
  );

  return (
    <div className="container py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Rules</h1>
              <p className="text-muted-foreground">
                Discover and explore community-driven development rules and
                patterns
              </p>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              {...searchProps}
              type="search"
              placeholder="Search rules..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </form>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span className="font-medium">Filters</span>
                {hasActiveFilters && (
                  <Button
                    data-testid={FILTER_TESTIDS.CLEAR_FILTERS}
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-auto p-1 text-xs"
                  >
                    Clear all
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Tags Filter */}
                <TagFilter
                  selectedTags={filters.tags}
                  onTagsChange={(tags) => handleFilterChange("tags", tags)}
                />

                {/* Model Filter */}
                <Select
                  value={filters.model}
                  onValueChange={(value) => handleFilterChange("model", value)}
                >
                  <SelectTrigger data-testid={FILTER_TESTIDS.MODEL}>
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Models</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="llama">Llama</SelectItem>
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select
                  value={filters.status}
                  onValueChange={(value) => handleFilterChange("status", value)}
                >
                  <SelectTrigger data-testid={FILTER_TESTIDS.STATUS}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Status</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort Filter */}
                <Select
                  value={filters.sort}
                  onValueChange={(value) =>
                    handleFilterChange("sort", value as any)
                  }
                >
                  <SelectTrigger data-testid={FILTER_TESTIDS.SORT_SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Newest</SelectItem>
                    <SelectItem value="top">Top Rated</SelectItem>
                    <SelectItem value="trending">Trending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <RuleList initialFilters={filters} />
      </div>
    </div>
  );
}
