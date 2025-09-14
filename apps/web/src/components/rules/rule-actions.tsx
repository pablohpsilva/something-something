"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Copy,
  Heart,
  GitFork,
  Eye,
  Share2,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Button } from "@repo/ui";
import {
  recordCopyAction,
  recordSaveAction,
  recordForkAction,
  recordVoteAction,
} from "@/lib/metrics/actions";
import {
  useOptimisticMetrics,
  showToast,
  type MetricsData,
} from "@/lib/metrics/read";
import { copyRuleUrl, formatRuleForCopy } from "@/lib/copy";
import { RULE_TESTIDS } from "@/lib/testids";
import { createButtonProps, createVoteButtonProps } from "@/lib/a11y";
import { api } from "@/lib/trpc";
import type { VoteSummaryDTO } from "@repo/trpc";
import { DonateButton } from "@/components/authors/donate-button";

interface RuleActionsProps {
  rule: {
    id: string;
    slug: string;
    title: string;
    body: string;
    author: {
      id: string;
      handle: string;
      displayName: string;
    };
  };
  currentVersionId?: string;
  initialMetrics: MetricsData;
  initialVoteData?: VoteSummaryDTO;
  onMetricsUpdate?: (metrics: MetricsData) => void;
  onVoteUpdate?: (voteData: VoteSummaryDTO) => void;
  className?: string;
}

export function RuleActions({
  rule,
  currentVersionId,
  initialMetrics,
  initialVoteData,
  onMetricsUpdate,
  onVoteUpdate,
  className = "",
}: RuleActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [isSharing, setIsSharing] = useState(false);
  const [voteData, setVoteData] = useState<VoteSummaryDTO>(
    initialVoteData || { score: 0, upCount: 0, downCount: 0, myVote: 0 }
  );

  const { currentMetrics, incrementMetric, revertMetric } =
    useOptimisticMetrics(initialMetrics);

  // Voting mutations - temporarily disabled due to tRPC typing issues
  // const voteRuleMutation = api.votes.upsertRuleVote.useMutation({
  //   onSuccess: (newVoteData) => {
  //     setVoteData(newVoteData);
  //     onVoteUpdate?.(newVoteData);
  //   },
  //   onError: (error) => {
  //     showToast(error.message || "Failed to vote", "error");
  //     // Revert optimistic vote update
  //     setVoteData(
  //       initialVoteData || { score: 0, upCount: 0, downCount: 0, myVote: 0 }
  //     );
  //   },
  // });
  const voteRuleMutation = {
    mutate: (input: any) => {},
    mutateAsync: async (input: any) => {},
    isPending: false,
  };

  // Update parent component when metrics change
  if (onMetricsUpdate && currentMetrics !== initialMetrics) {
    onMetricsUpdate(currentMetrics);
  }

  const handleVote = async (voteType: "up" | "down" | "none") => {
    // Optimistic update
    const currentVote = voteData.myVote;
    const newVote = voteType === "up" ? 1 : voteType === "down" ? -1 : 0;

    // Calculate optimistic changes
    let scoreDelta = 0;
    let upDelta = 0;
    let downDelta = 0;

    // Remove current vote
    if (currentVote === 1) {
      scoreDelta -= 1;
      upDelta -= 1;
    } else if (currentVote === -1) {
      scoreDelta += 1;
      downDelta -= 1;
    }

    // Add new vote
    if (newVote === 1) {
      scoreDelta += 1;
      upDelta += 1;
    } else if (newVote === -1) {
      scoreDelta -= 1;
      downDelta += 1;
    }

    // Apply optimistic update
    const optimisticVoteData = {
      score: voteData.score + scoreDelta,
      upCount: voteData.upCount + upDelta,
      downCount: voteData.downCount + downDelta,
      myVote: newVote,
    };
    setVoteData(optimisticVoteData);

    // Submit vote
    startTransition(async () => {
      try {
        await voteRuleMutation.mutateAsync({
          ruleId: rule.id,
          value: voteType,
        });

        // Record vote event for metrics
        if (voteType !== "none") {
          await recordVoteAction(rule.id, currentVersionId);
        }
      } catch (error) {
        // Error handling is done in mutation onError
      }
    });
  };

  const handleCopy = async () => {
    // Optimistically increment the counter
    incrementMetric("copies7");

    try {
      // Copy the rule content to clipboard
      const ruleContent = formatRuleForCopy({
        title: rule.title,
        body: rule.body,
        author: rule.author,
        url: `${window.location.origin}/rules/${rule.slug}`,
      });

      const copySuccess = await copyToClipboard(ruleContent);

      if (!copySuccess) {
        throw new Error("Failed to copy to clipboard");
      }

      // Record the copy event
      startTransition(async () => {
        const result = await recordCopyAction(rule.id, currentVersionId);

        if (!result.success) {
          // Revert optimistic update on failure
          revertMetric("copies7");
          showToast(result.error || "Failed to record copy event", "error");
        } else {
          showToast("Rule copied to clipboard!", "success");
        }
      });
    } catch (error) {
      // Revert optimistic update on failure
      revertMetric("copies7");
      showToast("Failed to copy rule", "error");
    }
  };

  const handleSave = async () => {
    // Optimistically increment the counter
    incrementMetric("saves7");

    startTransition(async () => {
      try {
        const result = await recordSaveAction(rule.id, currentVersionId);

        if (!result.success) {
          // Revert optimistic update on failure
          revertMetric("saves7");
          showToast(result.error || "Failed to save rule", "error");
        } else {
          showToast("Rule saved to your favorites!", "success");
        }
      } catch (error) {
        // Revert optimistic update on failure
        revertMetric("saves7");
        showToast("Failed to save rule", "error");
      }
    });
  };

  const handleFork = async () => {
    // Optimistically increment the counter
    incrementMetric("forks7");

    startTransition(async () => {
      try {
        const result = await recordForkAction(rule.id, currentVersionId);

        if (!result.success) {
          // Revert optimistic update on failure
          revertMetric("forks7");
          showToast(result.error || "Failed to fork rule", "error");
        } else {
          showToast(
            "Rule forked! You can now create your own version.",
            "success"
          );
          // TODO: Navigate to fork creation page
        }
      } catch (error) {
        // Revert optimistic update on failure
        revertMetric("forks7");
        showToast("Failed to fork rule", "error");
      }
    });
  };

  const handleShare = async () => {
    setIsSharing(true);

    try {
      const success = await copyRuleUrl(rule.slug);

      if (success) {
        showToast("Rule URL copied to clipboard!", "success");
      } else {
        throw new Error("Failed to copy URL");
      }
    } catch (error) {
      showToast("Failed to copy rule URL", "error");
    } finally {
      setIsSharing(false);
    }
  };

  const copyProps = createButtonProps(
    "Copy rule content",
    RULE_TESTIDS.COPY_BUTTON,
    isPending
  );

  const saveProps = createButtonProps(
    "Save rule to favorites",
    RULE_TESTIDS.SAVE_BUTTON,
    isPending
  );

  const forkProps = createButtonProps(
    "Fork this rule",
    RULE_TESTIDS.FORK_BUTTON,
    isPending
  );

  const shareProps = createButtonProps(
    "Share rule URL",
    RULE_TESTIDS.SHARE_BUTTON,
    isSharing
  );

  const upvoteProps = createVoteButtonProps(
    "up",
    RULE_TESTIDS.VOTE_UP,
    voteData.myVote === 1,
    voteData.upCount
  );

  const downvoteProps = createVoteButtonProps(
    "down",
    RULE_TESTIDS.VOTE_DOWN,
    voteData.myVote === -1,
    voteData.downCount
  );

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Voting section */}
      <div className="flex items-center space-x-1 mr-4">
        <Button
          {...upvoteProps}
          variant={voteData.myVote === 1 ? "default" : "outline"}
          size="sm"
          onClick={() => handleVote(voteData.myVote === 1 ? "none" : "up")}
          disabled={isPending}
          className="flex items-center space-x-1"
        >
          <ThumbsUp className="h-4 w-4" />
          {voteData.upCount > 0 && (
            <span className="text-xs">{voteData.upCount}</span>
          )}
        </Button>

        <div
          className="flex items-center px-2 text-sm font-medium"
          data-testid={RULE_TESTIDS.VOTE_SCORE}
          aria-label={`Score: ${voteData.score}`}
        >
          {voteData.score}
        </div>

        <Button
          {...downvoteProps}
          variant={voteData.myVote === -1 ? "destructive" : "outline"}
          size="sm"
          onClick={() => handleVote(voteData.myVote === -1 ? "none" : "down")}
          disabled={isPending}
          className="flex items-center space-x-1"
        >
          <ThumbsDown className="h-4 w-4" />
          {voteData.downCount > 0 && (
            <span className="text-xs">{voteData.downCount}</span>
          )}
        </Button>
      </div>
      <Button
        {...copyProps}
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="flex items-center space-x-2"
      >
        <Copy className="h-4 w-4" />
        <span>Copy</span>
        {currentMetrics.copies7 > 0 && (
          <span className="text-xs text-muted-foreground">
            ({currentMetrics.copies7})
          </span>
        )}
      </Button>

      <Button
        {...saveProps}
        variant="outline"
        size="sm"
        onClick={handleSave}
        className="flex items-center space-x-2"
      >
        <Heart className="h-4 w-4" />
        <span>Save</span>
        {currentMetrics.saves7 > 0 && (
          <span className="text-xs text-muted-foreground">
            ({currentMetrics.saves7})
          </span>
        )}
      </Button>

      <Button
        {...forkProps}
        variant="outline"
        size="sm"
        onClick={handleFork}
        className="flex items-center space-x-2"
      >
        <GitFork className="h-4 w-4" />
        <span>Fork</span>
        {currentMetrics.forks7 > 0 && (
          <span className="text-xs text-muted-foreground">
            ({currentMetrics.forks7})
          </span>
        )}
      </Button>

      <Button
        {...shareProps}
        variant="ghost"
        size="sm"
        onClick={handleShare}
        className="flex items-center space-x-2"
      >
        <Share2 className="h-4 w-4" />
        <span>Share</span>
      </Button>

      <DonateButton
        toUserId={rule.author.id}
        toUserHandle={rule.author.handle}
        toUserDisplayName={rule.author.displayName}
        ruleId={rule.id}
        ruleTitle={rule.title}
        size="sm"
        variant="outline"
      />
    </div>
  );
}

// Helper function for clipboard (imported from lib/copy but defined here for completeness)
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const success = document.execCommand("copy");
    document.body.removeChild(textArea);

    return success;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}
