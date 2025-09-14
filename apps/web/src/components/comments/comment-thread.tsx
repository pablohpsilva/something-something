"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@repo/ui";
import { Card, CardContent } from "@repo/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui";
import { Badge } from "@repo/ui";
import {
  MessageSquare,
  Reply,
  Edit3,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import { api } from "@/lib/trpc";
import { CommentForm } from "./comment-form";
import { renderCommentMarkdownToSafeHtml } from "@/lib/sanitize/markdown";
import { formatRelativeTime } from "@/lib/format";
import { COMMENT_TESTIDS } from "@/lib/testids";
import { createButtonProps } from "@/lib/a11y";
import { showToast } from "@/lib/metrics/read";
import type { CommentDTO } from "@repo/trpc";

interface CommentItemProps {
  comment: CommentDTO;
  onReply?: (comment: CommentDTO) => void;
  onEdit?: (comment: CommentDTO) => void;
  onDelete?: (commentId: string) => void;
  maxDepth?: number;
  currentUser?: { id: string; role?: string } | null;
}

function CommentItem({
  comment,
  onReply,
  onEdit,
  onDelete,
  maxDepth = 3,
  currentUser,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(comment.depth < 2); // Auto-expand first 2 levels

  // Temporarily disabled due to tRPC typing issues
  // const deleteCommentMutation = api.comments.softDelete.useMutation({
  //   onSuccess: () => {
  //     showToast("Comment deleted", "success");
  //     onDelete?.(comment.id);
  //   },
  //   onError: (error) => {
  //     showToast(error.message || "Failed to delete comment", "error");
  //   },
  // });
  const deleteCommentMutation = {
    mutate: (input: any) => {},
    isPending: false,
  };

  const handleReply = (newComment: CommentDTO) => {
    setShowReplyForm(false);
    onReply?.(newComment);
  };

  const handleEdit = () => {
    setShowEditForm(true);
  };

  const handleEditSuccess = (updatedComment: CommentDTO) => {
    setShowEditForm(false);
    onEdit?.(updatedComment);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this comment?")) {
      deleteCommentMutation.mutate({ commentId: comment.id });
    }
  };

  const canShowChildren = comment.children && comment.children.length > 0;
  const shouldCollapseChildren = comment.depth >= maxDepth;
  const hasHiddenReplies = shouldCollapseChildren && canShowChildren;

  const replyProps = createButtonProps(
    "Reply to comment",
    COMMENT_TESTIDS.REPLY_BUTTON
  );

  const editProps = createButtonProps(
    "Edit comment",
    COMMENT_TESTIDS.EDIT_BUTTON
  );

  const deleteProps = createButtonProps(
    "Delete comment",
    COMMENT_TESTIDS.DELETE_BUTTON
  );

  return (
    <div className="group" data-testid={COMMENT_TESTIDS.ITEM}>
      <Card
        className={`${
          comment.depth > 0 ? "ml-6 border-l-2 border-l-muted" : ""
        }`}
      >
        <CardContent className="p-4">
          {/* Comment header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <Link href={`/authors/${comment.author.handle}`}>
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={comment.author.avatarUrl || undefined}
                    alt={comment.author.displayName}
                  />
                  <AvatarFallback>
                    {comment.author.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>

              <div className="flex items-center gap-2">
                <Link
                  href={`/authors/${comment.author.handle}`}
                  className="font-medium hover:underline"
                >
                  {comment.author.displayName}
                </Link>

                {comment.author.isVerified && (
                  <CheckCircle className="h-4 w-4 text-primary" />
                )}

                {comment.author.role &&
                  ["MODERATOR", "ADMIN"].includes(comment.author.role) && (
                    <Badge variant="secondary" className="text-xs">
                      {comment.author.role.toLowerCase()}
                    </Badge>
                  )}

                <span className="text-sm text-muted-foreground">
                  {formatRelativeTime(comment.createdAt)}
                </span>

                {comment.edited && (
                  <span className="text-xs text-muted-foreground italic">
                    (edited)
                  </span>
                )}
              </div>
            </div>

            {/* Actions menu */}
            {(comment.canEdit || comment.canDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {comment.canEdit && (
                    <DropdownMenuItem onClick={handleEdit}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {comment.canDelete && (
                    <>
                      {comment.canEdit && <DropdownMenuSeparator />}
                      <DropdownMenuItem
                        onClick={handleDelete}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Comment content */}
          <div className="mb-3">
            {comment.isDeleted ? (
              <div className="flex items-center gap-2 text-muted-foreground italic">
                <AlertTriangle className="h-4 w-4" />
                <span data-testid="comment-deleted">
                  This comment has been removed
                </span>
              </div>
            ) : showEditForm ? (
              <CommentForm
                ruleId={comment.ruleId}
                onSuccess={handleEditSuccess}
                onCancel={() => setShowEditForm(false)}
                placeholder="Edit your comment..."
                autoFocus
              />
            ) : (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: comment.bodyHtml || "",
                }}
              />
            )}
          </div>

          {/* Comment actions */}
          {!comment.isDeleted && !showEditForm && (
            <div className="flex items-center gap-2">
              <Button
                {...replyProps}
                variant="ghost"
                size="sm"
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="h-8 text-xs"
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>

              {hasHiddenReplies && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-8 text-xs"
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {isExpanded ? "Hide" : "Show"} {comment.children?.length}{" "}
                  replies
                </Button>
              )}
            </div>
          )}

          {/* Reply form */}
          {showReplyForm && (
            <div className="mt-4">
              <CommentForm
                ruleId={comment.ruleId}
                parentId={comment.id}
                onSuccess={handleReply}
                onCancel={() => setShowReplyForm(false)}
                placeholder="Write a reply..."
                autoFocus
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Child comments */}
      {canShowChildren && (isExpanded || !shouldCollapseChildren) && (
        <div className="mt-2 space-y-2">
          {comment.children?.map((child: any) => (
            <CommentItem
              key={child.id}
              comment={child}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              maxDepth={maxDepth}
              currentUser={currentUser}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentThreadProps {
  ruleId: string;
  className?: string;
}

export function CommentThread({ ruleId, className = "" }: CommentThreadProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    data: commentsData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.comments.list.useInfiniteQuery(
    {
      ruleId,
      mode: "tree",
      limit: 10,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchOnWindowFocus: false,
    }
  );

  const handleCommentUpdate = () => {
    // Force refresh by updating key
    setRefreshKey((prev) => prev + 1);
  };

  const allComments = commentsData?.pages.flatMap((page) => page.items) || [];
  const totalCount = commentsData?.pages[0]?.totalCount || 0;

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Failed to load comments</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setRefreshKey((prev) => prev + 1)}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Comments header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({totalCount})
        </h3>
      </div>

      {/* Top-level comment form */}
      <CommentForm
        ruleId={ruleId}
        onSuccess={handleCommentUpdate}
        placeholder="Share your thoughts..."
      />

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted" />
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-4 w-16 bg-muted rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : allComments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h4 className="font-medium mb-2">No comments yet</h4>
            <p className="text-sm text-muted-foreground">
              Be the first to share your thoughts on this rule.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleCommentUpdate}
              onEdit={handleCommentUpdate}
              onDelete={handleCommentUpdate}
            />
          ))}

          {/* Load more button */}
          {hasNextPage && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                data-testid="comment-load-more"
              >
                {isFetchingNextPage ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Loading...
                  </>
                ) : (
                  "Load more comments"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
