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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Trash2, ExternalLink, AlertTriangle } from "lucide-react";

interface ModerationDialogProps {
  content: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function ModerationDialog({
  content,
  isOpen,
  onClose,
  onSuccess,
}: ModerationDialogProps) {
  const [reason, setReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteCommentMutation = api.admin.deleteComment.useMutation({
    onSuccess: () => {
      toast.success("Comment deleted successfully");
      onSuccess();
      onClose();
      setReason("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deprecateRuleMutation = api.admin.deprecateRule.useMutation({
    onSuccess: () => {
      toast.success("Rule deprecated successfully");
      onSuccess();
      onClose();
      setReason("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleDelete = async () => {
    if (!content || !reason.trim()) {
      toast.error("Reason is required");
      return;
    }

    setIsDeleting(true);
    try {
      if (content.type === "comment") {
        await deleteCommentMutation.mutateAsync({
          id: content.id,
          reason,
        });
      } else if (content.type === "rule") {
        await deprecateRuleMutation.mutateAsync({
          id: content.id,
          reason,
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!content) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Moderate {content.type === "comment" ? "Comment" : "Rule"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Content Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Content Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {content.type === "comment" ? (
                <>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">
                      Comment
                    </Label>
                    <div className="rounded-lg bg-gray-50 p-4 mt-1">
                      <p className="whitespace-pre-wrap text-sm">
                        {content.body}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">
                      Author
                    </Label>
                    <p>
                      {content.author.displayName} (@{content.author.handle})
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">
                      Rule
                    </Label>
                    <a
                      href={`/rules/${content.rule.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800"
                    >
                      {content.rule.title}{" "}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">
                      Rule Title
                    </Label>
                    <p className="text-lg font-medium">{content.title}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">
                      Author
                    </Label>
                    <p>
                      {content.createdBy.displayName} (@
                      {content.createdBy.handle})
                    </p>
                  </div>
                </>
              )}
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Created
                </Label>
                <p>
                  {formatDistanceToNow(new Date(content.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Moderation Action */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Moderation Action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="reason">Reason for Action *</Label>
                <Textarea
                  id="reason"
                  placeholder="Explain why this content is being moderated..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting || !reason.trim()}
                  variant="destructive"
                >
                  {isDeleting ? (
                    "Processing..."
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {content.type === "comment"
                        ? "Delete Comment"
                        : "Deprecate Rule"}
                    </>
                  )}
                </Button>
              </div>

              <div className="rounded-lg bg-yellow-50 p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">This action cannot be undone.</p>
                    <p className="mt-1">
                      {content.type === "comment"
                        ? "The comment will be soft-deleted and marked as 'removed by moderator'."
                        : "The rule will be deprecated and no longer visible to users."}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminModerationPage() {
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [contentType, setContentType] = useState<"comment" | "rule">("comment");

  const { data, isLoading, refetch } = api.admin.getFlaggedContent.useQuery({
    type: contentType,
    limit: 20,
  });

  const handleModerateContent = (content: any) => {
    setSelectedContent(content);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedContent(null);
  };

  const handleSuccess = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Content Moderation
          </h1>
          <p className="mt-2 text-gray-600">
            Review and moderate platform content.
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

  const content = data?.items || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Content Moderation</h1>
        <p className="mt-2 text-gray-600">
          Review and moderate platform content for policy violations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="contentType">Content Type</Label>
            <Select
              value={contentType}
              onValueChange={(value: "comment" | "rule") =>
                setContentType(value)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comment">Comments</SelectItem>
                <SelectItem value="rule">Rules</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {content.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No content to review
            </h3>
            <p className="text-gray-600 text-center">
              All {contentType}s are currently in good standing. Flagged content
              will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {content.map((item: any) => (
            <Card key={item.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        {item.type === "comment" ? "Comment" : item.title}
                      </h3>
                      <Badge variant="outline">{item.type}</Badge>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">Author:</span>{" "}
                        {item.author.displayName} (@{item.author.handle})
                      </p>
                      {item.type === "comment" && (
                        <p>
                          <span className="font-medium">Rule:</span>{" "}
                          {item.rule.title}
                        </p>
                      )}
                      <p>
                        <span className="font-medium">Created:</span>{" "}
                        {formatDistanceToNow(new Date(item.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                      {item.type === "comment" && (
                        <div>
                          <span className="font-medium">Content:</span>
                          <div className="mt-1 p-3 bg-gray-50 rounded text-sm">
                            {item.body.substring(0, 200)}
                            {item.body.length > 200 && "..."}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      onClick={() => handleModerateContent(item)}
                      size="sm"
                      variant="outline"
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Moderate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ModerationDialog
        content={selectedContent}
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
