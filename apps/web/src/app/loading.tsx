import { RuleListSkeleton } from "@/components/rules/skeletons";

export default function Loading() {
  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-96 bg-muted animate-pulse rounded" />
        </div>
        <RuleListSkeleton />
      </div>
    </div>
  );
}
