import { useState } from "react";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ModerationNoticeProps {
  type: "comment" | "rule";
  reason?: string;
  deletedAt?: Date;
  className?: string;
  showContent?: boolean;
  onToggleContent?: () => void;
}

export function ModerationNotice({
  type,
  reason,
  deletedAt,
  className,
  showContent = false,
  onToggleContent,
}: ModerationNoticeProps) {
  if (!deletedAt) return null;

  return (
    <Card className={cn("border-orange-200 bg-orange-50", className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className="text-orange-700 border-orange-300"
              >
                Removed by moderator
              </Badge>
              <span className="text-sm text-orange-700">
                {new Date(deletedAt).toLocaleDateString()}
              </span>
            </div>

            <p className="text-sm text-orange-800 mb-2">
              This {type} has been removed for violating our community
              guidelines.
            </p>

            {reason && (
              <p className="text-sm text-orange-700">
                <span className="font-medium">Reason:</span> {reason}
              </p>
            )}

            {onToggleContent && (
              <button
                onClick={onToggleContent}
                className="mt-3 inline-flex items-center text-sm text-orange-700 hover:text-orange-900 font-medium"
              >
                {showContent ? (
                  <>
                    <EyeOff className="mr-1 h-4 w-4" />
                    Hide content
                  </>
                ) : (
                  <>
                    <Eye className="mr-1 h-4 w-4" />
                    Show content (moderator view)
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CommentModerationWrapper({
  comment,
  children,
  canViewDeleted = false,
}: {
  comment: {
    id: string;
    deletedAt?: Date | null;
    body?: string;
  };
  children: React.ReactNode;
  canViewDeleted?: boolean;
}) {
  const [showContent, setShowContent] = useState(false);

  if (!comment.deletedAt) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-3">
      <ModerationNotice
        type="comment"
        deletedAt={comment.deletedAt}
        showContent={showContent}
        onToggleContent={
          canViewDeleted ? () => setShowContent(!showContent) : undefined
        }
      />

      {showContent && canViewDeleted && (
        <div className="opacity-60">{children}</div>
      )}
    </div>
  );
}
