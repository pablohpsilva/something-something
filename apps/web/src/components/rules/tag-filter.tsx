"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@repo/ui/components/ui/command";
import { api } from "@/lib/trpc";
import { FILTER_TESTIDS } from "@/lib/testids";

interface TagFilterProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  className?: string;
}

export function TagFilter({
  selectedTags,
  onTagsChange,
  className = "",
}: TagFilterProps) {
  const [open, setOpen] = useState(false);

  const { data: tags, isLoading } = api.tags.list.useQuery({
    limit: 100,
  });

  const handleTagToggle = (tagSlug: string) => {
    const newTags = selectedTags.includes(tagSlug)
      ? selectedTags.filter((t) => t !== tagSlug)
      : [...selectedTags, tagSlug];
    onTagsChange(newTags);
  };

  const clearAllTags = () => {
    onTagsChange([]);
  };

  const selectedTagNames =
    tags?.items
      .filter((tag) => selectedTags.includes(tag.slug))
      .map((tag) => tag.name) || [];

  return (
    <div className={`space-y-2 ${className}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            data-testid={FILTER_TESTIDS.TAG}
            variant="outline"
            className="justify-start"
          >
            Tags
            {selectedTags.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedTags.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandEmpty>
              {isLoading ? "Loading tags..." : "No tags found."}
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {tags?.items.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={tag.name}
                  onSelect={() => handleTagToggle(tag.slug)}
                  className="flex items-center space-x-2"
                >
                  <div className="flex items-center space-x-2 flex-1">
                    <div
                      className={`h-4 w-4 border rounded-sm flex items-center justify-center ${
                        selectedTags.includes(tag.slug)
                          ? "bg-primary border-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {selectedTags.includes(tag.slug) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span>{tag.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {tag.ruleCount || 0}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {selectedTagNames.map((tagName, index) => (
            <Badge
              key={selectedTags[index]}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => handleTagToggle(selectedTags[index])}
            >
              {tagName}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ))}
          <Button
            data-testid={FILTER_TESTIDS.CLEAR_FILTERS}
            variant="ghost"
            size="sm"
            onClick={clearAllTags}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
