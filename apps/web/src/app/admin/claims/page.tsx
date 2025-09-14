"use client";

import { useState } from "react";
import { api } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import { Badge } from "@repo/ui";
import { Button } from "@repo/ui";
import { Skeleton } from "@repo/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { Textarea } from "@repo/ui";
import { Label } from "@repo/ui";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Eye, Check, X, FileText } from "lucide-react";

interface ClaimReviewDialogProps {
  claimId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function ClaimReviewDialog({
  claimId,
  isOpen,
  onClose,
  onSuccess,
}: ClaimReviewDialogProps) {
  const [reviewNote, setReviewNote] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const { data: claim, isLoading } = api.admin.getClaim.useQuery(
    { id: claimId! },
    { enabled: !!claimId }
  );

  const approveMutation = api.admin.approveClaim.useMutation({
    onSuccess: () => {
      toast.success("Claim approved successfully");
      onSuccess();
      onClose();
      setReviewNote("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = api.admin.rejectClaim.useMutation({
    onSuccess: () => {
      toast.success("Claim rejected");
      onSuccess();
      onClose();
      setReviewNote("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleApprove = async () => {
    if (!claimId) return;
    setIsApproving(true);
    try {
      await approveMutation.mutateAsync({
        id: claimId,
        reviewNote: reviewNote || undefined,
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!claimId || !reviewNote.trim()) {
      toast.error("Review note is required for rejection");
      return;
    }
    setIsRejecting(true);
    try {
      await rejectMutation.mutateAsync({
        id: claimId,
        reviewNote,
      });
    } finally {
      setIsRejecting(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Review Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!claim) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Author Claim</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Rule Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rule Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Title
                </Label>
                <p className="text-lg font-medium">{claim.rule.title}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Current Author
                </Label>
                <p>
                  {claim.rule.createdBy.displayName} (@
                  {claim.rule.createdBy.handle})
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Rule Content (Preview)
                </Label>
                <div className="rounded-lg bg-gray-50 p-4 max-h-40 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm">
                    {claim.rule.currentVersion?.body?.substring(0, 500)}
                    {claim.rule.currentVersion?.body &&
                      claim.rule.currentVersion.body.length > 500 &&
                      "..."}
                  </pre>
                </div>
                <a
                  href={`/rules/${claim.rule.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  View full rule <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Claimant Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Claimant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Name
                </Label>
                <p>
                  {claim.claimant.displayName} (@{claim.claimant.handle})
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Member Since
                </Label>
                <p>
                  {formatDistanceToNow(new Date(claim.claimant.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Evidence Provided
                </Label>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="whitespace-pre-wrap text-sm">
                    {claim.evidence}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Claim Submitted
                </Label>
                <p>
                  {formatDistanceToNow(new Date(claim.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Review Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Review Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="reviewNote">Review Note</Label>
                <Textarea
                  id="reviewNote"
                  placeholder="Add a note about your decision (required for rejection)..."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={handleApprove}
                  disabled={isApproving || isRejecting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isApproving ? (
                    "Approving..."
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Approve Claim
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={isApproving || isRejecting || !reviewNote.trim()}
                  variant="destructive"
                >
                  {isRejecting ? (
                    "Rejecting..."
                  ) : (
                    <>
                      <X className="mr-2 h-4 w-4" />
                      Reject Claim
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminClaimsPage() {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data, isLoading, refetch } = api.admin.getPendingClaims.useQuery({
    limit: 20,
  });

  const handleReviewClaim = (claimId: string) => {
    setSelectedClaimId(claimId);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedClaimId(null);
  };

  const handleSuccess = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Author Claims</h1>
          <p className="mt-2 text-gray-600">Review and manage author claims.</p>
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
        <h1 className="text-3xl font-bold text-gray-900">Author Claims</h1>
        <p className="mt-2 text-gray-600">
          Review and manage author claims for rules.
        </p>
      </div>

      {claims.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No pending claims
            </h3>
            <p className="text-gray-600 text-center">
              All author claims have been reviewed. New claims will appear here
              when submitted.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {claims.map((claim: any) => (
            <Card key={claim.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        {claim.rule.title}
                      </h3>
                      <Badge variant="secondary">{claim.status}</Badge>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">Claimant:</span>{" "}
                        {claim.claimant.displayName} (@{claim.claimant.handle})
                      </p>
                      <p>
                        <span className="font-medium">Current Author:</span>{" "}
                        {claim.rule.createdBy.displayName} (@
                        {claim.rule.createdBy.handle})
                      </p>
                      <p>
                        <span className="font-medium">Submitted:</span>{" "}
                        {formatDistanceToNow(new Date(claim.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                      <p>
                        <span className="font-medium">Evidence:</span>{" "}
                        {claim.evidence.substring(0, 150)}
                        {claim.evidence.length > 150 && "..."}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      onClick={() => handleReviewClaim(claim.id)}
                      size="sm"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Review
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClaimReviewDialog
        claimId={selectedClaimId}
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
