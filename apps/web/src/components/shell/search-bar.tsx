"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { SEARCH_TESTIDS } from "@/lib/testids";
import { createFieldProps, createButtonProps } from "@/lib/a11y";

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  onSearch?: (query: string) => void;
  defaultValue?: string;
}

export function SearchBar({
  placeholder = "Search rules, patterns, and guides...",
  className = "",
  onSearch,
  defaultValue = "",
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(
    defaultValue || searchParams.get("q") || ""
  );

  const handleSearch = useCallback(
    (searchQuery: string) => {
      const trimmedQuery = searchQuery.trim();

      if (onSearch) {
        onSearch(trimmedQuery);
      } else {
        // Navigate to rules page with search query
        const params = new URLSearchParams();
        if (trimmedQuery) {
          params.set("q", trimmedQuery);
        }
        router.push(
          `/rules${params.toString() ? `?${params.toString()}` : ""}`
        );
      }
    },
    [onSearch, router]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleClear = () => {
    setQuery("");
    handleSearch("");
  };

  const fieldProps = createFieldProps(
    "global-search",
    "Search rules and patterns",
    SEARCH_TESTIDS.GLOBAL_INPUT
  );

  const submitProps = createButtonProps("Search", SEARCH_TESTIDS.GLOBAL_SUBMIT);

  const clearProps = createButtonProps(
    "Clear search",
    SEARCH_TESTIDS.GLOBAL_CLEAR
  );

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          {...fieldProps}
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            {...clearProps}
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-8 top-1/2 h-6 w-6 -translate-y-1/2 p-0 hover:bg-transparent"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button
          {...submitProps}
          type="submit"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
