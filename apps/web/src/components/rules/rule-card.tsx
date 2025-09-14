import Link from "next/link";
import { Badge } from "@repo/ui";
import { Card, CardContent, CardHeader } from "@repo/ui";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui";
import { MetricsStrip } from "./metrics-strip";
import { formatRelativeTime, truncateText } from "@/lib/format";
import { RULE_TESTIDS, AUTHOR_TESTIDS } from "@/lib/testids";
import { createLinkProps } from "@/lib/a11y";

interface RuleCardProps {
  rule: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    status: string;
    score: number;
    createdAt: string;
    author: {
      id: string;
      handle: string;
      displayName: string;
      avatarUrl?: string;
    };
    currentVersion?: {
      id: string;
      version: string;
      testedOn?: {
        models?: string[];
        stacks?: string[];
      };
    };
    tags: Array<{
      id: string;
      name: string;
      slug: string;
    }>;
    metrics?: {
      views7?: number;
      copies7?: number;
      saves7?: number;
      forks?: number;
      votes?: number;
    };
  };
  showAuthor?: boolean;
  className?: string;
}

export function RuleCard({
  rule,
  showAuthor = true,
  className = "",
}: RuleCardProps) {
  const cardProps = createLinkProps(
    `View rule: ${rule.title}`,
    RULE_TESTIDS.CARD,
    `/rules/${rule.slug}`
  );

  const authorProps = createLinkProps(
    `View ${rule.author.displayName}'s profile`,
    AUTHOR_TESTIDS.PROFILE_LINK,
    `/authors/${rule.author.handle}`
  );

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "published":
        return "default";
      case "draft":
        return "secondary";
      case "deprecated":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <Link {...cardProps} className="block">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-lg leading-tight line-clamp-2">
                  {rule.title}
                </h3>
                <Badge
                  variant={getStatusVariant(rule.status)}
                  className="shrink-0"
                >
                  {rule.status}
                </Badge>
              </div>

              <p className="text-muted-foreground text-sm line-clamp-2">
                {truncateText(rule.summary, 150)}
              </p>

              {rule.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {rule.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag.id} variant="outline" className="text-xs">
                      {tag.name}
                    </Badge>
                  ))}
                  {rule.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{rule.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {showAuthor && (
              <Link
                {...authorProps}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 ml-4"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={rule.author.avatarUrl}
                    alt={rule.author.displayName}
                  />
                  <AvatarFallback>
                    {rule.author.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              {showAuthor && (
                <Link
                  {...authorProps}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-foreground transition-colors"
                >
                  @{rule.author.handle}
                </Link>
              )}

              <span>{formatRelativeTime(rule.createdAt)}</span>

              {rule.currentVersion && (
                <span>v{rule.currentVersion.version}</span>
              )}
            </div>

            {rule.metrics && (
              <MetricsStrip
                views={rule.metrics.views7}
                copies={rule.metrics.copies7}
                saves={rule.metrics.saves7}
                forks={rule.metrics.forks}
                votes={rule.metrics.votes}
                score={rule.score}
                size="sm"
              />
            )}
          </div>

          {rule.currentVersion?.testedOn && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex flex-wrap gap-1">
                {rule.currentVersion.testedOn.models
                  ?.slice(0, 3)
                  .map((model) => (
                    <Badge key={model} variant="secondary" className="text-xs">
                      {model}
                    </Badge>
                  ))}
                {rule.currentVersion.testedOn.stacks
                  ?.slice(0, 2)
                  .map((stack) => (
                    <Badge key={stack} variant="secondary" className="text-xs">
                      {stack}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Link>
    </Card>
  );
}
