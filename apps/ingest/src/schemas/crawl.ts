import { z } from "zod";

// Single crawl item input schema
export const crawlItemInputSchema = z.object({
  externalId: z.string().min(1).max(255),
  url: z.string().url(),
  title: z.string().min(1).max(200),
  summary: z.string().max(5000).optional(),
  raw: z.unknown().optional(), // Store raw JSON data from partner
});

// Crawl batch input schema
export const crawlInputSchema = z.object({
  sourceId: z.string().cuid(),
  items: z.array(crawlItemInputSchema).min(1).max(50), // Limit batch size
});

// Crawl response schema
export const crawlResponseSchema = z.object({
  upserted: z.number().int().min(0),
  skipped: z.number().int().min(0).optional(),
  errors: z.array(z.string()).optional(),
});

export type CrawlItemInput = z.infer<typeof crawlItemInputSchema>;
export type CrawlInput = z.infer<typeof crawlInputSchema>;
export type CrawlResponse = z.infer<typeof crawlResponseSchema>;
