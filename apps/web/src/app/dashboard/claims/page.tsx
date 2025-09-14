"use client";

import { api } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { FileText, Clock, CheckCircle, XCircle, Trash2 } from "lucide-react";

const statusIcons = {
  PENDING: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
};

const statusColors = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function ClaimsPage() {
  const { data, isLoading, refetch } = api.claims.getMyClaims.useQuery({
    limit: 20,
  });

  const cancelClaimMutation = api.claims.cancel.useMutation({
    onSuccess: () => {
      toast.success("Claim cancelled successfully");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleCancelClaim = async (claimId: string) => {
    if (confirm("Are you sure you want to cancel this claim?")) {
      await cancelClaimMutation.mutateAsync({ id: claimId });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Author Claims</h1>
          <p className="mt-2 text-gray-600">
            Track your authorship claims and their status.
          </p>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const claims = data?.items || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Author Claims</h1>
        <p className="mt-2 text-gray-600">
          Track your authorship claims and their review status.
        </p>
      </div>

      {claims.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No claims submitted
            </h3>
            <p className="text-gray-600 text-center">
              You haven't submitted any authorship claims yet. If you believe
              you're the original author of a rule, you can claim it from the
              rule's page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {claims.map((claim: any) => {
            const StatusIcon =
              statusIcons[claim.status as keyof typeof statusIcons];
            const statusColor =
              statusColors[claim.status as keyof typeof statusColors];

            return (
              <Card key={claim.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-medium text-gray-900">
                          {claim.rule.title}
                        </h3>
                        <Badge className={statusColor}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {claim.status}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Submitted:</span>{" "}
                          {formatDistanceToNow(new Date(claim.createdAt), {
                            addSuffix: true,
                          })}
                        </p>

                        {claim.reviewedAt && (
                          <p>
                            <span className="font-medium">Reviewed:</span>{" "}
                            {formatDistanceToNow(new Date(claim.reviewedAt), {
                              addSuffix: true,
                            })}
                            {claim.reviewer && (
                              <span> by {claim.reviewer.displayName}</span>
                            )}
                          </p>
                        )}

                        <div>
                          <span className="font-medium">Evidence:</span>
                          <div className="mt-1 p-3 bg-gray-50 rounded text-sm">
                            {claim.evidence.length > 200
                              ? `${claim.evidence.substring(0, 200)}...`
                              : claim.evidence}
                          </div>
                        </div>

                        {claim.reviewNote && (
                          <div>
                            <span className="font-medium">Review Note:</span>
                            <div className="mt-1 p-3 bg-gray-50 rounded text-sm">
                              {claim.reviewNote}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <a
                        href={`/rules/${claim.rule.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          View Rule
                        </Button>
                      </a>

                      {claim.status === "PENDING" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelClaim(claim.id)}
                          disabled={cancelClaimMutation.isPending}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
