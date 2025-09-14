import { z } from "zod";
import { config } from "dotenv";

// Load environment variables from .env file
config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Security tokens
  CRON_SECRET: z.string().min(1),
  INGEST_APP_TOKEN: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  // Server config
  PORT: z.string().default("8787").transform(Number),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Rate limiting config
  RATE_LIMIT_WINDOW_MS: z.string().default("60000").transform(Number), // 1 minute
  RATE_LIMIT_EVENTS_PER_IP: z.string().default("60").transform(Number),
  RATE_LIMIT_CRAWL_PER_TOKEN: z.string().default("30").transform(Number),

  // Deduplication config
  VIEW_DEDUPE_WINDOW_MS: z.string().default("600000").transform(Number), // 10 minutes

  // Rollup config
  ROLLUP_DAYS_BACK: z.string().default("7").transform(Number),
  TRENDING_DECAY_LAMBDA: z.string().default("0.25").transform(Number),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    cachedEnv = envSchema.parse(process.env);
    return cachedEnv;
  } catch (error) {
    console.error("❌ Invalid environment variables:");
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join(".")}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

// Validate environment on module load
getEnv();
