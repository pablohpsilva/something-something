import { Hono } from "hono";
import { requireCronSecret } from "../middleware/auth";
import { rollupInputSchema, rollupResponseSchema } from "../schemas/rollup";
import { performRollup } from "../services/rollup";
import { logger } from "../logger";
import { prisma } from "../prisma";

const cronRollup = new Hono();

cronRollup.post("/", requireCronSecret, async (c) => {
  const body = await c.req.json().catch(() => ({}));

  // Validate input (with defaults)
  const input = rollupInputSchema.parse(body);

  const targetDate = input.date ? new Date(input.date) : new Date();
  targetDate.setHours(0, 0, 0, 0); // Normalize to start of day

  logger.info("Starting rollup job", {
    date: targetDate.toISOString(),
    dryRun: input.dryRun,
    daysBack: input.daysBack,
  });

  try {
    // Perform the rollup
    const result = await performRollup(
      targetDate,
      input.dryRun,
      input.daysBack
    );

    // Create audit log entry (fire-and-forget)
    prisma.auditLog
      .create({
        data: {
          action: "cron.rollup",
          entityType: "rollup_job",
          entityId: `rollup-${targetDate.toISOString().split("T")[0]}`,
          diff: {
            date: targetDate.toISOString(),
            dryRun: result.dryRun,
            rulesUpdated: result.rulesUpdated,
            authorsUpdated: result.authorsUpdated,
            snapshots: result.snapshots,
            tookMs: result.tookMs,
          },
          ipHash: "cron",
          createdAt: new Date(),
        },
      })
      .catch((error) => {
        logger.error("Failed to create audit log", { error });
      });

    // Validate and return response
    const response = rollupResponseSchema.parse(result);

    return c.json(response);
  } catch (error) {
    logger.error("Rollup job failed", {
      date: targetDate.toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});

// Optional: Rebuild search index endpoint
cronRollup.post("/rebuild-search", requireCronSecret, async (c) => {
  logger.info("Starting search index rebuild");

  try {
    // Get all published rules
    const rules = await prisma.rule.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
      },
      select: { id: true },
    });

    let rebuilt = 0;

    // Rebuild search index for each rule in batches
    const batchSize = 50;
    for (let i = 0; i < rules.length; i += batchSize) {
      const batch = rules.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (rule) => {
          try {
            // Call the refresh function from packages/db
            await prisma.$executeRaw`SELECT update_rule_tsv(${rule.id})`;
            rebuilt++;
          } catch (error) {
            logger.error("Failed to rebuild search for rule", {
              ruleId: rule.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })
      );

      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < rules.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.info("Search index rebuild completed", {
      totalRules: rules.length,
      rebuilt,
    });

    return c.json({
      success: true,
      totalRules: rules.length,
      rebuilt,
    });
  } catch (error) {
    logger.error("Search index rebuild failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});

export { cronRollup };
