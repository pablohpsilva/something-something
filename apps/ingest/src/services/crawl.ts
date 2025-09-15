import { prisma } from "../prisma";
import { logger } from "../logger";
import type { CrawlItemInput } from "../schemas/crawl";

export interface CrawlResult {
  upserted: number;
  skipped: number;
  errors: string[];
}

export async function upsertCrawlItems(
  sourceId: string,
  items: CrawlItemInput[]
): Promise<CrawlResult> {
  const result: CrawlResult = {
    upserted: 0,
    skipped: 0,
    errors: [],
  };

  // Verify source exists
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
  });

  if (!source) {
    throw new Error(`Source ${sourceId} not found`);
  }

  logger.info("Processing crawl items", {
    sourceId,
    itemCount: items.length,
    sourceName: source.name,
  });

  // Process items in batches to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    for (const item of batch) {
      try {
        // Upsert each crawl item
        const crawlItem = await prisma.crawlItem.upsert({
          where: {
            sourceId_externalId: {
              sourceId,
              externalId: item.externalId,
            },
          },
          update: {
            url: item.url,
            title: item.title,
            summary: item.summary || null,
            raw: item.raw || {},
            status: "NEW", // Reset status to NEW on update
          },
          create: {
            sourceId,
            externalId: item.externalId,
            url: item.url,
            title: item.title,
            summary: item.summary || null,
            raw: item.raw || {},
            status: "NEW",
          },
        });

        result.upserted++;

        logger.debug("Upserted crawl item", {
          id: crawlItem.id,
          externalId: item.externalId,
          title: item.title,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push(`${item.externalId}: ${errorMessage}`);

        logger.error("Failed to upsert crawl item", {
          externalId: item.externalId,
          error: errorMessage,
        });
      }
    }
  }

  logger.info("Crawl items processing completed", {
    sourceId,
    upserted: result.upserted,
    errors: result.errors.length,
  });

  return result;
}

export async function getCrawlStats(sourceId?: string) {
  const where = sourceId ? { sourceId } : {};

  const [total, byStatus] = await Promise.all([
    prisma.crawlItem.count({ where }),
    prisma.crawlItem.groupBy({
      by: ["status"],
      where,
      _count: true,
    }),
  ]);

  const statusCounts = Object.fromEntries(
    byStatus.map((item) => [item.status, item._count])
  );

  return {
    total,
    byStatus: statusCounts,
  };
}
