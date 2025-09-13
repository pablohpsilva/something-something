import { prisma } from "../prisma";
import { logger } from "../logger";

// Placeholder service for future notification fanout functionality
// This would handle sending notifications for various events

export interface NotificationPayload {
  type: string;
  userId: string;
  data: Record<string, any>;
}

export async function sendNotification(
  payload: NotificationPayload
): Promise<void> {
  // For now, just log the notification
  // In the future, this could:
  // - Send push notifications
  // - Send emails
  // - Update real-time subscriptions
  // - Trigger webhooks

  logger.info("Notification triggered", {
    type: payload.type,
    userId: payload.userId,
    data: payload.data,
  });

  // Store notification in database
  try {
    await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type as any, // Cast to enum
        payload: payload.data,
      },
    });
  } catch (error) {
    logger.error("Failed to store notification", {
      error: error instanceof Error ? error.message : String(error),
      payload,
    });
  }
}

export async function fanoutNotifications(
  userIds: string[],
  type: string,
  data: Record<string, any>
): Promise<void> {
  const notifications = userIds.map((userId) => ({
    type,
    userId,
    data,
  }));

  // Send notifications in parallel
  await Promise.allSettled(
    notifications.map((notification) => sendNotification(notification))
  );
}
