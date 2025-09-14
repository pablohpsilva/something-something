"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@repo/ui";
import { Textarea } from "@repo/ui";
import { Card, CardContent } from "@repo/ui";
import { MessageSquare, Send, X, AlertCircle } from "lucide-react";
import { api } from "@/lib/trpc";
import {
  validateMarkdownContent,
  getMarkdownPreview,
} from "@/lib/sanitize/markdown";
import { COMMENT_TESTIDS } from "@/lib/testids";
import { createButtonProps, createFieldProps } from "@/lib/a11y";
import { showToast } from "@/lib/metrics/read";
import type { CommentDTO } from "@repo/trpc/schemas/dto";

interface CommentFormProps {
  ruleId: string;
  parentId?: string;
  onSuccess?: (newComment: CommentDTO) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function CommentForm({
  ruleId,
  parentId,
  onSuccess,
  onCancel,
  placeholder = "Write a comment...",
  autoFocus = false,
  className = "",
}: CommentFormProps) {
  const [body, setBody] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createCommentMutation = api.comments.create.useMutation({
    onSuccess: (newComment) => {
      setBody("");
      setValidationErrors([]);
      showToast("Comment posted successfully!", "success");
      onSuccess?.(newComment);
    },
    onError: (error) => {
      console.error("Failed to create comment:", error);
      showToast(error.message || "Failed to post comment", "error");
    },
  });

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [body]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate content
    const validation = validateMarkdownContent(body);
    if (!validation.isValid) {
      setValidationErrors(validation.issues);
      return;
    }

    setValidationErrors([]);

    createCommentMutation.mutate({
      ruleId,
      parentId,
      body: body.trim(),
    });
  };

  const handleCancel = () => {
    setBody("");
    setValidationErrors([]);
    setIsPreview(false);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isSubmitting = createCommentMutation.isPending;
  const hasContent = body.trim().length > 0;
  const charCount = body.length;
  const maxChars = 5000;
  const isOverLimit = charCount > maxChars;

  const textareaProps = createFieldProps(
    "comment-body",
    "Comment content",
    COMMENT_TESTIDS.FORM,
    true,
    validationErrors.length > 0 ? validationErrors[0] : undefined
  );

  const submitProps = createButtonProps(
    parentId ? "Post reply" : "Post comment",
    COMMENT_TESTIDS.SUBMIT_BUTTON,
    isSubmitting || !hasContent || isOverLimit
  );

  const cancelProps = createButtonProps(
    "Cancel",
    COMMENT_TESTIDS.CANCEL_BUTTON,
    isSubmitting
  );

  return (
    <Card className={`${className}`}>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {parentId ? "Reply to comment" : "Add a comment"}
            </span>
          </div>

          {/* Content area */}
          <div className="space-y-2">
            {!isPreview ? (
              <Textarea
                {...textareaProps}
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="min-h-[80px] resize-none"
                disabled={isSubmitting}
              />
            ) : (
              <div className="min-h-[80px] p-3 border rounded-md bg-muted/50">
                <div className="prose prose-sm max-w-none">
                  {hasContent ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: getMarkdownPreview(body, 1000),
                      }}
                    />
                  ) : (
                    <p className="text-muted-foreground italic">
                      Nothing to preview
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Character count and validation errors */}
            <div className="flex items-center justify-between text-xs">
              <div className="space-y-1">
                {validationErrors.length > 0 && (
                  <div className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    <span>{validationErrors[0]}</span>
                  </div>
                )}
              </div>
              <div
                className={`${
                  isOverLimit ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {charCount.toLocaleString()}/{maxChars.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsPreview(!isPreview)}
                disabled={isSubmitting}
                className="text-xs"
              >
                {isPreview ? "Edit" : "Preview"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Markdown supported
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onCancel && (
                <Button
                  {...cancelProps}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
              <Button
                {...submitProps}
                type="submit"
                size="sm"
                disabled={isSubmitting || !hasContent || isOverLimit}
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    {parentId ? "Reply" : "Comment"}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Keyboard shortcut hint */}
          <div className="text-xs text-muted-foreground">
            Press{" "}
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
              Ctrl+Enter
            </kbd>{" "}
            to submit
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
