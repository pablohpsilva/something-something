"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@repo/ui";
import { Badge } from "@repo/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@repo/ui";
import { Bell, Check } from "lucide-react";
import { api } from "@/lib/trpc";
import { formatRelativeTime } from "@/lib/format";
import { NOTIFICATIONS_TESTIDS } from "@/lib/testids";

export function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false);

  // Get unread count
  const { data: unreadData } = api.social.notifications.unreadCount.useQuery(
    undefined,
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Get recent notifications for dropdown
  const { data: notificationsData } = api.social.notifications.list.useQuery(
    { limit: 10 },
    {
      enabled: isOpen, // Only fetch when dropdown is open
    }
  );

  const markReadMutation = api.social.notifications.markRead.useMutation({
    onSuccess: () => {
      // Refetch unread count and notifications
      api.useUtils().social.notifications.unreadCount.invalidate();
      api.useUtils().social.notifications.list.invalidate();
    },
  });

  const handleMarkRead = (id: string) => {
    markReadMutation.mutate({ id });
  };

  const unreadCount = unreadData?.count || 0;
  const notifications = notificationsData?.items || [];

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative"
          data-testid={NOTIFICATIONS_TESTIDS.BELL}
          aria-label={`Notifications${
            unreadCount > 0 ? ` (${unreadCount} unread)` : ""
          }`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
              aria-live="polite"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {notifications.length > 0 && (
              <Link href="/notifications">
                <Button variant="ghost" size="sm" className="text-xs">
                  View all
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`relative p-3 border-b last:border-b-0 hover:bg-accent/50 ${
                  !notification.readAt ? "bg-accent/20" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>

                  {!notification.readAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0 z-10 relative"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleMarkRead(notification.id);
                      }}
                      aria-label="Mark as read"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {notification.actionUrl && (
                  <Link
                    href={notification.actionUrl}
                    className="absolute inset-0"
                    onClick={() => {
                      if (!notification.readAt) {
                        handleMarkRead(notification.id);
                      }
                      setIsOpen(false);
                    }}
                  >
                    <span className="sr-only">View notification</span>
                  </Link>
                )}
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-3 border-t">
            <Link href="/notifications">
              <Button variant="outline" size="sm" className="w-full">
                View all notifications
              </Button>
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
