import type { Context, Next } from "hono";
import { getEnv } from "../env";
import { logger } from "../logger";

export async function requireAppToken(c: Context, next: Next) {
  const env = getEnv();
  const appToken = c.req.header("x-app-token");
  const cronSecret = c.req.header("x-cron-secret");

  // Allow either app token or cron secret
  if (appToken === env.INGEST_APP_TOKEN || cronSecret === env.CRON_SECRET) {
    await next();
    return;
  }

  logger.warn("Unauthorized request - invalid app token", {
    path: c.req.path,
    method: c.req.method,
    hasAppToken: !!appToken,
    hasCronSecret: !!cronSecret,
  });

  return c.json({ error: "unauthorized" }, 401);
}

export async function requireCronSecret(c: Context, next: Next) {
  const env = getEnv();
  const cronSecret = c.req.header("x-cron-secret");

  if (cronSecret === env.CRON_SECRET) {
    await next();
    return;
  }

  logger.warn("Unauthorized request - invalid cron secret", {
    path: c.req.path,
    method: c.req.method,
    hasCronSecret: !!cronSecret,
  });

  return c.json({ error: "unauthorized" }, 401);
}

export async function requireStripeSignature(c: Context, next: Next) {
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    logger.warn("Missing Stripe signature", {
      path: c.req.path,
      method: c.req.method,
    });
    return c.json({ error: "missing stripe signature" }, 400);
  }

  // Store signature in context for later verification
  c.set("stripeSignature", signature);
  await next();
}
