import { z } from "zod";

// Base environment schema
const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  WEB_BASE_URL: z.string().url(),
  INGEST_BASE_URL: z.string().url(),
  CRON_SECRET: z.string().min(1),
});

// Web app specific environment schema
export const webEnvSchema = baseEnvSchema.extend({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default("/"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default("/"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
});

// Ingest app specific environment schema
export const ingestEnvSchema = baseEnvSchema.extend({
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type IngestEnv = z.infer<typeof ingestEnvSchema>;

// Environment validation functions
export function validateWebEnv(
  env: Record<string, string | undefined>
): WebEnv {
  return webEnvSchema.parse(env);
}

export function validateIngestEnv(
  env: Record<string, string | undefined>
): IngestEnv {
  return ingestEnvSchema.parse(env);
}
