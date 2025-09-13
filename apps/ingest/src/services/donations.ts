import Stripe from "stripe";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { getEnv } from "../env";
import { Notifications } from "@repo/trpc/services/notify";

const stripe = new Stripe(getEnv().STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export interface StripeEventResult {
  processed: boolean;
  donationId?: string;
  action?: string;
  error?: string;
}

export async function handleStripeEvent(
  rawBody: string,
  signature: string
): Promise<StripeEventResult> {
  const env = getEnv();

  try {
    // Verify the webhook signature
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );

    logger.info("Processing Stripe webhook", {
      eventId: event.id,
      type: event.type,
    });

    // Check for idempotency - have we already processed this event?
    const existingAudit = await prisma.auditLog.findFirst({
      where: {
        action: "stripe.webhook",
        entityId: event.id,
      },
    });

    if (existingAudit) {
      logger.info("Stripe event already processed", { eventId: event.id });
      return { processed: false, action: "already_processed" };
    }

    let result: StripeEventResult;

    switch (event.type) {
      case "checkout.session.completed":
        result = await handleCheckoutCompleted(event);
        break;

      case "payment_intent.succeeded":
        result = await handlePaymentSucceeded(event);
        break;

      case "payment_intent.payment_failed":
        result = await handlePaymentFailed(event);
        break;

      default:
        logger.info("Unhandled Stripe event type", { type: event.type });
        result = { processed: false, action: "unhandled_event_type" };
    }

    // Log the event processing in audit log
    await prisma.auditLog.create({
      data: {
        action: "stripe.webhook",
        entityType: "stripe_event",
        entityId: event.id,
        diff: {
          eventType: event.type,
          processed: result.processed,
          donationId: result.donationId,
          action: result.action,
        },
        ipHash: "stripe",
        createdAt: new Date(),
      },
    });

    return result;
  } catch (error) {
    logger.error("Failed to process Stripe webhook", {
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return { processed: false, error: "invalid_signature" };
    }

    throw error;
  }
}

async function handleCheckoutCompleted(
  event: Stripe.Event
): Promise<StripeEventResult> {
  const session = event.data.object as Stripe.Checkout.Session;

  if (!session.metadata) {
    logger.warn("Checkout session missing metadata", { sessionId: session.id });
    return { processed: false, error: "missing_metadata" };
  }

  const { donationId, toUserId, ruleId } = session.metadata;

  if (!donationId || !toUserId) {
    logger.warn("Checkout session missing required metadata", {
      sessionId: session.id,
      metadata: session.metadata,
    });
    return { processed: false, error: "invalid_metadata" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find the donation record
      const donation = await tx.donation.findUnique({
        where: { id: donationId },
      });

      if (!donation) {
        throw new Error(`Donation ${donationId} not found`);
      }

      if (donation.status !== "INIT") {
        logger.info("Donation already processed", {
          donationId,
          status: donation.status,
        });
        return { processed: false, action: "already_processed" };
      }

      // Update donation to succeeded
      const updatedDonation = await tx.donation.update({
        where: { id: donationId },
        data: {
          status: "SUCCEEDED",
          providerRef: session.id,
          amountCents: session.amount_total || 0,
          currency: session.currency || "usd",
        },
      });

      // Update author metrics
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await tx.authorMetricDaily.upsert({
        where: {
          date_authorUserId: {
            date: today,
            authorUserId: toUserId,
          },
        },
        update: {
          donations: { increment: 1 },
          donationsCents: { increment: session.amount_total || 0 },
        },
        create: {
          date: today,
          authorUserId: toUserId,
          views: 0,
          copies: 0,
          saves: 0,
          forks: 0,
          votes: 0,
          score: 0,
          donations: 1,
          donationsCents: session.amount_total || 0,
        },
      });

      // Create Event for metrics tracking
      await tx.event.create({
        data: {
          type: "DONATE",
          ruleId: ruleId || null,
          userId: donation.fromUserId,
          ipHash: "stripe", // Server-side event
          uaHash: "stripe",
          createdAt: new Date(),
        },
      });

      return { processed: true, donationId, action: "checkout_completed" };
    });

    logger.info("Checkout completed successfully", {
      donationId,
      sessionId: session.id,
      amount: session.amount_total,
    });

    // Send notification to recipient (fire-and-forget)
    try {
      const donation = await prisma.donation.findUnique({
        where: { id: donationId },
        include: {
          fromUser: { select: { handle: true, displayName: true } },
          rule: { select: { slug: true } },
        },
      });

      if (donation) {
        await Notifications.donationReceived({
          toUserId: donation.toUserId,
          donationId: donation.id,
          amountCents: donation.amountCents,
          currency: donation.currency,
          fromUserId: donation.fromUserId || undefined,
          fromUserHandle: donation.fromUser?.handle,
          fromUserDisplayName: donation.fromUser?.displayName,
          ruleId: donation.ruleId || undefined,
          ruleSlug: donation.rule?.slug,
        });
      }
    } catch (error) {
      logger.error("Failed to send donation notification", {
        error,
        donationId,
      });
    }

    return result;
  } catch (error) {
    logger.error("Failed to process checkout completion", {
      sessionId: session.id,
      donationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function handlePaymentSucceeded(
  event: Stripe.Event
): Promise<StripeEventResult> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  // This might be redundant with checkout.session.completed, but handle it anyway
  logger.info("Payment succeeded", {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
  });

  return { processed: true, action: "payment_succeeded" };
}

async function handlePaymentFailed(
  event: Stripe.Event
): Promise<StripeEventResult> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  // Try to find donation by payment intent ID and mark as failed
  try {
    const donation = await prisma.donation.findFirst({
      where: { providerRef: paymentIntent.id },
    });

    if (donation && donation.status === "INIT") {
      await prisma.donation.update({
        where: { id: donation.id },
        data: { status: "FAILED" },
      });

      logger.info("Donation marked as failed", {
        donationId: donation.id,
        paymentIntentId: paymentIntent.id,
      });

      return {
        processed: true,
        donationId: donation.id,
        action: "payment_failed",
      };
    }

    return { processed: false, action: "donation_not_found" };
  } catch (error) {
    logger.error("Failed to process payment failure", {
      paymentIntentId: paymentIntent.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
