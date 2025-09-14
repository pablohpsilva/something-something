"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Users } from "lucide-react";
import { api } from "@/lib/trpc";
import { showToast } from "@/lib/metrics/read";
import { createButtonProps } from "@/lib/a11y";
import { formatNumber } from "@/lib/format";

interface WatchButtonProps {
  ruleId: string;
  initialWatching: boolean;
  initialWatchersCount?: number;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "ghost";
  showCount?: boolean;
  className?: string;
}

export function WatchButton({
  ruleId,
  initialWatching,
  initialWatchersCount = 0,
  size = "md",
  variant = "outline",
  showCount = true,
  className = "",
}: WatchButtonProps) {
  const [isWatching, setIsWatching] = useState(initialWatching);
  const [watchersCount, setWatchersCount] = useState(initialWatchersCount);

  // Temporarily disabled due to tRPC typing issues
  // const toggleWatchMutation = api.social.toggleWatch.useMutation({
  //   onSuccess: (data) => {
  //     setIsWatching(data.watching);
  //     setWatchersCount(data.watchersCount);
  //     showToast(
  //       data.watching
  //         ? "You're now watching this rule for updates!"
  //         : "You're no longer watching this rule",
  //       "success"
  //     );
  //   },
  //   onError: (error) => {
  //     // Revert optimistic update
  //     setIsWatching(initialWatching);
  //     setWatchersCount(initialWatchersCount);
  //     showToast(error.message || "Failed to update watch status", "error");
  //   },
  // });
  const toggleWatchMutation = {
    mutate: (input: any) => {},
    mutateAsync: async (input: any) => {},
    isPending: false,
  };

  const handleToggleWatch = async () => {
    // Optimistic update
    const newWatching = !isWatching;
    const newCount = newWatching ? watchersCount + 1 : watchersCount - 1;

    setIsWatching(newWatching);
    setWatchersCount(Math.max(0, newCount));

    // Submit to server
    try {
      await toggleWatchMutation.mutateAsync({
        ruleId,
      });
    } catch (error) {
      // Error handling is done in mutation onError
    }
  };

  const isLoading = toggleWatchMutation.isPending;

  const buttonProps = createButtonProps(
    isWatching ? "Stop watching rule" : "Watch rule for updates",
    "watch-button",
    isLoading
  );

  const buttonSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "default";
  const iconSize =
    size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        {...buttonProps}
        variant={isWatching ? "default" : variant}
        size={buttonSize}
        onClick={handleToggleWatch}
        disabled={isLoading}
        className="flex items-center gap-2"
        aria-pressed={isWatching}
      >
        {isLoading ? (
          <div
            className={`${iconSize} animate-spin rounded-full border-2 border-current border-t-transparent`}
          />
        ) : isWatching ? (
          <Eye className={iconSize} />
        ) : (
          <EyeOff className={iconSize} />
        )}

        <span className={size === "sm" ? "text-xs" : ""}>
          {isWatching ? "Watching" : "Watch"}
        </span>
      </Button>

      {showCount && watchersCount > 0 && (
        <div
          className="flex items-center gap-1 text-sm text-muted-foreground"
          aria-label={`${watchersCount} watchers`}
        >
          <Users className="h-4 w-4" />
          <span>{formatNumber(watchersCount)}</span>
        </div>
      )}
    </div>
  );
}
