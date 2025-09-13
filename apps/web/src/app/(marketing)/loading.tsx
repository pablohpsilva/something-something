import { RuleListSkeleton } from "@/components/rules/skeletons";

export default function MarketingLoading() {
  return (
    <div className="space-y-12">
      {/* Hero Section Skeleton */}
      <section className="relative py-20 bg-gradient-to-br from-background to-muted/20">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <div className="h-16 bg-muted animate-pulse rounded mx-auto max-w-3xl" />
              <div className="h-6 bg-muted animate-pulse rounded mx-auto max-w-2xl" />
              <div className="h-6 bg-muted animate-pulse rounded mx-auto max-w-xl" />
            </div>
            <div className="h-12 bg-muted animate-pulse rounded max-w-2xl mx-auto" />
            <div className="flex gap-4 justify-center">
              <div className="h-11 w-32 bg-muted animate-pulse rounded" />
              <div className="h-11 w-32 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section Skeleton */}
      <section className="py-12 border-y bg-muted/20">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center space-y-2">
                <div className="h-8 w-8 bg-muted animate-pulse rounded mx-auto" />
                <div className="h-8 w-16 bg-muted animate-pulse rounded mx-auto" />
                <div className="h-4 w-24 bg-muted animate-pulse rounded mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Rules Section Skeleton */}
      <section className="py-12">
        <div className="container">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-8 w-64 bg-muted animate-pulse rounded" />
                <div className="h-4 w-96 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-10 w-32 bg-muted animate-pulse rounded" />
            </div>
            <RuleListSkeleton count={6} />
          </div>
        </div>
      </section>
    </div>
  );
}
