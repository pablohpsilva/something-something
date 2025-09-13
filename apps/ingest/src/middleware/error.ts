import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { logger } from "../logger";
import { getEnv } from "../env";

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    const env = getEnv();
    
    // Log the error with stack trace in development
    if (env.NODE_ENV !== "production") {
      logger.error("Request error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: c.req.path,
        method: c.req.method,
      });
    } else {
      logger.error("Request error", {
        error: error instanceof Error ? error.message : String(error),
        path: c.req.path,
        method: c.req.method,
      });
    }

    // Handle different error types
    if (error instanceof HTTPException) {
      return c.json(
        { 
          error: error.message,
          code: error.status 
        }, 
        error.status
      );
    }

    if (error instanceof ZodError) {
      return c.json(
        {
          error: "validation error",
          code: 400,
          details: error.errors.map(err => ({
            path: err.path.join("."),
            message: err.message,
          })),
        },
        400
      );
    }

    // Handle Stripe errors
    if (error && typeof error === "object" && "type" in error) {
      const stripeError = error as any;
      if (stripeError.type?.startsWith("Stripe")) {
        return c.json(
          {
            error: "stripe error",
            code: 400,
            message: stripeError.message,
          },
          400
        );
      }
    }

    // Handle Prisma errors
    if (error && typeof error === "object" && "code" in error) {
      const prismaError = error as any;
      if (prismaError.code?.startsWith("P")) {
        return c.json(
          {
            error: "database error",
            code: 500,
            message: env.NODE_ENV === "production" 
              ? "Internal server error" 
              : prismaError.message,
          },
          500
        );
      }
    }

    // Generic error fallback
    return c.json(
      {
        error: "internal server error",
        code: 500,
        message: env.NODE_ENV === "production" 
          ? "Internal server error" 
          : error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

// Request logging middleware
export async function requestLogger(c: Context, next: Next) {
  const start = Date.now();
  
  await next();
  
  const duration = Date.now() - start;
  logger.request(c.req.method, c.req.path, c.res.status, duration);
}
