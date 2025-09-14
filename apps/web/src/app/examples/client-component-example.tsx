"use client";

import { useState } from "react";
// import { api } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Example client component that demonstrates tRPC usage
 */
export function RulesListExample() {
  const [searchTerm, setSearchTerm] = useState("");

  // Example: Infinite query for rules list - temporarily disabled
  const data = null;
  const fetchNextPage = () => {};
  const hasNextPage = false;
  const isFetchingNextPage = false;
  const isLoading = false;
  const error = null;

  // Example: Search query with debouncing
  // TODO: Fix tRPC typing issue with search.query
  // const searchQuery = api.search.query.useQuery(
  //   {
  //     q: searchTerm,
  //     limit: 5,
  //     sort: "relevance",
  //   },
  //   {
  //     enabled: searchTerm.length >= 2,
  //     staleTime: 30 * 1000, // 30 seconds
  //   }
  // );
  const searchQuery = { data: null, isLoading: false }; // Temporary placeholder

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-gray-500">Loading rules...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-red-600">Error loading rules</div>
      </div>
    );
  }

  const allRules: any[] = [];

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="flex gap-4">
        <Input
          placeholder="Search rules or tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Button
          onClick={() => setSearchTerm("")}
          variant="outline"
          disabled={!searchTerm}
        >
          Clear
        </Button>
      </div>

      {/* Search Results (if searching) */}
      {searchTerm.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              {searchQuery.isLoading ? "Searching..." : `Found 0 results`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Temporarily disabled search results */}
            <p className="text-sm text-gray-500">
              Search functionality temporarily disabled
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">All Rules</h2>

        {allRules.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No rules found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {allRules.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasNextPage && (
          <div className="flex justify-center">
            <Button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              variant="outline"
            >
              {isFetchingNextPage ? "Loading..." : "Load More"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Example rule card component with voting functionality
 */
function RuleCard({ rule }: { rule: any }) {
  // Example: Mutation for voting - temporarily disabled
  const voteMutation = { mutate: (input: any) => {}, isPending: false };
  const favoriteMutation = { mutate: (input: any) => {}, isPending: false };

  const handleVote = (value: "up" | "down") => {
    voteMutation.mutate({
      ruleId: rule.id,
      value,
      idempotencyKey: `vote-${rule.id}-${value}-${Date.now()}`,
    });
  };

  const handleFavorite = () => {
    favoriteMutation.mutate({
      ruleId: rule.id,
      idempotencyKey: `favorite-${rule.id}-${Date.now()}`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{rule.title}</CardTitle>
            <CardDescription>{rule.summary}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Score: {rule.score}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {rule.tags.map((tag: any) => (
              <span
                key={tag.id}
                className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded"
              >
                {tag.name}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleVote("up")}
              disabled={voteMutation.isPending}
            >
              👍 {rule.userVote === "up" ? "Voted" : "Vote"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleVote("down")}
              disabled={voteMutation.isPending}
            >
              👎 {rule.userVote === "down" ? "Voted" : "Vote"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleFavorite}
              disabled={favoriteMutation.isPending}
            >
              ⭐ {rule.userFavorited ? "Favorited" : "Favorite"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Example component for creating a new rule
 */
export function CreateRuleExample() {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");

  // Temporarily disabled tRPC mutations
  const createMutation = {
    mutate: (input: any) => {},
    isPending: false,
    error: null,
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    createMutation.mutate({
      title,
      summary: summary || undefined,
      body,
      contentType: "RULE",
      idempotencyKey: `create-rule-${Date.now()}-${Math.random()}`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Rule</CardTitle>
        <CardDescription>
          Share your knowledge with the community
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Title
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter rule title..."
              required
            />
          </div>

          <div>
            <label htmlFor="summary" className="block text-sm font-medium mb-1">
              Summary (optional)
            </label>
            <Input
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description..."
            />
          </div>

          <div>
            <label htmlFor="body" className="block text-sm font-medium mb-1">
              Content
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter the rule content..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={createMutation.isPending || !title.trim() || !body.trim()}
          >
            {createMutation.isPending ? "Creating..." : "Create Rule"}
          </Button>

          {createMutation.error && (
            <div className="text-sm text-red-600">Error creating rule</div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
