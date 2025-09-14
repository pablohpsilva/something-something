import { Badge } from "@/components/ui";
import { CheckCircle } from "lucide-react";

interface AuthorClaimBadgeProps {
  hasApprovedClaim?: boolean;
  className?: string;
}

export function AuthorClaimBadge({
  hasApprovedClaim,
  className,
}: AuthorClaimBadgeProps) {
  if (!hasApprovedClaim) return null;

  return (
    <Badge
      variant="default"
      className={`bg-green-100 text-green-800 border-green-200 ${className}`}
    >
      <CheckCircle className="mr-1 h-3 w-3" />
      Claimed by author
    </Badge>
  );
}
