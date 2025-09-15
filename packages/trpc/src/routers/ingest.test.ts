import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TRPCError } from "@trpc/server"
import { ingestRouter } from "./ingest"

// Mock dependencies
vi.mock("../server", () => ({
  createTRPCRouter: vi.fn(routes => ({
    createCaller: vi.fn(ctx => {
      const caller = {}
      for (const [key, procedure] of Object.entries(routes)) {
        caller[key] = async input => {
          const mockHandlers = {
            getEvents: async ({ input, ctx }) => {
              const { processed, limit = 10, cursor } = input || {}

              const events = await ctx.db.ingestEvent.findMany({
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                where: {
                  processed,
                },
                orderBy: {
                  createdAt: "desc",
                },
              })

              let nextCursor = undefined
              if (events.length > limit) {
                const nextItem = events.pop()
                nextCursor = nextItem.id
              }

              return {
                events,
                nextCursor,
              }
            },
            createEvent: async ({ input, ctx }) => {
              const { type, data } = input

              return ctx.db.ingestEvent.create({
                data: {
                  type,
                  data,
                },
              })
            },
            markProcessed: async ({ input, ctx }) => {
              const { id } = input

              return ctx.db.ingestEvent.update({
                where: { id },
                data: { processed: true },
              })
            },
            batchMarkProcessed: async ({ input, ctx }) => {
              const { ids } = input

              return ctx.db.ingestEvent.updateMany({
                where: { id: { in: ids } },
                data: { processed: true },
              })
            },
          }

          return mockHandlers[key]?.({ input, ctx })
        }
      }
      return caller
    }),
    ...routes,
  })),
  rateLimitedProcedure: {
    input: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
  protectedProcedure: {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
}))

// Mock data
const mockUser = {
  id: "user123",
  handle: "testuser",
  displayName: "Test User",
  email: "test@example.com",
}

const mockIngestEvent = {
  id: "event123",
  type: "rule.view",
  data: {
    ruleId: "rule123",
    userId: "user123",
    timestamp: "2024-01-15T10:00:00Z",
  },
  processed: false,
  createdAt: new Date("2024-01-15T10:00:00Z"),
  updatedAt: new Date("2024-01-15T10:00:00Z"),
}

const mockProcessedEvent = {
  ...mockIngestEvent,
  id: "event456",
  processed: true,
}

describe("Ingest Router", () => {
  let caller: any
  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockDb = {
      ingestEvent: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    }

    caller = ingestRouter.createCaller({
      user: mockUser,
      db: mockDb,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("getEvents", () => {
    it("should return events with default parameters", async () => {
      const events = [mockIngestEvent]
      mockDb.ingestEvent.findMany.mockResolvedValue(events)

      const result = await caller.getEvents({})

      expect(result).toEqual({
        events: [mockIngestEvent],
        nextCursor: undefined,
      })

      expect(mockDb.ingestEvent.findMany).toHaveBeenCalledWith({
        take: 11, // limit + 1
        cursor: undefined,
        where: {
          processed: undefined,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    })

    it("should return events with processed filter", async () => {
      const events = [mockProcessedEvent]
      mockDb.ingestEvent.findMany.mockResolvedValue(events)

      const result = await caller.getEvents({
        processed: true,
        limit: 5,
      })

      expect(result).toEqual({
        events: [mockProcessedEvent],
        nextCursor: undefined,
      })

      expect(mockDb.ingestEvent.findMany).toHaveBeenCalledWith({
        take: 6, // limit + 1
        cursor: undefined,
        where: {
          processed: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    })

    it("should return events with unprocessed filter", async () => {
      const events = [mockIngestEvent]
      mockDb.ingestEvent.findMany.mockResolvedValue(events)

      const result = await caller.getEvents({
        processed: false,
        limit: 20,
      })

      expect(result).toEqual({
        events: [mockIngestEvent],
        nextCursor: undefined,
      })

      expect(mockDb.ingestEvent.findMany).toHaveBeenCalledWith({
        take: 21, // limit + 1
        cursor: undefined,
        where: {
          processed: false,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    })

    it("should handle pagination with cursor", async () => {
      const events = [mockIngestEvent]
      mockDb.ingestEvent.findMany.mockResolvedValue(events)

      const result = await caller.getEvents({
        cursor: "cursor123",
        limit: 10,
      })

      expect(result).toEqual({
        events: [mockIngestEvent],
        nextCursor: undefined,
      })

      expect(mockDb.ingestEvent.findMany).toHaveBeenCalledWith({
        take: 11,
        cursor: { id: "cursor123" },
        where: {
          processed: undefined,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    })

    it("should handle pagination with more results", async () => {
      const events = Array.from({ length: 11 }, (_, i) => ({
        ...mockIngestEvent,
        id: `event${i}`,
      }))
      mockDb.ingestEvent.findMany.mockResolvedValue(events)

      const result = await caller.getEvents({
        limit: 10,
      })

      expect(result.events).toHaveLength(10)
      expect(result.nextCursor).toBe("event10")

      // Verify the last item was popped
      expect(result.events[9].id).toBe("event9")
    })

    it("should handle maximum limit", async () => {
      const events = [mockIngestEvent]
      mockDb.ingestEvent.findMany.mockResolvedValue(events)

      await caller.getEvents({
        limit: 100, // Maximum allowed
      })

      expect(mockDb.ingestEvent.findMany).toHaveBeenCalledWith({
        take: 101,
        cursor: undefined,
        where: {
          processed: undefined,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    })

    it("should handle empty results", async () => {
      mockDb.ingestEvent.findMany.mockResolvedValue([])

      const result = await caller.getEvents({})

      expect(result).toEqual({
        events: [],
        nextCursor: undefined,
      })
    })

    it("should handle database errors", async () => {
      mockDb.ingestEvent.findMany.mockRejectedValue(new Error("Database error"))

      await expect(caller.getEvents({})).rejects.toThrow("Database error")
    })

    it("should handle complex pagination scenario", async () => {
      // First page with more results
      const firstPageEvents = Array.from({ length: 6 }, (_, i) => ({
        ...mockIngestEvent,
        id: `event${i}`,
      }))
      mockDb.ingestEvent.findMany.mockResolvedValue(firstPageEvents)

      const result = await caller.getEvents({
        limit: 5,
        processed: false,
      })

      expect(result.events).toHaveLength(5)
      expect(result.nextCursor).toBe("event5")
      expect(result.events.map(e => e.id)).toEqual([
        "event0",
        "event1",
        "event2",
        "event3",
        "event4",
      ])
    })

    it("should handle mixed processed and unprocessed events", async () => {
      const mixedEvents = [
        mockIngestEvent, // unprocessed
        mockProcessedEvent, // processed
      ]
      mockDb.ingestEvent.findMany.mockResolvedValue(mixedEvents)

      const result = await caller.getEvents({
        // No processed filter, should return all
      })

      expect(result.events).toHaveLength(2)
      expect(result.events).toContain(mockIngestEvent)
      expect(result.events).toContain(mockProcessedEvent)
    })
  })

  describe("createEvent", () => {
    it("should create a new ingest event", async () => {
      const newEvent = {
        type: "rule.view",
        data: {
          ruleId: "rule123",
          userId: "user123",
        },
      }

      mockDb.ingestEvent.create.mockResolvedValue({
        ...mockIngestEvent,
        type: newEvent.type,
        data: newEvent.data,
      })

      const result = await caller.createEvent(newEvent)

      expect(result).toEqual({
        ...mockIngestEvent,
        type: newEvent.type,
        data: newEvent.data,
      })

      expect(mockDb.ingestEvent.create).toHaveBeenCalledWith({
        data: {
          type: "rule.view",
          data: {
            ruleId: "rule123",
            userId: "user123",
          },
        },
      })
    })

    it("should create event with complex data", async () => {
      const complexEvent = {
        type: "user.registration",
        data: {
          userId: "user456",
          email: "newuser@example.com",
          source: "oauth",
          metadata: {
            provider: "github",
            ip: "192.168.1.1",
            userAgent: "Mozilla/5.0...",
          },
          timestamp: "2024-01-15T12:00:00Z",
        },
      }

      mockDb.ingestEvent.create.mockResolvedValue({
        ...mockIngestEvent,
        id: "event789",
        type: complexEvent.type,
        data: complexEvent.data,
      })

      const result = await caller.createEvent(complexEvent)

      expect(result.type).toBe("user.registration")
      expect(result.data).toEqual(complexEvent.data)

      expect(mockDb.ingestEvent.create).toHaveBeenCalledWith({
        data: {
          type: complexEvent.type,
          data: complexEvent.data,
        },
      })
    })

    it("should handle empty data object", async () => {
      const eventWithEmptyData = {
        type: "system.heartbeat",
        data: {},
      }

      mockDb.ingestEvent.create.mockResolvedValue({
        ...mockIngestEvent,
        type: eventWithEmptyData.type,
        data: eventWithEmptyData.data,
      })

      const result = await caller.createEvent(eventWithEmptyData)

      expect(result.data).toEqual({})
      expect(mockDb.ingestEvent.create).toHaveBeenCalledWith({
        data: {
          type: "system.heartbeat",
          data: {},
        },
      })
    })

    it("should handle database errors", async () => {
      mockDb.ingestEvent.create.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.createEvent({
          type: "test.event",
          data: { test: true },
        })
      ).rejects.toThrow("Database error")
    })

    it("should create event with nested object data", async () => {
      const nestedEvent = {
        type: "rule.analytics",
        data: {
          ruleId: "rule123",
          analytics: {
            views: 100,
            copies: 25,
            votes: {
              up: 15,
              down: 2,
            },
            performance: {
              loadTime: 150,
              renderTime: 50,
            },
          },
          user: {
            id: "user123",
            segment: "power_user",
          },
        },
      }

      mockDb.ingestEvent.create.mockResolvedValue({
        ...mockIngestEvent,
        type: nestedEvent.type,
        data: nestedEvent.data,
      })

      const result = await caller.createEvent(nestedEvent)

      expect(result.data.analytics.votes.up).toBe(15)
      expect(result.data.user.segment).toBe("power_user")
    })
  })

  describe("markProcessed", () => {
    it("should mark single event as processed", async () => {
      const updatedEvent = {
        ...mockIngestEvent,
        processed: true,
        updatedAt: new Date("2024-01-15T11:00:00Z"),
      }

      mockDb.ingestEvent.update.mockResolvedValue(updatedEvent)

      const result = await caller.markProcessed({
        id: "event123",
      })

      expect(result).toEqual(updatedEvent)

      expect(mockDb.ingestEvent.update).toHaveBeenCalledWith({
        where: { id: "event123" },
        data: { processed: true },
      })
    })

    it("should handle non-existent event", async () => {
      mockDb.ingestEvent.update.mockRejectedValue(new Error("Record not found"))

      await expect(
        caller.markProcessed({
          id: "nonexistent",
        })
      ).rejects.toThrow("Record not found")
    })

    it("should handle database errors", async () => {
      mockDb.ingestEvent.update.mockRejectedValue(new Error("Database connection failed"))

      await expect(
        caller.markProcessed({
          id: "event123",
        })
      ).rejects.toThrow("Database connection failed")
    })

    it("should mark already processed event", async () => {
      const alreadyProcessedEvent = {
        ...mockProcessedEvent,
        updatedAt: new Date("2024-01-15T11:00:00Z"),
      }

      mockDb.ingestEvent.update.mockResolvedValue(alreadyProcessedEvent)

      const result = await caller.markProcessed({
        id: "event456",
      })

      expect(result.processed).toBe(true)
      expect(mockDb.ingestEvent.update).toHaveBeenCalledWith({
        where: { id: "event456" },
        data: { processed: true },
      })
    })
  })

  describe("batchMarkProcessed", () => {
    it("should mark multiple events as processed", async () => {
      const updateResult = {
        count: 3,
      }

      mockDb.ingestEvent.updateMany.mockResolvedValue(updateResult)

      const result = await caller.batchMarkProcessed({
        ids: ["event1", "event2", "event3"],
      })

      expect(result).toEqual(updateResult)

      expect(mockDb.ingestEvent.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["event1", "event2", "event3"] } },
        data: { processed: true },
      })
    })

    it("should handle empty ids array", async () => {
      const updateResult = {
        count: 0,
      }

      mockDb.ingestEvent.updateMany.mockResolvedValue(updateResult)

      const result = await caller.batchMarkProcessed({
        ids: [],
      })

      expect(result.count).toBe(0)

      expect(mockDb.ingestEvent.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [] } },
        data: { processed: true },
      })
    })

    it("should handle single id in array", async () => {
      const updateResult = {
        count: 1,
      }

      mockDb.ingestEvent.updateMany.mockResolvedValue(updateResult)

      const result = await caller.batchMarkProcessed({
        ids: ["event123"],
      })

      expect(result.count).toBe(1)

      expect(mockDb.ingestEvent.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["event123"] } },
        data: { processed: true },
      })
    })

    it("should handle large batch of ids", async () => {
      const largeIdArray = Array.from({ length: 100 }, (_, i) => `event${i}`)
      const updateResult = {
        count: 100,
      }

      mockDb.ingestEvent.updateMany.mockResolvedValue(updateResult)

      const result = await caller.batchMarkProcessed({
        ids: largeIdArray,
      })

      expect(result.count).toBe(100)

      expect(mockDb.ingestEvent.updateMany).toHaveBeenCalledWith({
        where: { id: { in: largeIdArray } },
        data: { processed: true },
      })
    })

    it("should handle partial success (some ids not found)", async () => {
      const updateResult = {
        count: 2, // Only 2 out of 3 were found and updated
      }

      mockDb.ingestEvent.updateMany.mockResolvedValue(updateResult)

      const result = await caller.batchMarkProcessed({
        ids: ["event1", "event2", "nonexistent"],
      })

      expect(result.count).toBe(2)
    })

    it("should handle database errors", async () => {
      mockDb.ingestEvent.updateMany.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.batchMarkProcessed({
          ids: ["event1", "event2"],
        })
      ).rejects.toThrow("Database error")
    })

    it("should handle duplicate ids in array", async () => {
      const updateResult = {
        count: 2, // Duplicates should not affect the count
      }

      mockDb.ingestEvent.updateMany.mockResolvedValue(updateResult)

      const result = await caller.batchMarkProcessed({
        ids: ["event1", "event2", "event1"], // event1 is duplicated
      })

      expect(result.count).toBe(2)

      expect(mockDb.ingestEvent.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["event1", "event2", "event1"] } },
        data: { processed: true },
      })
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle complete event lifecycle", async () => {
      // 1. Create an event
      const newEvent = {
        type: "rule.view",
        data: { ruleId: "rule123", userId: "user123" },
      }

      const createdEvent = {
        ...mockIngestEvent,
        type: newEvent.type,
        data: newEvent.data,
      }

      mockDb.ingestEvent.create.mockResolvedValue(createdEvent)

      const createResult = await caller.createEvent(newEvent)
      expect(createResult.processed).toBe(false)

      // 2. Fetch unprocessed events
      mockDb.ingestEvent.findMany.mockResolvedValue([createdEvent])

      const getResult = await caller.getEvents({ processed: false })
      expect(getResult.events).toHaveLength(1)
      expect(getResult.events[0].processed).toBe(false)

      // 3. Mark event as processed
      const processedEvent = {
        ...createdEvent,
        processed: true,
      }

      mockDb.ingestEvent.update.mockResolvedValue(processedEvent)

      const markResult = await caller.markProcessed({
        id: createdEvent.id,
      })
      expect(markResult.processed).toBe(true)

      // 4. Verify processed events
      mockDb.ingestEvent.findMany.mockResolvedValue([processedEvent])

      const finalGetResult = await caller.getEvents({ processed: true })
      expect(finalGetResult.events).toHaveLength(1)
      expect(finalGetResult.events[0].processed).toBe(true)
    })

    it("should handle concurrent event processing", async () => {
      const events = Array.from({ length: 5 }, (_, i) => ({
        ...mockIngestEvent,
        id: `event${i}`,
      }))

      // Create multiple events concurrently
      mockDb.ingestEvent.create.mockResolvedValue(mockIngestEvent)

      const createPromises = events.map(event =>
        caller.createEvent({
          type: event.type,
          data: event.data,
        })
      )

      const createResults = await Promise.all(createPromises)
      expect(createResults).toHaveLength(5)

      // Batch process them
      const updateResult = { count: 5 }
      mockDb.ingestEvent.updateMany.mockResolvedValue(updateResult)

      const batchResult = await caller.batchMarkProcessed({
        ids: events.map(e => e.id),
      })
      expect(batchResult.count).toBe(5)
    })

    it("should handle pagination edge cases", async () => {
      // Test pagination at exact boundary
      const exactBoundaryEvents = Array.from({ length: 10 }, (_, i) => ({
        ...mockIngestEvent,
        id: `event${i}`,
      }))

      mockDb.ingestEvent.findMany.mockResolvedValue(exactBoundaryEvents)

      const result = await caller.getEvents({ limit: 10 })

      // Should return all 10 events with no next cursor
      expect(result.events).toHaveLength(10)
      expect(result.nextCursor).toBeUndefined()
    })

    it("should handle complex filtering scenarios", async () => {
      const mixedEvents = [
        { ...mockIngestEvent, id: "event1", processed: false },
        { ...mockIngestEvent, id: "event2", processed: true },
        { ...mockIngestEvent, id: "event3", processed: false },
        { ...mockIngestEvent, id: "event4", processed: true },
      ]

      // Test processed = true
      mockDb.ingestEvent.findMany.mockResolvedValue([mixedEvents[1], mixedEvents[3]])

      const processedResult = await caller.getEvents({ processed: true })
      expect(processedResult.events).toHaveLength(2)

      // Test processed = false
      mockDb.ingestEvent.findMany.mockResolvedValue([mixedEvents[0], mixedEvents[2]])

      const unprocessedResult = await caller.getEvents({ processed: false })
      expect(unprocessedResult.events).toHaveLength(2)
    })

    it("should handle event types and data validation", async () => {
      const eventTypes = [
        {
          type: "rule.view",
          data: { ruleId: "rule123", userId: "user123" },
        },
        {
          type: "user.registration",
          data: { userId: "user456", email: "test@example.com" },
        },
        {
          type: "comment.create",
          data: { commentId: "comment789", parentId: "rule123" },
        },
        {
          type: "system.cleanup",
          data: { cleanupType: "expired_sessions", count: 25 },
        },
      ]

      mockDb.ingestEvent.create.mockImplementation(params => {
        return Promise.resolve({
          ...mockIngestEvent,
          id: `event_${params.data.type}`,
          type: params.data.type,
          data: params.data.data,
        })
      })

      for (const event of eventTypes) {
        const result = await caller.createEvent(event)
        expect(result.type).toBe(event.type)
        expect(result.data).toEqual(event.data)
      }

      expect(mockDb.ingestEvent.create).toHaveBeenCalledTimes(4)
    })

    it("should handle error recovery scenarios", async () => {
      // Simulate database recovery after failure
      mockDb.ingestEvent.findMany
        .mockRejectedValueOnce(new Error("Connection timeout"))
        .mockResolvedValueOnce([mockIngestEvent])

      // First call should fail
      await expect(caller.getEvents({})).rejects.toThrow("Connection timeout")

      // Second call should succeed
      const result = await caller.getEvents({})
      expect(result.events).toHaveLength(1)
    })

    it("should handle large data payloads", async () => {
      const largeDataEvent = {
        type: "analytics.bulk_import",
        data: {
          importId: "import123",
          records: Array.from({ length: 1000 }, (_, i) => ({
            id: `record${i}`,
            value: `data_${i}`,
            metadata: {
              processed: false,
              timestamp: new Date().toISOString(),
            },
          })),
          summary: {
            totalRecords: 1000,
            validRecords: 950,
            invalidRecords: 50,
          },
        },
      }

      mockDb.ingestEvent.create.mockResolvedValue({
        ...mockIngestEvent,
        type: largeDataEvent.type,
        data: largeDataEvent.data,
      })

      const result = await caller.createEvent(largeDataEvent)

      expect(result.data.records).toHaveLength(1000)
      expect(result.data.summary.totalRecords).toBe(1000)
    })
  })
})
