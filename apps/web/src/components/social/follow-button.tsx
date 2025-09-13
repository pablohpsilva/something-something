"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { UserPlus, UserMinus, Users } from "lucide-react";
import { api } from "@/lib/trpc";
import { showToast } from "@/lib/metrics/read";
import { createButtonProps } from "@/lib/a11y";
import { formatNumber } from "@/lib/format";

interface FollowButtonProps {
  authorUserId: string;
  initialFollowing: boolean;
  initialFollowersCount: number;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "ghost";
  showCount?: boolean;
  className?: string;
}

export function FollowButton({
  authorUserId,
  initialFollowing,
  initialFollowersCount,
  size = "md",
  variant = "default",
  showCount = true,
  className = "",
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);

  const toggleFollowMutation = api.social.toggleFollow.useMutation({
    onSuccess: (data) => {
      setIsFollowing(data.following);
      setFollowersCount(data.followersCount);
      showToast(
        data.following ? "Successfully followed!" : "Successfully unfollowed!",
        "success"
      );
    },
    onError: (error) => {
      // Revert optimistic update
      setIsFollowing(initialFollowing);
      setFollowersCount(initialFollowersCount);
      showToast(error.message || "Failed to update follow status", "error");
    },
  });

  const handleToggleFollow = async () => {
    // Optimistic update
    const newFollowing = !isFollowing;
    const newCount = newFollowing ? followersCount + 1 : followersCount - 1;

    setIsFollowing(newFollowing);
    setFollowersCount(newCount);

    // Submit to server
    try {
      await toggleFollowMutation.mutateAsync({
        authorUserId,
      });
    } catch (error) {
      // Error handling is done in mutation onError
    }
  };

  const isLoading = toggleFollowMutation.isPending;

  const buttonProps = createButtonProps(
    isFollowing ? "Unfollow user" : "Follow user",
    "follow-button",
    isLoading
  );

  const buttonSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "default";
  const iconSize =
    size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        {...buttonProps}
        variant={isFollowing ? "outline" : variant}
        size={buttonSize}
        onClick={handleToggleFollow}
        disabled={isLoading}
        className="flex items-center gap-2"
        aria-pressed={isFollowing}
      >
        {isLoading ? (
          <div
            className={`${iconSize} animate-spin rounded-full border-2 border-current border-t-transparent`}
          />
        ) : isFollowing ? (
          <UserMinus className={iconSize} />
        ) : (
          <UserPlus className={iconSize} />
        )}

        <span className={size === "sm" ? "text-xs" : ""}>
          {isFollowing ? "Following" : "Follow"}
        </span>
      </Button>

      {showCount && (
        <div
          className="flex items-center gap-1 text-sm text-muted-foreground"
          aria-label={`${followersCount} followers`}
        >
          <Users className="h-4 w-4" />
          <span>{formatNumber(followersCount)}</span>
        </div>
      )}
    </div>
  );
}
