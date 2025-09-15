import { Hono } from "hono";
import { requireStripeSignature } from "../middleware/auth";
import { webhookRateLimit } from "../middleware/ratelimit";
import { handleStripeEvent } from "../services/donations";
import { logger } from "../logger";

const stripeWebhook = new Hono();

stripeWebhook.post(
  "/",
  webhookRateLimit(),
  requireStripeSignature,
  async (c) => {
    // Get raw body for signature verification
    const rawBody = await c.req.text();
    const signature = c.get("stripeSignature") as string;

    if (!signature) {
      return c.json({ error: "missing stripe signature" }, 400);
    }

    try {
      const result = await handleStripeEvent(rawBody, signature);

      logger.info("Stripe webhook processed", {
        processed: result.processed,
        action: result.action,
        donationId: result.donationId,
      });

      return c.json({ ok: true });
    } catch (error) {
      logger.error("Stripe webhook processing failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return 200 to prevent Stripe from retrying invalid requests
      if (
        error instanceof Error &&
        error.message.includes("invalid_signature")
      ) {
        return c.json({ error: "invalid signature" }, 400);
      }

      // For other errors, return 500 so Stripe will retry
      return c.json({ error: "processing failed" }, 500);
    }
  }
);

export { stripeWebhook };
