import { Eye, Copy, Heart, GitFork, ThumbsUp } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { METRICS_TESTIDS } from "@/lib/testids";
import { createMetricProps } from "@/lib/a11y";

interface MetricsStripProps {
  views7?: number;
  copies7?: number;
  saves7?: number;
  forks7?: number;
  votes7?: number;
  views30?: number;
  copies30?: number;
  saves30?: number;
  forks30?: number;
  votes30?: number;
  score?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  period?: 7 | 30;
}

export function MetricsStrip({
  views7 = 0,
  copies7 = 0,
  saves7 = 0,
  forks7 = 0,
  votes7 = 0,
  views30 = 0,
  copies30 = 0,
  saves30 = 0,
  forks30 = 0,
  votes30 = 0,
  score = 0,
  className = "",
  size = "md",
  period = 7,
}: MetricsStripProps) {
  // Use the appropriate period's metrics
  const views = period === 7 ? views7 : views30;
  const copies = period === 7 ? copies7 : copies30;
  const saves = period === 7 ? saves7 : saves30;
  const forks = period === 7 ? forks7 : forks30;
  const votes = period === 7 ? votes7 : votes30;
  const iconSize = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }[size];

  const textSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  const spacing = {
    sm: "space-x-3",
    md: "space-x-4",
    lg: "space-x-6",
  }[size];

  const metrics = [
    {
      icon: Eye,
      value: views,
      label: "Views",
      testId: METRICS_TESTIDS.VIEWS,
    },
    {
      icon: Copy,
      value: copies,
      label: "Copies",
      testId: METRICS_TESTIDS.COPIES,
    },
    {
      icon: Heart,
      value: saves,
      label: "Saves",
      testId: METRICS_TESTIDS.SAVES,
    },
    {
      icon: GitFork,
      value: forks,
      label: "Forks",
      testId: METRICS_TESTIDS.FORKS,
    },
    {
      icon: ThumbsUp,
      value: votes,
      label: "Votes",
      testId: METRICS_TESTIDS.VOTES,
    },
  ];

  // Filter out zero values for cleaner display
  const visibleMetrics = metrics.filter((metric) => metric.value > 0);

  return (
    <div
      className={`flex items-center ${spacing} ${className}`}
      aria-label="Rule metrics"
    >
      {visibleMetrics.map(({ icon: Icon, value, label, testId }) => {
        const metricProps = createMetricProps(
          `${label} last ${period} days`,
          formatNumber(value),
          testId
        );

        return (
          <div
            key={testId}
            {...metricProps}
            className="flex items-center space-x-1 text-muted-foreground"
          >
            <Icon className={iconSize} />
            <span className={`${textSize} font-medium`}>
              {formatNumber(value)}
            </span>
          </div>
        );
      })}

      {score > 0 && (
        <div
          {...createMetricProps(
            "Score",
            formatNumber(score),
            METRICS_TESTIDS.SCORE
          )}
          className="flex items-center space-x-1 text-primary font-semibold"
        >
          <span className={`${textSize}`}>{formatNumber(score)} pts</span>
        </div>
      )}
    </div>
  );
}
