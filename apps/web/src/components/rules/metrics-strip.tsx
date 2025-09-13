import { Eye, Copy, Heart, GitFork, ThumbsUp } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { METRICS_TESTIDS } from "@/lib/testids";
import { createMetricProps } from "@/lib/a11y";

interface MetricsStripProps {
  views?: number;
  copies?: number;
  saves?: number;
  forks?: number;
  votes?: number;
  score?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function MetricsStrip({
  views = 0,
  copies = 0,
  saves = 0,
  forks = 0,
  votes = 0,
  score = 0,
  className = "",
  size = "md",
}: MetricsStripProps) {
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
          label,
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
