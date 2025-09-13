import { RuleDetailSkeleton } from "@/components/rules/skeletons";

export default function RuleDetailLoading() {
  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        <RuleDetailSkeleton />
      </div>
    </div>
  );
}
