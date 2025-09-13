// Re-export configuration utilities
export * from "./env";

// Configuration constants
export const APP_CONFIG = {
  name: "Something Something",
  description: "A modern monorepo application",
  version: "0.1.0",
} as const;

export const API_CONFIG = {
  timeout: 30000,
  retries: 3,
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
} as const;
