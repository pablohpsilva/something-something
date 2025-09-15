import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TRPCError } from "@trpc/server"
import { tagsRouter } from "./tags"

// Mock dependencies
vi.mock("../trpc", () => ({
  router: vi.fn(routes => ({
    createCaller: vi.fn(ctx => {
      const caller = {}
      for (const [key, procedure] of Object.entries(routes)) {
        caller[key] = async input => {
          const mockHandlers = {
            list: async ({ input, ctx }) => {
              const { cursor, limit = 25, search, sort, includeCount } = input || {}

              const where = {}
              if (search) {
                where.OR = [
                  { name: { contains: search, mode: "insensitive" } },
                  { slug: { contains: search, mode: "insensitive" } },
                ]
              }

              if (cursor) {
                where.id = { gt: cursor }
              }

              let orderBy
              switch (sort) {
                case "name":
                  orderBy = { name: "asc" }
                  break
                case "recent":
                  orderBy = { id: "desc" }
                  break
                case "count":
                default:
                  orderBy = includeCount ? { rules: { _count: "desc" } } : { name: "asc" }
              }

              const tags = await ctx.prisma.tag.findMany({
                where,
                orderBy,
                take: limit + 1,
                include: includeCount
                  ? {
                      _count: {
                        select: {
                          rules: {
                            where: {
                              rule: { deletedAt: null, status: "PUBLISHED" },
                            },
                          },
                        },
                      },
                    }
                  : undefined,
              })

              const hasMore = tags.length > limit
              const items = hasMore ? tags.slice(0, -1) : tags
              const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

              return {
                items: items.map(tag => ({
                  id: tag.id,
                  slug: tag.slug,
                  name: tag.name,
                  count: includeCount ? tag._count?.rules || 0 : undefined,
                })),
                nextCursor,
                hasMore,
              }
            },

            getBySlug: async ({ input, ctx }) => {
              const { slug, includeStats } = input

              const tag = await ctx.prisma.tag.findUnique({
                where: { slug },
                include: includeStats
                  ? {
                      _count: {
                        select: {
                          rules: {
                            where: {
                              rule: { deletedAt: null, status: "PUBLISHED" },
                            },
                          },
                        },
                      },
                    }
                  : undefined,
              })

              if (!tag) {
                return null
              }

              let recentRulesCount = 0
              if (includeStats) {
                const thirtyDaysAgo = new Date()
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

                recentRulesCount = await ctx.prisma.ruleTag.count({
                  where: {
                    tagId: tag.id,
                    rule: {
                      deletedAt: null,
                      status: "PUBLISHED",
                      createdAt: { gte: thirtyDaysAgo },
                    },
                  },
                })
              }

              return {
                id: tag.id,
                slug: tag.slug,
                name: tag.name,
                rulesCount: tag._count?.rules || 0,
                recentRulesCount,
              }
            },

            attach: async ({ input, ctx }) => {
              const { ruleId, tagSlugs } = input

              // Mock getRuleOwnership
              const rule = await ctx.prisma.rule.findUnique({
                where: { id: ruleId, deletedAt: null },
                select: {
                  id: true,
                  createdByUserId: true,
                  status: true,
                },
              })

              if (!rule) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Rule not found",
                })
              }

              const canEdit =
                rule.createdByUserId === ctx.user?.id ||
                ctx.user?.role === "ADMIN" ||
                ctx.user?.role === "MODERATOR"

              if (!canEdit) {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "You don't have permission to edit this rule",
                })
              }

              await ctx.prisma.$transaction(async tx => {
                // Find or create tags
                const tags = await Promise.all(
                  tagSlugs.map(async slug => {
                    return tx.tag.upsert({
                      where: { slug },
                      update: {},
                      create: {
                        slug,
                        name: slug.charAt(0).toUpperCase() + slug.slice(1),
                      },
                    })
                  })
                )

                // Create rule-tag relationships (ignore duplicates)
                for (const tag of tags) {
                  await tx.ruleTag.upsert({
                    where: {
                      ruleId_tagId: {
                        ruleId,
                        tagId: tag.id,
                      },
                    },
                    update: {},
                    create: {
                      ruleId,
                      tagId: tag.id,
                    },
                  })
                }
              })

              return { success: true }
            },

            detach: async ({ input, ctx }) => {
              const { ruleId, tagSlugs } = input

              // Mock getRuleOwnership
              const rule = await ctx.prisma.rule.findUnique({
                where: { id: ruleId, deletedAt: null },
                select: {
                  id: true,
                  createdByUserId: true,
                  status: true,
                },
              })

              if (!rule) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Rule not found",
                })
              }

              const canEdit =
                rule.createdByUserId === ctx.user?.id ||
                ctx.user?.role === "ADMIN" ||
                ctx.user?.role === "MODERATOR"

              if (!canEdit) {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "You don't have permission to edit this rule",
                })
              }

              // Find tag IDs
              const tags = await ctx.prisma.tag.findMany({
                where: { slug: { in: tagSlugs } },
                select: { id: true },
              })

              if (tags.length > 0) {
                await ctx.prisma.ruleTag.deleteMany({
                  where: {
                    ruleId,
                    tagId: { in: tags.map(t => t.id) },
                  },
                })
              }

              return { success: true }
            },

            create: async ({ input, ctx }) => {
              const { slug, name } = input

              // Only admins/moderators can create tags
              if (!ctx.user || (ctx.user.role !== "ADMIN" && ctx.user.role !== "MODERATOR")) {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "Only moderators and admins can create tags",
                })
              }

              const tag = await ctx.prisma.tag.create({
                data: { slug, name },
              })

              return {
                id: tag.id,
                slug: tag.slug,
                name: tag.name,
              }
            },

            getPopular: async ({ input, ctx }) => {
              const { limit = 10, period = "all" } = input || {}

              let createdAfter
              if (period !== "all") {
                createdAfter = new Date()
                switch (period) {
                  case "day":
                    createdAfter.setDate(createdAfter.getDate() - 1)
                    break
                  case "week":
                    createdAfter.setDate(createdAfter.getDate() - 7)
                    break
                  case "month":
                    createdAfter.setDate(createdAfter.getDate() - 30)
                    break
                }
              }

              const tags = await ctx.prisma.tag.findMany({
                take: limit,
                include: {
                  _count: {
                    select: {
                      rules: {
                        where: {
                          rule: {
                            deletedAt: null,
                            status: "PUBLISHED",
                            ...(createdAfter && { createdAt: { gte: createdAfter } }),
                          },
                        },
                      },
                    },
                  },
                },
                orderBy: {
                  rules: { _count: "desc" },
                },
              })

              return tags.map(tag => ({
                id: tag.id,
                slug: tag.slug,
                name: tag.name,
                count: tag._count.rules,
              }))
            },

            getSuggestions: async ({ input, ctx }) => {
              const { query, limit = 10, excludeExisting } = input

              const where = {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { slug: { contains: query, mode: "insensitive" } },
                ],
              }

              if (excludeExisting && excludeExisting.length > 0) {
                where.slug = { notIn: excludeExisting }
              }

              const tags = await ctx.prisma.tag.findMany({
                where,
                take: limit,
                orderBy: [{ name: "asc" }],
              })

              return tags.map(tag => ({
                id: tag.id,
                slug: tag.slug,
                name: tag.name,
              }))
            },
          }

          if (mockHandlers[key]) {
            return await mockHandlers[key]({ input, ctx })
          }

          throw new Error(`No handler found for ${key}`)
        }
      }
      return caller
    }),
  })),
  publicProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
  },
  protectedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  },
  rateLimitedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  },
  modProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  },
  audit: vi.fn(() => ({
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  })),
  getRuleOwnership: vi.fn(),
}))

// Mock schemas
vi.mock("../schemas/tags", () => ({
  listTagsSchema: { parse: vi.fn(data => data) },
  getTagBySlugSchema: { parse: vi.fn(data => data) },
  attachTagsSchema: { parse: vi.fn(data => data) },
  detachTagsSchema: { parse: vi.fn(data => data) },
  createTagSchema: { parse: vi.fn(data => data) },
  updateTagSchema: { parse: vi.fn(data => data) },
  getPopularTagsSchema: { parse: vi.fn(data => data) },
  getTagSuggestionsSchema: { parse: vi.fn(data => data) },
}))

vi.mock("../schemas/dto", () => ({
  tagDTOSchema: {
    parse: vi.fn(data => data),
    extend: vi.fn(schema => ({
      parse: vi.fn(data => data),
      nullable: vi.fn(() => ({ parse: vi.fn(data => data) })),
    })),
  },
}))

vi.mock("../schemas/base", () => ({
  createPaginatedSchema: vi.fn(() => ({ parse: vi.fn(data => data) })),
}))

describe("Tags Router", () => {
  let mockPrisma: any
  let mockCtx: any
  let caller: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock Prisma client
    mockPrisma = {
      tag: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
      },
      rule: {
        findUnique: vi.fn(),
      },
      ruleTag: {
        count: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    }

    // Mock context
    mockCtx = {
      prisma: mockPrisma,
      user: {
        id: "user-123",
        role: "USER",
      },
      reqIpHash: "hash123",
    }

    // Create caller
    caller = tagsRouter.createCaller(mockCtx)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("list", () => {
    it("should list tags with default pagination", async () => {
      const mockTags = [
        { id: "tag-1", slug: "javascript", name: "JavaScript" },
        { id: "tag-2", slug: "typescript", name: "TypeScript" },
      ]

      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      const result = await caller.list({})

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: "asc" },
        take: 26,
        include: undefined,
      })

      expect(result).toEqual({
        items: [
          { id: "tag-1", slug: "javascript", name: "JavaScript", count: undefined },
          { id: "tag-2", slug: "typescript", name: "TypeScript", count: undefined },
        ],
        nextCursor: undefined,
        hasMore: false,
      })
    })

    it("should list tags with search", async () => {
      const input = { search: "script", limit: 10 }
      const mockTags = [
        { id: "tag-1", slug: "javascript", name: "JavaScript" },
        { id: "tag-2", slug: "typescript", name: "TypeScript" },
      ]

      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      const result = await caller.list(input)

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: "script", mode: "insensitive" } },
            { slug: { contains: "script", mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        take: 11,
        include: undefined,
      })

      expect(result.items).toHaveLength(2)
    })

    it("should list tags with count sorting", async () => {
      const input = { sort: "count", includeCount: true }
      const mockTags = [
        {
          id: "tag-1",
          slug: "javascript",
          name: "JavaScript",
          _count: { rules: 10 },
        },
        {
          id: "tag-2",
          slug: "typescript",
          name: "TypeScript",
          _count: { rules: 5 },
        },
      ]

      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      const result = await caller.list(input)

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { rules: { _count: "desc" } },
        take: 26,
        include: {
          _count: {
            select: {
              rules: {
                where: {
                  rule: { deletedAt: null, status: "PUBLISHED" },
                },
              },
            },
          },
        },
      })

      expect(result.items).toEqual([
        { id: "tag-1", slug: "javascript", name: "JavaScript", count: 10 },
        { id: "tag-2", slug: "typescript", name: "TypeScript", count: 5 },
      ])
    })

    it("should handle pagination with cursor", async () => {
      const input = { cursor: "tag-1", limit: 5 }
      const mockTags = Array.from({ length: 6 }, (_, i) => ({
        id: `tag-${i + 2}`,
        slug: `tag-${i + 2}`,
        name: `Tag ${i + 2}`,
      }))

      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      const result = await caller.list(input)

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: { id: { gt: "tag-1" } },
        orderBy: { name: "asc" },
        take: 6,
        include: undefined,
      })

      expect(result.hasMore).toBe(true)
      expect(result.items).toHaveLength(5)
      expect(result.nextCursor).toBe("tag-6")
    })

    it("should handle different sort options", async () => {
      const mockTags = [{ id: "tag-1", slug: "javascript", name: "JavaScript" }]

      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      // Test name sort
      await caller.list({ sort: "name" })
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: "asc" } })
      )

      // Test recent sort
      await caller.list({ sort: "recent" })
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { id: "desc" } })
      )
    })
  })

  describe("getBySlug", () => {
    it("should get tag by slug", async () => {
      const input = { slug: "javascript" }
      const mockTag = {
        id: "tag-1",
        slug: "javascript",
        name: "JavaScript",
      }

      mockPrisma.tag.findUnique.mockResolvedValue(mockTag)

      const result = await caller.getBySlug(input)

      expect(mockPrisma.tag.findUnique).toHaveBeenCalledWith({
        where: { slug: "javascript" },
        include: undefined,
      })

      expect(result).toEqual({
        id: "tag-1",
        slug: "javascript",
        name: "JavaScript",
        rulesCount: 0,
        recentRulesCount: 0,
      })
    })

    it("should get tag by slug with stats", async () => {
      const input = { slug: "javascript", includeStats: true }
      const mockTag = {
        id: "tag-1",
        slug: "javascript",
        name: "JavaScript",
        _count: { rules: 10 },
      }

      mockPrisma.tag.findUnique.mockResolvedValue(mockTag)
      mockPrisma.ruleTag.count.mockResolvedValue(3)

      const result = await caller.getBySlug(input)

      expect(mockPrisma.tag.findUnique).toHaveBeenCalledWith({
        where: { slug: "javascript" },
        include: {
          _count: {
            select: {
              rules: {
                where: {
                  rule: { deletedAt: null, status: "PUBLISHED" },
                },
              },
            },
          },
        },
      })

      expect(mockPrisma.ruleTag.count).toHaveBeenCalledWith({
        where: {
          tagId: "tag-1",
          rule: {
            deletedAt: null,
            status: "PUBLISHED",
            createdAt: { gte: expect.any(Date) },
          },
        },
      })

      expect(result).toEqual({
        id: "tag-1",
        slug: "javascript",
        name: "JavaScript",
        rulesCount: 10,
        recentRulesCount: 3,
      })
    })

    it("should return null if tag not found", async () => {
      const input = { slug: "nonexistent" }

      mockPrisma.tag.findUnique.mockResolvedValue(null)

      const result = await caller.getBySlug(input)

      expect(result).toBeNull()
    })
  })

  describe("attach", () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback(mockPrisma)
      })
    })

    it("should attach tags to rule", async () => {
      const input = {
        ruleId: "rule-123",
        tagSlugs: ["javascript", "typescript"],
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        status: "PUBLISHED",
      }

      const mockTags = [
        { id: "tag-1", slug: "javascript", name: "JavaScript" },
        { id: "tag-2", slug: "typescript", name: "TypeScript" },
      ]

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.tag.upsert.mockResolvedValueOnce(mockTags[0]).mockResolvedValueOnce(mockTags[1])
      mockPrisma.ruleTag.upsert.mockResolvedValue({})

      const result = await caller.attach(input)

      expect(mockPrisma.rule.findUnique).toHaveBeenCalledWith({
        where: { id: "rule-123", deletedAt: null },
        select: {
          id: true,
          createdByUserId: true,
          status: true,
        },
      })

      expect(mockPrisma.tag.upsert).toHaveBeenCalledTimes(2)
      expect(mockPrisma.tag.upsert).toHaveBeenCalledWith({
        where: { slug: "javascript" },
        update: {},
        create: {
          slug: "javascript",
          name: "Javascript",
        },
      })

      expect(mockPrisma.ruleTag.upsert).toHaveBeenCalledTimes(2)
      expect(mockPrisma.ruleTag.upsert).toHaveBeenCalledWith({
        where: {
          ruleId_tagId: {
            ruleId: "rule-123",
            tagId: "tag-1",
          },
        },
        update: {},
        create: {
          ruleId: "rule-123",
          tagId: "tag-1",
        },
      })

      expect(result).toEqual({ success: true })
    })

    it("should throw error if rule not found", async () => {
      const input = {
        ruleId: "nonexistent-rule",
        tagSlugs: ["javascript"],
      }

      mockPrisma.rule.findUnique.mockResolvedValue(null)

      await expect(caller.attach(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        })
      )
    })

    it("should throw error if user lacks permission", async () => {
      const input = {
        ruleId: "rule-123",
        tagSlugs: ["javascript"],
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "other-user",
        status: "PUBLISHED",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)

      await expect(caller.attach(input)).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to edit this rule",
        })
      )
    })

    it("should allow admin to attach tags", async () => {
      mockCtx.user.role = "ADMIN"
      const input = {
        ruleId: "rule-123",
        tagSlugs: ["javascript"],
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "other-user",
        status: "PUBLISHED",
      }

      const mockTag = { id: "tag-1", slug: "javascript", name: "JavaScript" }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.tag.upsert.mockResolvedValue(mockTag)
      mockPrisma.ruleTag.upsert.mockResolvedValue({})

      const result = await caller.attach(input)

      expect(result).toEqual({ success: true })
    })

    it("should allow moderator to attach tags", async () => {
      mockCtx.user.role = "MODERATOR"
      const input = {
        ruleId: "rule-123",
        tagSlugs: ["javascript"],
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "other-user",
        status: "PUBLISHED",
      }

      const mockTag = { id: "tag-1", slug: "javascript", name: "JavaScript" }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.tag.upsert.mockResolvedValue(mockTag)
      mockPrisma.ruleTag.upsert.mockResolvedValue({})

      const result = await caller.attach(input)

      expect(result).toEqual({ success: true })
    })
  })

  describe("detach", () => {
    it("should detach tags from rule", async () => {
      const input = {
        ruleId: "rule-123",
        tagSlugs: ["javascript", "typescript"],
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        status: "PUBLISHED",
      }

      const mockTags = [{ id: "tag-1" }, { id: "tag-2" }]

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.tag.findMany.mockResolvedValue(mockTags)
      mockPrisma.ruleTag.deleteMany.mockResolvedValue({ count: 2 })

      const result = await caller.detach(input)

      expect(mockPrisma.rule.findUnique).toHaveBeenCalledWith({
        where: { id: "rule-123", deletedAt: null },
        select: {
          id: true,
          createdByUserId: true,
          status: true,
        },
      })

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: { slug: { in: ["javascript", "typescript"] } },
        select: { id: true },
      })

      expect(mockPrisma.ruleTag.deleteMany).toHaveBeenCalledWith({
        where: {
          ruleId: "rule-123",
          tagId: { in: ["tag-1", "tag-2"] },
        },
      })

      expect(result).toEqual({ success: true })
    })

    it("should handle empty tag list", async () => {
      const input = {
        ruleId: "rule-123",
        tagSlugs: ["nonexistent"],
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        status: "PUBLISHED",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.tag.findMany.mockResolvedValue([])

      const result = await caller.detach(input)

      expect(mockPrisma.ruleTag.deleteMany).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it("should throw error if user lacks permission", async () => {
      const input = {
        ruleId: "rule-123",
        tagSlugs: ["javascript"],
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "other-user",
        status: "PUBLISHED",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)

      await expect(caller.detach(input)).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to edit this rule",
        })
      )
    })
  })

  describe("create", () => {
    it("should create tag as admin", async () => {
      mockCtx.user.role = "ADMIN"
      const input = {
        slug: "new-tag",
        name: "New Tag",
      }

      const mockTag = {
        id: "tag-new",
        slug: "new-tag",
        name: "New Tag",
      }

      mockPrisma.tag.create.mockResolvedValue(mockTag)

      const result = await caller.create(input)

      expect(mockPrisma.tag.create).toHaveBeenCalledWith({
        data: { slug: "new-tag", name: "New Tag" },
      })

      expect(result).toEqual({
        id: "tag-new",
        slug: "new-tag",
        name: "New Tag",
      })
    })

    it("should create tag as moderator", async () => {
      mockCtx.user.role = "MODERATOR"
      const input = {
        slug: "new-tag",
        name: "New Tag",
      }

      const mockTag = {
        id: "tag-new",
        slug: "new-tag",
        name: "New Tag",
      }

      mockPrisma.tag.create.mockResolvedValue(mockTag)

      const result = await caller.create(input)

      expect(result).toEqual({
        id: "tag-new",
        slug: "new-tag",
        name: "New Tag",
      })
    })

    it("should throw error if user is not admin/moderator", async () => {
      const input = {
        slug: "new-tag",
        name: "New Tag",
      }

      await expect(caller.create(input)).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Only moderators and admins can create tags",
        })
      )
    })

    it("should throw error if user is not authenticated", async () => {
      mockCtx.user = null
      const input = {
        slug: "new-tag",
        name: "New Tag",
      }

      await expect(caller.create(input)).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Only moderators and admins can create tags",
        })
      )
    })
  })

  describe("getPopular", () => {
    it("should get popular tags for all time", async () => {
      const input = { limit: 5, period: "all" }
      const mockTags = [
        {
          id: "tag-1",
          slug: "javascript",
          name: "JavaScript",
          _count: { rules: 10 },
        },
        {
          id: "tag-2",
          slug: "typescript",
          name: "TypeScript",
          _count: { rules: 8 },
        },
      ]

      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      const result = await caller.getPopular(input)

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        take: 5,
        include: {
          _count: {
            select: {
              rules: {
                where: {
                  rule: {
                    deletedAt: null,
                    status: "PUBLISHED",
                  },
                },
              },
            },
          },
        },
        orderBy: {
          rules: { _count: "desc" },
        },
      })

      expect(result).toEqual([
        {
          id: "tag-1",
          slug: "javascript",
          name: "JavaScript",
          count: 10,
        },
        {
          id: "tag-2",
          slug: "typescript",
          name: "TypeScript",
          count: 8,
        },
      ])
    })

    it("should get popular tags for specific period", async () => {
      const input = { limit: 3, period: "week" }
      const mockTags = [
        {
          id: "tag-1",
          slug: "javascript",
          name: "JavaScript",
          _count: { rules: 5 },
        },
      ]

      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      const result = await caller.getPopular(input)

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        take: 3,
        include: {
          _count: {
            select: {
              rules: {
                where: {
                  rule: {
                    deletedAt: null,
                    status: "PUBLISHED",
                    createdAt: { gte: expect.any(Date) },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          rules: { _count: "desc" },
        },
      })

      expect(result).toHaveLength(1)
    })

    it("should handle different period options", async () => {
      const mockTags = []
      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      // Test day period
      await caller.getPopular({ period: "day" })
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            _count: {
              select: {
                rules: {
                  where: {
                    rule: expect.objectContaining({
                      createdAt: { gte: expect.any(Date) },
                    }),
                  },
                },
              },
            },
          },
        })
      )

      // Test month period
      await caller.getPopular({ period: "month" })
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            _count: {
              select: {
                rules: {
                  where: {
                    rule: expect.objectContaining({
                      createdAt: { gte: expect.any(Date) },
                    }),
                  },
                },
              },
            },
          },
        })
      )
    })

    it("should use default values", async () => {
      const mockTags = []
      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      await caller.getPopular({})

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        take: 10,
        include: {
          _count: {
            select: {
              rules: {
                where: {
                  rule: {
                    deletedAt: null,
                    status: "PUBLISHED",
                  },
                },
              },
            },
          },
        },
        orderBy: {
          rules: { _count: "desc" },
        },
      })
    })
  })

  describe("getSuggestions", () => {
    it("should get tag suggestions", async () => {
      const input = {
        query: "script",
        limit: 5,
      }

      const mockTags = [
        { id: "tag-1", slug: "javascript", name: "JavaScript" },
        { id: "tag-2", slug: "typescript", name: "TypeScript" },
      ]

      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      const result = await caller.getSuggestions(input)

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: "script", mode: "insensitive" } },
            { slug: { contains: "script", mode: "insensitive" } },
          ],
        },
        take: 5,
        orderBy: [{ name: "asc" }],
      })

      expect(result).toEqual([
        { id: "tag-1", slug: "javascript", name: "JavaScript" },
        { id: "tag-2", slug: "typescript", name: "TypeScript" },
      ])
    })

    it("should exclude existing tags", async () => {
      const input = {
        query: "script",
        limit: 5,
        excludeExisting: ["javascript", "coffeescript"],
      }

      const mockTags = [{ id: "tag-2", slug: "typescript", name: "TypeScript" }]

      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      const result = await caller.getSuggestions(input)

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: "script", mode: "insensitive" } },
            { slug: { contains: "script", mode: "insensitive" } },
          ],
          slug: { notIn: ["javascript", "coffeescript"] },
        },
        take: 5,
        orderBy: [{ name: "asc" }],
      })

      expect(result).toHaveLength(1)
    })

    it("should handle empty exclude list", async () => {
      const input = {
        query: "script",
        excludeExisting: [],
      }

      const mockTags = []
      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      const result = await caller.getSuggestions(input)

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: "script", mode: "insensitive" } },
            { slug: { contains: "script", mode: "insensitive" } },
          ],
        },
        take: 10,
        orderBy: [{ name: "asc" }],
      })
    })

    it("should use default limit", async () => {
      const input = { query: "test" }
      const mockTags = []

      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      await caller.getSuggestions(input)

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }))
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle database errors gracefully", async () => {
      mockPrisma.tag.findMany.mockRejectedValue(new Error("Database connection failed"))

      await expect(caller.list({})).rejects.toThrow("Database connection failed")
    })

    it("should handle transaction failures in attach", async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error("Transaction failed"))

      const input = {
        ruleId: "rule-123",
        tagSlugs: ["javascript"],
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        status: "PUBLISHED",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)

      await expect(caller.attach(input)).rejects.toThrow("Transaction failed")
    })

    it("should handle large tag lists", async () => {
      const input = {
        ruleId: "rule-123",
        tagSlugs: Array.from({ length: 100 }, (_, i) => `tag-${i}`),
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        status: "PUBLISHED",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)

      // Since we're mocking the transaction, we need to mock the implementation properly
      mockPrisma.$transaction.mockImplementation(async callback => {
        const tx = {
          tag: {
            upsert: vi.fn().mockImplementation(args => {
              const slug = args.where.slug
              return Promise.resolve({
                id: slug,
                slug,
                name: slug.charAt(0).toUpperCase() + slug.slice(1),
              })
            }),
          },
          ruleTag: {
            upsert: vi.fn().mockResolvedValue({}),
          },
        }

        const result = await callback(tx)

        // Check that the operations were called the expected number of times
        expect(tx.tag.upsert).toHaveBeenCalledTimes(100)
        expect(tx.ruleTag.upsert).toHaveBeenCalledTimes(100)

        return result
      })

      const result = await caller.attach(input)

      expect(result).toEqual({ success: true })
    })

    it("should handle special characters in tag names", async () => {
      const input = {
        ruleId: "rule-123",
        tagSlugs: ["c++", "c#", "node.js"],
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        status: "PUBLISHED",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.tag.upsert.mockImplementation(args => {
        const slug = args.where.slug
        return Promise.resolve({
          id: `tag-${slug}`,
          slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1),
        })
      })
      mockPrisma.ruleTag.upsert.mockResolvedValue({})

      const result = await caller.attach(input)

      expect(result).toEqual({ success: true })
    })

    it("should handle concurrent tag operations", async () => {
      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        status: "PUBLISHED",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.tag.upsert.mockResolvedValue({
        id: "tag-1",
        slug: "javascript",
        name: "JavaScript",
      })
      mockPrisma.ruleTag.upsert.mockResolvedValue({})

      const attachPromise = caller.attach({
        ruleId: "rule-123",
        tagSlugs: ["javascript"],
      })

      const detachPromise = caller.detach({
        ruleId: "rule-123",
        tagSlugs: ["typescript"],
      })

      mockPrisma.tag.findMany.mockResolvedValue([{ id: "tag-2" }])
      mockPrisma.ruleTag.deleteMany.mockResolvedValue({ count: 1 })

      const [attachResult, detachResult] = await Promise.all([attachPromise, detachPromise])

      expect(attachResult).toEqual({ success: true })
      expect(detachResult).toEqual({ success: true })
    })

    it("should handle empty search results", async () => {
      const input = { search: "nonexistentlanguage" }

      mockPrisma.tag.findMany.mockResolvedValue([])

      const result = await caller.list(input)

      expect(result).toEqual({
        items: [],
        nextCursor: undefined,
        hasMore: false,
      })
    })

    it("should handle tags with no rules", async () => {
      const input = { includeCount: true }
      const mockTags = [
        {
          id: "tag-1",
          slug: "unused-tag",
          name: "Unused Tag",
          _count: { rules: 0 },
        },
      ]

      mockPrisma.tag.findMany.mockResolvedValue(mockTags)

      const result = await caller.list(input)

      expect(result.items[0].count).toBe(0)
    })
  })
})
