import { z } from "zod";

// Event types that can be recorded
export const eventTypeSchema = z.enum([
  "VIEW",
  "COPY", 
  "SAVE",
  "FORK",
  "COMMENT",
  "VOTE",
  "DONATE",
  "CLAIM"
]);

// Single event input schema
export const eventInputSchema = z.object({
  type: eventTypeSchema,
  ruleId: z.string().cuid().optional(),
  ruleVersionId: z.string().cuid().optional(),
  userId: z.string().cuid().optional().nullable(),
  ts: z.string().datetime().optional(),
  idempotencyKey: z.string().max(255).optional(),
});

// Batch events input schema
export const eventsInputSchema = z.object({
  events: z.array(eventInputSchema).min(1).max(100), // Limit batch size
});

// Event with enriched data (internal use)
export const enrichedEventSchema = eventInputSchema.extend({
  ipHash: z.string(),
  uaHash: z.string(),
  createdAt: z.date(),
});

export type EventType = z.infer<typeof eventTypeSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type EventsInput = z.infer<typeof eventsInputSchema>;
export type EnrichedEvent = z.infer<typeof enrichedEventSchema>;
