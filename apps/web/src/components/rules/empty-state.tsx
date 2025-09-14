import { Search, Plus, FileText, Users } from "lucide-react";
import { Button } from "@repo/ui";
import { Card, CardContent } from "@repo/ui";
import Link from "next/link";
import { LIST_TESTIDS } from "@/lib/testids";

interface EmptyStateProps {
  type:
    | "search"
    | "rules"
    | "comments"
    | "authors"
    | "notifications"
    | "claims";
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

const emptyStateConfig = {
  search: {
    icon: Search,
    title: "No results found",
    description:
      "Try adjusting your search terms or filters to find what you're looking for.",
    actionLabel: "Clear filters",
  },
  rules: {
    icon: FileText,
    title: "No rules yet",
    description:
      "Be the first to contribute a rule to help the community grow.",
    actionLabel: "Submit a rule",
    actionHref: "/submit",
  },
  comments: {
    icon: FileText,
    title: "No comments yet",
    description:
      "Start the conversation by sharing your thoughts on this rule.",
    actionLabel: "Add comment",
  },
  authors: {
    icon: Users,
    title: "No authors found",
    description: "No authors match your current search criteria.",
    actionLabel: "View all authors",
    actionHref: "/authors",
  },
  notifications: {
    icon: FileText,
    title: "No notifications",
    description: "You're all caught up! New notifications will appear here.",
  },
  claims: {
    icon: FileText,
    title: "No claims submitted",
    description: "Submit a claim to verify your ownership of a rule.",
    actionLabel: "Submit claim",
  },
};

export function EmptyState({
  type,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  const config = emptyStateConfig[type];
  const Icon = config.icon;

  const finalTitle = title || config.title;
  const finalDescription = description || config.description;
  const finalActionLabel = actionLabel || (config as any).actionLabel;
  const finalActionHref = actionHref || (config as any).actionHref;

  return (
    <Card data-testid={LIST_TESTIDS.EMPTY_STATE}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 rounded-full bg-muted p-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>

        <h3 className="mb-2 text-lg font-semibold">{finalTitle}</h3>

        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          {finalDescription}
        </p>

        {finalActionLabel && (
          <>
            {finalActionHref ? (
              <Button asChild>
                <Link href={finalActionHref}>
                  <Plus className="mr-2 h-4 w-4" />
                  {finalActionLabel}
                </Link>
              </Button>
            ) : onAction ? (
              <Button onClick={onAction}>
                <Plus className="mr-2 h-4 w-4" />
                {finalActionLabel}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
