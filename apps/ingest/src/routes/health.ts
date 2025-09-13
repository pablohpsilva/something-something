import { Hono } from "hono";
import { healthResponseSchema } from "../schemas/common";

const health = new Hono();

health.get("/", async (c) => {
  const response = {
    status: "ok" as const,
    time: new Date().toISOString(),
    version: process.env.npm_package_version || "unknown",
  };

  // Validate response matches schema
  const validated = healthResponseSchema.parse(response);

  return c.json(validated);
});

export { health };
