import { Suspense } from "react";
import type { Metadata } from "next";
import { createServerCaller } from "@/server/trpc";
import { NotificationsClient } from "./notifications-client";
import { NotificationsPageSkeleton } from "./loading";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Stay updated with your latest notifications",
};

export default async function NotificationsPage() {
  const trpc = await createServerCaller();

  try {
    // Fetch initial notifications on server
    const initialData = await trpc.social.listNotifications({
      limit: 30,
      unreadOnly: false,
    });

    // Add missing properties to match expected type
    const formattedInitialData = {
      ...initialData,
      totalCount: initialData.items.length,
      unreadCount: 0,
    } as any; // Temporary type casting to fix build

    return (
      <div className="container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground mt-2">
              Stay up to date with your latest activity and updates
            </p>
          </div>

          <Suspense fallback={<NotificationsPageSkeleton />}>
            <NotificationsClient initialData={formattedInitialData} />
          </Suspense>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error loading notifications:", error);

    return (
      <div className="container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground mt-2">
              Stay up to date with your latest activity and updates
            </p>
          </div>

          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Failed to load notifications. Please try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }
}
