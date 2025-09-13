"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/ui/components/ui/dropdown-menu";
import { Badge } from "@repo/ui/components/ui/badge";
import { api } from "@/lib/trpc";
import { NOTIFICATION_TESTIDS } from "@/lib/testids";
import { createButtonProps } from "@/lib/a11y";
import { formatRelativeTime } from "@/lib/format";
import Link from "next/link";

export function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notifications with unread count
  const { data: notifications, isLoading } =
    api.social.listNotifications.useQuery(
      { limit: 5 },
      {
        enabled: true,
        refetchInterval: 30000, // Refetch every 30 seconds
      }
    );

  const unreadCount = notifications?.items.filter((n) => !n.readAt).length || 0;

  const bellProps = createButtonProps(
    unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications",
    NOTIFICATION_TESTIDS.BELL
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button {...bellProps} variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              data-testid={NOTIFICATION_TESTIDS.BADGE}
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-2">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              data-testid={NOTIFICATION_TESTIDS.MARK_ALL_READ}
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={() => {
                // TODO: Implement mark all as read
                console.log("Mark all as read");
              }}
            >
              Mark all read
            </Button>
          )}
        </div>

        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading notifications...
          </div>
        ) : !notifications?.items.length ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <>
            {notifications.items.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                data-testid={NOTIFICATION_TESTIDS.ITEM}
                className={`flex flex-col items-start p-3 ${
                  !notification.readAt ? "bg-accent/50" : ""
                }`}
                asChild
              >
                <Link href={`/notifications#${notification.id}`}>
                  <div className="flex w-full items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.body}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.readAt && (
                      <div className="ml-2 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link
                href="/notifications"
                className="w-full text-center text-sm font-medium"
              >
                View all notifications
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
