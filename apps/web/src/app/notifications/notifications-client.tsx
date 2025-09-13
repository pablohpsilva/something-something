"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  AlertCircle,
  GitBranch,
  MessageSquare,
  FileText,
  Heart,
  DollarSign,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { api } from "@/lib/trpc";
import { formatRelativeTime } from "@/lib/format";
import { showToast } from "@/lib/metrics/read";
import { NOTIFICATIONS_TESTIDS } from "@/lib/testids";
import type { NotificationsListResponse } from "@repo/trpc/schemas/social";

interface NotificationsClientProps {
  initialData: NotificationsListResponse;
}

const NOTIFICATION_ICONS = {
  NEW_VERSION: GitBranch,
  COMMENT_REPLY: MessageSquare,
  AUTHOR_PUBLISHED: FileText,
  CLAIM_VERDICT: AlertCircle,
  DONATION_RECEIVED: DollarSign,
};

export function NotificationsClient({ initialData }: NotificationsClientProps) {
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    api.social.notifications.list.useInfiniteQuery(
      { limit: 30, filter },
      {
        initialData: {
          pages: [initialData],
          pageParams: [undefined],
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const markReadMutation = api.social.notifications.markRead.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      showToast(error.message || "Failed to mark as read", "error");
    },
  });

  const markAllReadMutation = api.social.notifications.markAllRead.useMutation({
    onSuccess: (result) => {
      showToast(`Marked ${result.updated} notifications as read`, "success");
      refetch();
    },
    onError: (error) => {
      showToast(error.message || "Failed to mark all as read", "error");
    },
  });

  const deleteNotificationMutation =
    api.social.notifications.delete.useMutation({
      onSuccess: () => {
        showToast("Notification deleted", "success");
        refetch();
      },
      onError: (error) => {
        showToast(error.message || "Failed to delete notification", "error");
      },
    });

  const handleMarkRead = (id: string) => {
    markReadMutation.mutate({ id });
  };

  const handleMarkAllRead = () => {
    if (confirm("Mark all notifications as read?")) {
      markAllReadMutation.mutate();
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this notification?")) {
      deleteNotificationMutation.mutate({ id });
    }
  };

  const allNotifications = data?.pages.flatMap((page) => page.items) || [];
  const unreadCount = data?.pages[0]?.unreadCount || 0;

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {filter === "all" ? "All" : "Unread"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilter("all")}>
                All notifications
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("unread")}>
                Unread only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} unread</Badge>
          )}
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markAllReadMutation.isPending}
            data-testid={NOTIFICATIONS_TESTIDS.MARK_ALL}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notifications list */}
      <div className="space-y-3" data-testid={NOTIFICATIONS_TESTIDS.LIST}>
        {allNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-medium mb-2">No notifications</h3>
              <p className="text-sm text-muted-foreground">
                {filter === "unread"
                  ? "You're all caught up! No unread notifications."
                  : "You don't have any notifications yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          allNotifications.map((notification) => {
            const IconComponent = NOTIFICATION_ICONS[notification.type] || Bell;

            return (
              <Card
                key={notification.id}
                className={`transition-colors ${
                  !notification.readAt
                    ? "bg-accent/20 border-l-4 border-l-primary"
                    : ""
                }`}
                data-testid={NOTIFICATIONS_TESTIDS.ITEM}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={`p-2 rounded-full ${
                        !notification.readAt ? "bg-primary/10" : "bg-muted"
                      }`}
                    >
                      <IconComponent
                        className={`h-4 w-4 ${
                          !notification.readAt
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>

                          {/* Actor info */}
                          {notification.actor && (
                            <div className="flex items-center gap-2 mt-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage
                                  src={
                                    notification.actor.avatarUrl || undefined
                                  }
                                  alt={notification.actor.displayName}
                                />
                                <AvatarFallback className="text-xs">
                                  {notification.actor.displayName
                                    .charAt(0)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground">
                                {notification.actor.displayName}
                              </span>
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground mt-2">
                            {formatRelativeTime(notification.createdAt)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!notification.readAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleMarkRead(notification.id)}
                              disabled={markReadMutation.isPending}
                              data-testid={NOTIFICATIONS_TESTIDS.MARK_READ}
                              aria-label="Mark as read"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(notification.id)}
                            disabled={deleteNotificationMutation.isPending}
                            data-testid={NOTIFICATIONS_TESTIDS.DELETE}
                            aria-label="Delete notification"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Action link overlay */}
                      {notification.actionUrl && (
                        <Link
                          href={notification.actionUrl}
                          className="absolute inset-0 z-0"
                          onClick={() => {
                            if (!notification.readAt) {
                              handleMarkRead(notification.id);
                            }
                          }}
                        >
                          <span className="sr-only">View notification</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Load more */}
      {hasNextPage && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            data-testid={NOTIFICATIONS_TESTIDS.LOAD_MORE}
          >
            {isFetchingNextPage ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
