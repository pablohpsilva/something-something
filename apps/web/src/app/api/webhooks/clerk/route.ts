import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { upsertUserFromClerk } from "@/lib/auth";

// Force Node.js runtime for Prisma compatibility
export const runtime = "nodejs";

type ClerkWebhookEvent = {
  type: string;
  data: {
    id: string;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
    email_addresses?: Array<{
      id: string;
      email_address: string;
    }>;
    primary_email_address_id?: string | null;
  };
};

export async function POST(req: NextRequest) {
  try {
    // Get the headers
    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new NextResponse("Error occurred -- no svix headers", {
        status: 400,
      });
    }

    // Get the body
    const payload = await req.text();
    const body = JSON.parse(payload);

    // Verify the webhook signature if secret is provided
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (webhookSecret) {
      const wh = new Webhook(webhookSecret);

      try {
        wh.verify(payload, {
          "svix-id": svix_id,
          "svix-timestamp": svix_timestamp,
          "svix-signature": svix_signature,
        }) as ClerkWebhookEvent;
      } catch (err) {
        console.error("Error verifying webhook:", err);
        return new NextResponse("Error occurred -- invalid signature", {
          status: 400,
        });
      }
    }

    const event = body as ClerkWebhookEvent;
    const eventType = event.type;

    console.log(`Clerk webhook received: ${eventType}`);

    // Handle user events
    if (eventType === "user.created" || eventType === "user.updated") {
      try {
        const user = await upsertUserFromClerk(event.data);
        console.log(`User ${eventType}: ${user.handle} (${user.clerkId})`);
      } catch (error) {
        console.error(`Error handling ${eventType}:`, error);
        return new NextResponse(`Error processing ${eventType}`, {
          status: 500,
        });
      }
    }

    // Handle user deletion
    if (eventType === "user.deleted") {
      try {
        // For user deletion, we might want to soft delete or anonymize
        // For now, we'll just log it - implement based on your requirements
        console.log(`User deleted: ${event.data.id}`);

        // Optional: Soft delete the user
        // await prisma.user.update({
        //   where: { clerkId: event.data.id },
        //   data: { deletedAt: new Date() }
        // });
      } catch (error) {
        console.error("Error handling user.deleted:", error);
        return new NextResponse("Error processing user.deleted", {
          status: 500,
        });
      }
    }

    return new NextResponse("Webhook processed successfully", {
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new NextResponse("Internal server error", {
      status: 500,
    });
  }
}
