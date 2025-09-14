"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Clock, TrendingUp, Loader2 } from "lucide-react";
import { Input } from "@/components/ui";
import { Button } from "@/components/ui";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { Badge } from "@/components/ui";
import { api } from "@/lib/trpc";
import { debounce } from "@/lib/utils";
import { createButtonProps } from "@/lib/a11y";

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  showSuggestions?: boolean;
  autoFocus?: boolean;
  onSearch?: (query: string) => void;
}

const RECENT_SEARCHES_KEY = "recent-searches";
const MAX_RECENT_SEARCHES = 5;

export function SearchBar({
  placeholder = "Search rules...",
  className = "",
  size = "md",
  showSuggestions = true,
  autoFocus = false,
  onSearch,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Failed to load recent searches:", error);
    }
  }, []);

  // Save recent search
  const saveRecentSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    try {
      const updated = [
        searchQuery,
        ...recentSearches.filter((s) => s !== searchQuery),
      ].slice(0, MAX_RECENT_SEARCHES);

      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save recent search:", error);
    }
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (error) {
      console.error("Failed to clear recent searches:", error);
    }
  };

  // Debounced suggestions query
  const [debouncedValue, setDebouncedValue] = useState("");
  const debouncedQuery = debounce((q: string) => setDebouncedValue(q), 300);

  useEffect(() => {
    debouncedQuery(query);
  }, [query, debouncedQuery]);

  // Get suggestions - temporarily disabled due to tRPC typing issues
  // const { data: suggestions, isLoading: suggestionsLoading } =
  //   api.search.suggest.useQuery(
  //     { q: debouncedValue, limit: 6 },
  //     {
  //       enabled: showSuggestions && debouncedValue.length >= 2 && isOpen,
  //       staleTime: 30000, // Cache for 30 seconds
  //     }
  //   );
  const suggestions = { suggestions: [] };
  const suggestionsLoading = false;

  // Handle search submission
  const handleSearch = (searchQuery: string = query) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    saveRecentSearch(trimmed);
    setIsOpen(false);

    if (onSearch) {
      onSearch(trimmed);
    } else {
      // Navigate to search results page
      const params = new URLSearchParams({ q: trimmed });
      router.push(`/rules?${params.toString()}`);
    }
  };

  // Handle input change
  const handleInputChange = (value: string) => {
    setQuery(value);
    if (value.length >= 2) {
      setIsOpen(true);
    }
  };

  // Handle key events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Clear search
  const clearSearch = () => {
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const inputSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "default";
  const iconSize =
    size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  const searchButtonProps = createButtonProps(
    "Search rules",
    "global-search-submit",
    false
  );

  const clearButtonProps = createButtonProps(
    "Clear search",
    "global-search-clear",
    false
  );

  return (
    <div className={`relative ${className}`}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground ${iconSize}`}
            />
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsOpen(true)}
              className={`pl-10 pr-20 ${size === "lg" ? "h-12 text-lg" : ""}`}
              autoFocus={autoFocus}
              data-testid="global-search-input"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              {query && (
                <Button
                  {...clearButtonProps}
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <Button
                {...searchButtonProps}
                variant="ghost"
                size="sm"
                onClick={() => handleSearch()}
                className="h-8 px-2"
                disabled={!query.trim()}
              >
                <Search className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </PopoverTrigger>

        {showSuggestions && (
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
            side="bottom"
          >
            <Command>
              <CommandList>
                {/* Loading state */}
                {suggestionsLoading && debouncedValue.length >= 2 && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Searching...
                    </span>
                  </div>
                )}

                {/* Recent searches */}
                {!suggestionsLoading &&
                  recentSearches.length > 0 &&
                  debouncedValue.length < 2 && (
                    <CommandGroup heading="Recent searches">
                      {recentSearches.map((search, index) => (
                        <CommandItem
                          key={`recent-${index}`}
                          value={search}
                          onSelect={() => handleSearch(search)}
                          className="flex items-center gap-2"
                          data-testid="global-search-recent-item"
                        >
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="flex-1 truncate">{search}</span>
                        </CommandItem>
                      ))}
                      <CommandItem
                        onSelect={clearRecentSearches}
                        className="text-xs text-muted-foreground justify-center"
                      >
                        Clear recent searches
                      </CommandItem>
                    </CommandGroup>
                  )}

                {/* Suggestions */}
                {!suggestionsLoading &&
                  suggestions?.suggestions &&
                  suggestions.suggestions.length > 0 && (
                    <CommandGroup heading="Suggestions">
                      {suggestions.suggestions.map((suggestion: any) => (
                        <CommandItem
                          key={suggestion.id}
                          value={suggestion.title}
                          onSelect={() =>
                            router.push(`/rules/${suggestion.slug}`)
                          }
                          className="flex items-center gap-2"
                          data-testid="global-search-suggest-item"
                        >
                          <TrendingUp className="h-3 w-3 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">
                              {suggestion.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {Math.round(suggestion.similarity * 100)}% match
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                {/* Search query option */}
                {query.trim() && (
                  <CommandGroup>
                    <CommandItem
                      value={query}
                      onSelect={() => handleSearch()}
                      className="flex items-center gap-2 font-medium"
                      data-testid="global-search-query-item"
                    >
                      <Search className="h-3 w-3" />
                      <span>Search for "{query.trim()}"</span>
                    </CommandItem>
                  </CommandGroup>
                )}

                {/* Empty state */}
                {!suggestionsLoading &&
                  debouncedValue.length >= 2 &&
                  (!suggestions?.suggestions ||
                    suggestions.suggestions.length === 0) && (
                    <CommandEmpty>
                      <div className="text-center py-6">
                        <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          No suggestions found for "{debouncedValue}"
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Try a different search term
                        </p>
                      </div>
                    </CommandEmpty>
                  )}
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}
