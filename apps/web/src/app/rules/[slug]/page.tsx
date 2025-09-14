import { Suspense } from "react";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui";
import { createServerCaller } from "@/server/trpc";
import { ViewTracker } from "@/components/rules/view-tracker";
import { MetricsStrip } from "@/components/rules/metrics-strip";
import { RuleActions } from "@/components/rules/rule-actions";
import { RuleDetailSkeleton } from "@/components/rules/skeletons";
import { CommentThread } from "@/components/comments/comment-thread";
import { WatchButton } from "@/components/social/watch-button";
import { generateRuleMetadata } from "@/app-meta/seo";
import { formatRelativeTime } from "@/lib/format";
import Link from "next/link";

// Force Node.js runtime for database access
export const runtime = "nodejs";

interface RuleDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: RuleDetailPageProps) {
  try {
    const { slug } = await params;
    const trpc = await createServerCaller();
    const rule = await trpc.rules.getBySlug({ slug });

    if (!rule) {
      return {
        title: "Rule not found",
        description: "The requested rule could not be found.",
      };
    }

    return generateRuleMetadata({
      title: rule.title,
      summary: rule.summary || "",
      slug: rule.slug,
      author: {
        displayName: rule.author.displayName,
        handle: rule.author.handle,
      },
      tags: rule.tags.map((t) => ({ name: t.name })),
    });
  } catch (error) {
    return {
      title: "Rule not found",
      description: "The requested rule could not be found.",
    };
  }
}

export default async function RuleDetailPage({ params }: RuleDetailPageProps) {
  const { slug } = await params;
  const trpc = await createServerCaller();

  try {
    // Fetch rule details first
    const rule = await trpc.rules.getBySlug({ slug });

    if (!rule) {
      notFound();
    }

    // Update metrics, vote data, and watch stats calls with actual rule ID
    const [actualMetrics, voteData, watchStats] = await Promise.all([
      trpc.metrics.getOpenMetrics({ ruleId: rule.id }).catch(() => ({
        views7: 0,
        copies7: 0,
        saves7: 0,
        forks7: 0,
        votes7: 0,
        views30: 0,
        copies30: 0,
        saves30: 0,
        forks30: 0,
        votes30: 0,
        score: 0,
      })),
      trpc.votes.getRuleScore({ ruleId: rule.id }).catch(() => ({
        score: 0,
        upCount: 0,
        downCount: 0,
        myVote: 0,
      })),
      // Temporarily disabled - need to fix tRPC router structure
      Promise.resolve({ watchersCount: 0, isWatching: false }).catch(() => ({
        watchersCount: 0,
        isWatching: false,
      })),
    ]);

    return (
      <div className="container py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* View Tracker - Records view events */}
          <ViewTracker
            ruleId={rule.id}
            ruleVersionId={rule.currentVersion?.id}
          />

          {/* Rule Header */}
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {rule.title}
                  </h1>
                  {rule.summary && (
                    <p className="text-lg text-muted-foreground">
                      {rule.summary}
                    </p>
                  )}
                </div>
                <Badge
                  variant={
                    rule.status === "PUBLISHED" ? "default" : "secondary"
                  }
                >
                  {rule.status}
                </Badge>
              </div>

              {/* Author Info */}
              <div className="flex items-center space-x-4">
                <Link
                  href={`/authors/${rule.author.handle}`}
                  className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={rule.author.avatarUrl || undefined}
                      alt={rule.author.displayName}
                    />
                    <AvatarFallback>
                      {rule.author.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{rule.author.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      @{rule.author.handle}
                    </p>
                  </div>
                </Link>
                <div className="text-sm text-muted-foreground">
                  <p>Created {formatRelativeTime(rule.createdAt)}</p>
                  {rule.currentVersion && (
                    <p>Version {rule.currentVersion.version}</p>
                  )}
                </div>
              </div>

              {/* Tags */}
              {rule.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {rule.tags.map((tag) => (
                    <Link key={tag.id} href={`/rules?tags=${tag.slug}`}>
                      <Badge
                        variant="outline"
                        className="hover:bg-accent cursor-pointer"
                      >
                        {tag.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Metrics Strip */}
            <div className="py-4 border-y">
              <MetricsStrip
                views7={actualMetrics.views7}
                copies7={actualMetrics.copies7}
                saves7={actualMetrics.saves7}
                forks7={actualMetrics.forks7}
                votes7={actualMetrics.votes7}
                views30={actualMetrics.views30}
                copies30={actualMetrics.copies30}
                saves30={actualMetrics.saves30}
                forks30={actualMetrics.forks30}
                votes30={actualMetrics.votes30}
                score={actualMetrics.score}
                period={7}
                size="md"
              />
            </div>

            {/* Rule Actions */}
            <div className="flex items-center justify-between">
              <RuleActions
                rule={{
                  id: rule.id,
                  slug: rule.slug,
                  title: rule.title,
                  body: "", // Temporarily disabled - need to fix data structure
                  author: {
                    id: rule.author.id,
                    handle: rule.author.handle,
                    displayName: rule.author.displayName,
                  },
                }}
                currentVersionId={rule.currentVersion?.id}
                initialMetrics={actualMetrics}
                initialVoteData={voteData}
              />

              <WatchButton
                ruleId={rule.id}
                initialWatching={watchStats.isWatching}
                initialWatchersCount={watchStats.watchersCount}
                size="md"
              />
            </div>
          </div>

          {/* Rule Content */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {rule.currentVersion
                    ? `Version ${rule.currentVersion.version}`
                    : "Content"}
                </h2>
                {rule.currentVersion && (
                  <Link
                    href={`/rules/${rule.slug}/versions`}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    View all versions
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Temporarily disabled - need to fix data structure */}
              <p className="text-muted-foreground italic">
                Content temporarily unavailable.
              </p>
            </CardContent>
          </Card>

          {/* Resource Links */}
          {rule.resourceLinks && rule.resourceLinks.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold">Resources</h2>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {rule.resourceLinks.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 text-primary hover:underline"
                    >
                      <span>{link.label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({link.kind})
                      </span>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Testing Information */}
          {rule.currentVersion?.testedOn && (
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold">Tested On</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rule.currentVersion.testedOn.models &&
                    rule.currentVersion.testedOn.models.length > 0 && (
                      <div>
                        <h3 className="font-medium text-sm text-muted-foreground mb-2">
                          Models
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {rule.currentVersion.testedOn.models.map((model) => (
                            <Badge key={model} variant="secondary">
                              {model}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  {rule.currentVersion.testedOn.stacks &&
                    rule.currentVersion.testedOn.stacks.length > 0 && (
                      <div>
                        <h3 className="font-medium text-sm text-muted-foreground mb-2">
                          Stacks
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {rule.currentVersion.testedOn.stacks.map((stack) => (
                            <Badge key={stack} variant="secondary">
                              {stack}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments Section */}
          <CommentThread ruleId={rule.id} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error loading rule:", error);
    notFound();
  }
}
