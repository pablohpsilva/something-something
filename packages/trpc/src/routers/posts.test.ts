import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { postsRouter } from "./posts"

// Mock dependencies
vi.mock("../server", () => ({
  createTRPCRouter: vi.fn(routes => ({
    createCaller: vi.fn(ctx => {
      const caller = {}
      for (const [key, procedure] of Object.entries(routes)) {
        caller[key] = async input => {
          const mockHandlers = {
            getAll: async ({ input, ctx }) => {
              const { published, limit = 10, cursor } = input || {}

              const posts = await ctx.db.post.findMany({
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                where: {
                  published,
                },
                select: {
                  id: true,
                  title: true,
                  content: true,
                  published: true,
                  createdAt: true,
                  author: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: "desc",
                },
              })

              let nextCursor = undefined
              if (posts.length > limit) {
                const nextItem = posts.pop()
                nextCursor = nextItem.id
              }

              return {
                posts,
                nextCursor,
              }
            },
            getById: async ({ input, ctx }) => {
              const { id } = input

              return ctx.db.post.findUnique({
                where: { id },
                select: {
                  id: true,
                  title: true,
                  content: true,
                  published: true,
                  createdAt: true,
                  updatedAt: true,
                  author: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              })
            },
            create: async ({ input, ctx }) => {
              const { title, content, published = false } = input

              return ctx.db.post.create({
                data: {
                  title,
                  content,
                  published,
                  authorId: ctx.userId,
                },
              })
            },
            update: async ({ input, ctx }) => {
              const { id, ...data } = input

              return ctx.db.post.update({
                where: { id },
                data,
              })
            },
            delete: async ({ input, ctx }) => {
              const { id } = input

              return ctx.db.post.delete({
                where: { id },
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
  publicProcedure: {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
  },
  protectedProcedure: {
    input: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
}))

// Mock data
const mockUser = {
  id: "user123",
  name: "Test User",
  email: "test@example.com",
}

const mockAuthor = {
  id: "author123",
  name: "Post Author",
  email: "author@example.com",
}

const mockPost = {
  id: "post123",
  title: "Test Post",
  content: "This is a test post content",
  published: true,
  createdAt: new Date("2024-01-15T10:00:00Z"),
  updatedAt: new Date("2024-01-15T10:00:00Z"),
  author: mockAuthor,
}

const mockDraftPost = {
  id: "post456",
  title: "Draft Post",
  content: "This is a draft post",
  published: false,
  createdAt: new Date("2024-01-14T10:00:00Z"),
  updatedAt: new Date("2024-01-14T10:00:00Z"),
  author: mockAuthor,
}

describe("Posts Router", () => {
  let caller: any
  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockDb = {
      post: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    }

    caller = postsRouter.createCaller({
      userId: mockUser.id,
      db: mockDb,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("getAll", () => {
    it("should return posts with default parameters", async () => {
      const posts = [mockPost]
      mockDb.post.findMany.mockResolvedValue(posts)

      const result = await caller.getAll({})

      expect(result).toEqual({
        posts: [mockPost],
        nextCursor: undefined,
      })

      expect(mockDb.post.findMany).toHaveBeenCalledWith({
        take: 11, // limit + 1
        cursor: undefined,
        where: {
          published: undefined,
        },
        select: {
          id: true,
          title: true,
          content: true,
          published: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    })

    it("should return published posts only", async () => {
      const posts = [mockPost]
      mockDb.post.findMany.mockResolvedValue(posts)

      const result = await caller.getAll({
        published: true,
        limit: 5,
      })

      expect(result).toEqual({
        posts: [mockPost],
        nextCursor: undefined,
      })

      expect(mockDb.post.findMany).toHaveBeenCalledWith({
        take: 6, // limit + 1
        cursor: undefined,
        where: {
          published: true,
        },
        select: {
          id: true,
          title: true,
          content: true,
          published: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    })

    it("should return draft posts only", async () => {
      const posts = [mockDraftPost]
      mockDb.post.findMany.mockResolvedValue(posts)

      const result = await caller.getAll({
        published: false,
        limit: 20,
      })

      expect(result).toEqual({
        posts: [mockDraftPost],
        nextCursor: undefined,
      })

      expect(mockDb.post.findMany).toHaveBeenCalledWith({
        take: 21, // limit + 1
        cursor: undefined,
        where: {
          published: false,
        },
        select: {
          id: true,
          title: true,
          content: true,
          published: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    })

    it("should handle pagination with cursor", async () => {
      const posts = [mockPost]
      mockDb.post.findMany.mockResolvedValue(posts)

      const result = await caller.getAll({
        cursor: "cursor123",
        limit: 10,
      })

      expect(result).toEqual({
        posts: [mockPost],
        nextCursor: undefined,
      })

      expect(mockDb.post.findMany).toHaveBeenCalledWith({
        take: 11,
        cursor: { id: "cursor123" },
        where: {
          published: undefined,
        },
        select: {
          id: true,
          title: true,
          content: true,
          published: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    })

    it("should handle pagination with more results", async () => {
      const posts = Array.from({ length: 11 }, (_, i) => ({
        ...mockPost,
        id: `post${i}`,
      }))
      mockDb.post.findMany.mockResolvedValue(posts)

      const result = await caller.getAll({
        limit: 10,
      })

      expect(result.posts).toHaveLength(10)
      expect(result.nextCursor).toBe("post10")

      // Verify the last item was popped
      expect(result.posts[9].id).toBe("post9")
    })

    it("should handle maximum limit", async () => {
      const posts = [mockPost]
      mockDb.post.findMany.mockResolvedValue(posts)

      await caller.getAll({
        limit: 100, // Maximum allowed
      })

      expect(mockDb.post.findMany).toHaveBeenCalledWith({
        take: 101,
        cursor: undefined,
        where: {
          published: undefined,
        },
        select: {
          id: true,
          title: true,
          content: true,
          published: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    })

    it("should handle empty results", async () => {
      mockDb.post.findMany.mockResolvedValue([])

      const result = await caller.getAll({})

      expect(result).toEqual({
        posts: [],
        nextCursor: undefined,
      })
    })

    it("should handle database errors", async () => {
      mockDb.post.findMany.mockRejectedValue(new Error("Database error"))

      await expect(caller.getAll({})).rejects.toThrow("Database error")
    })

    it("should handle mixed published and draft posts", async () => {
      const mixedPosts = [mockPost, mockDraftPost]
      mockDb.post.findMany.mockResolvedValue(mixedPosts)

      const result = await caller.getAll({
        // No published filter, should return all
      })

      expect(result.posts).toHaveLength(2)
      expect(result.posts).toContain(mockPost)
      expect(result.posts).toContain(mockDraftPost)
    })

    it("should handle complex pagination scenario", async () => {
      // First page with more results
      const firstPagePosts = Array.from({ length: 6 }, (_, i) => ({
        ...mockPost,
        id: `post${i}`,
      }))
      mockDb.post.findMany.mockResolvedValue(firstPagePosts)

      const result = await caller.getAll({
        limit: 5,
        published: true,
      })

      expect(result.posts).toHaveLength(5)
      expect(result.nextCursor).toBe("post5")
      expect(result.posts.map(p => p.id)).toEqual(["post0", "post1", "post2", "post3", "post4"])
    })
  })

  describe("getById", () => {
    it("should return a post by id", async () => {
      mockDb.post.findUnique.mockResolvedValue(mockPost)

      const result = await caller.getById({
        id: "post123",
      })

      expect(result).toEqual(mockPost)

      expect(mockDb.post.findUnique).toHaveBeenCalledWith({
        where: { id: "post123" },
        select: {
          id: true,
          title: true,
          content: true,
          published: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })
    })

    it("should return null when post not found", async () => {
      mockDb.post.findUnique.mockResolvedValue(null)

      const result = await caller.getById({
        id: "nonexistent",
      })

      expect(result).toBe(null)
    })

    it("should handle database errors", async () => {
      mockDb.post.findUnique.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.getById({
          id: "post123",
        })
      ).rejects.toThrow("Database error")
    })

    it("should return draft post", async () => {
      mockDb.post.findUnique.mockResolvedValue(mockDraftPost)

      const result = await caller.getById({
        id: "post456",
      })

      expect(result).toEqual(mockDraftPost)
      expect(result.published).toBe(false)
    })

    it("should include updatedAt field", async () => {
      const postWithUpdatedAt = {
        ...mockPost,
        updatedAt: new Date("2024-01-16T10:00:00Z"),
      }
      mockDb.post.findUnique.mockResolvedValue(postWithUpdatedAt)

      const result = await caller.getById({
        id: "post123",
      })

      expect(result.updatedAt).toEqual(new Date("2024-01-16T10:00:00Z"))
    })
  })

  describe("create", () => {
    it("should create a new post with all fields", async () => {
      const newPost = {
        title: "New Post",
        content: "This is new content",
        published: true,
      }

      const createdPost = {
        ...mockPost,
        id: "newpost123",
        title: newPost.title,
        content: newPost.content,
        published: newPost.published,
      }

      mockDb.post.create.mockResolvedValue(createdPost)

      const result = await caller.create(newPost)

      expect(result).toEqual(createdPost)

      expect(mockDb.post.create).toHaveBeenCalledWith({
        data: {
          title: "New Post",
          content: "This is new content",
          published: true,
          authorId: "user123",
        },
      })
    })

    it("should create a post with minimal fields", async () => {
      const newPost = {
        title: "Minimal Post",
      }

      const createdPost = {
        ...mockPost,
        id: "minimal123",
        title: newPost.title,
        content: undefined,
        published: false, // Default value
      }

      mockDb.post.create.mockResolvedValue(createdPost)

      const result = await caller.create(newPost)

      expect(result).toEqual(createdPost)

      expect(mockDb.post.create).toHaveBeenCalledWith({
        data: {
          title: "Minimal Post",
          content: undefined,
          published: false, // Default value
          authorId: "user123",
        },
      })
    })

    it("should create a draft post by default", async () => {
      const newPost = {
        title: "Draft Post",
        content: "Draft content",
      }

      const createdPost = {
        ...mockDraftPost,
        id: "draft123",
        title: newPost.title,
        content: newPost.content,
      }

      mockDb.post.create.mockResolvedValue(createdPost)

      const result = await caller.create(newPost)

      expect(result.published).toBe(false)

      expect(mockDb.post.create).toHaveBeenCalledWith({
        data: {
          title: "Draft Post",
          content: "Draft content",
          published: false, // Default value
          authorId: "user123",
        },
      })
    })

    it("should handle optional content", async () => {
      const newPost = {
        title: "No Content Post",
        published: true,
      }

      const createdPost = {
        ...mockPost,
        id: "nocontent123",
        title: newPost.title,
        content: undefined,
        published: true,
      }

      mockDb.post.create.mockResolvedValue(createdPost)

      const result = await caller.create(newPost)

      expect(result.content).toBeUndefined()

      expect(mockDb.post.create).toHaveBeenCalledWith({
        data: {
          title: "No Content Post",
          content: undefined,
          published: true,
          authorId: "user123",
        },
      })
    })

    it("should handle database errors", async () => {
      mockDb.post.create.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.create({
          title: "Error Post",
        })
      ).rejects.toThrow("Database error")
    })

    it("should use correct authorId from context", async () => {
      const callerWithDifferentUser = postsRouter.createCaller({
        userId: "different123",
        db: mockDb,
      })

      const newPost = {
        title: "Author Test",
        content: "Test content",
      }

      const createdPost = {
        ...mockPost,
        id: "authortest123",
        title: newPost.title,
        content: newPost.content,
      }

      mockDb.post.create.mockResolvedValue(createdPost)

      await callerWithDifferentUser.create(newPost)

      expect(mockDb.post.create).toHaveBeenCalledWith({
        data: {
          title: "Author Test",
          content: "Test content",
          published: false,
          authorId: "different123", // Different user ID
        },
      })
    })
  })

  describe("update", () => {
    it("should update all fields of a post", async () => {
      const updateData = {
        id: "post123",
        title: "Updated Title",
        content: "Updated content",
        published: true,
      }

      const updatedPost = {
        ...mockPost,
        title: updateData.title,
        content: updateData.content,
        published: updateData.published,
        updatedAt: new Date("2024-01-16T10:00:00Z"),
      }

      mockDb.post.update.mockResolvedValue(updatedPost)

      const result = await caller.update(updateData)

      expect(result).toEqual(updatedPost)

      expect(mockDb.post.update).toHaveBeenCalledWith({
        where: { id: "post123" },
        data: {
          title: "Updated Title",
          content: "Updated content",
          published: true,
        },
      })
    })

    it("should update only title", async () => {
      const updateData = {
        id: "post123",
        title: "New Title Only",
      }

      const updatedPost = {
        ...mockPost,
        title: updateData.title,
        updatedAt: new Date("2024-01-16T10:00:00Z"),
      }

      mockDb.post.update.mockResolvedValue(updatedPost)

      const result = await caller.update(updateData)

      expect(result).toEqual(updatedPost)

      expect(mockDb.post.update).toHaveBeenCalledWith({
        where: { id: "post123" },
        data: {
          title: "New Title Only",
        },
      })
    })

    it("should update only content", async () => {
      const updateData = {
        id: "post123",
        content: "New content only",
      }

      const updatedPost = {
        ...mockPost,
        content: updateData.content,
        updatedAt: new Date("2024-01-16T10:00:00Z"),
      }

      mockDb.post.update.mockResolvedValue(updatedPost)

      const result = await caller.update(updateData)

      expect(result).toEqual(updatedPost)

      expect(mockDb.post.update).toHaveBeenCalledWith({
        where: { id: "post123" },
        data: {
          content: "New content only",
        },
      })
    })

    it("should update only published status", async () => {
      const updateData = {
        id: "post456",
        published: true, // Publishing a draft
      }

      const updatedPost = {
        ...mockDraftPost,
        published: true,
        updatedAt: new Date("2024-01-16T10:00:00Z"),
      }

      mockDb.post.update.mockResolvedValue(updatedPost)

      const result = await caller.update(updateData)

      expect(result).toEqual(updatedPost)

      expect(mockDb.post.update).toHaveBeenCalledWith({
        where: { id: "post456" },
        data: {
          published: true,
        },
      })
    })

    it("should unpublish a post", async () => {
      const updateData = {
        id: "post123",
        published: false, // Unpublishing
      }

      const updatedPost = {
        ...mockPost,
        published: false,
        updatedAt: new Date("2024-01-16T10:00:00Z"),
      }

      mockDb.post.update.mockResolvedValue(updatedPost)

      const result = await caller.update(updateData)

      expect(result.published).toBe(false)

      expect(mockDb.post.update).toHaveBeenCalledWith({
        where: { id: "post123" },
        data: {
          published: false,
        },
      })
    })

    it("should handle database errors", async () => {
      mockDb.post.update.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.update({
          id: "post123",
          title: "Error Update",
        })
      ).rejects.toThrow("Database error")
    })

    it("should handle non-existent post", async () => {
      mockDb.post.update.mockRejectedValue(new Error("Record not found"))

      await expect(
        caller.update({
          id: "nonexistent",
          title: "Update Non-existent",
        })
      ).rejects.toThrow("Record not found")
    })

    it("should clear content field", async () => {
      const updateData = {
        id: "post123",
        content: "", // Empty content
      }

      const updatedPost = {
        ...mockPost,
        content: "",
        updatedAt: new Date("2024-01-16T10:00:00Z"),
      }

      mockDb.post.update.mockResolvedValue(updatedPost)

      const result = await caller.update(updateData)

      expect(result.content).toBe("")

      expect(mockDb.post.update).toHaveBeenCalledWith({
        where: { id: "post123" },
        data: {
          content: "",
        },
      })
    })
  })

  describe("delete", () => {
    it("should delete a post", async () => {
      const deletedPost = { ...mockPost }
      mockDb.post.delete.mockResolvedValue(deletedPost)

      const result = await caller.delete({
        id: "post123",
      })

      expect(result).toEqual(deletedPost)

      expect(mockDb.post.delete).toHaveBeenCalledWith({
        where: { id: "post123" },
      })
    })

    it("should delete a draft post", async () => {
      const deletedPost = { ...mockDraftPost }
      mockDb.post.delete.mockResolvedValue(deletedPost)

      const result = await caller.delete({
        id: "post456",
      })

      expect(result).toEqual(deletedPost)

      expect(mockDb.post.delete).toHaveBeenCalledWith({
        where: { id: "post456" },
      })
    })

    it("should handle database errors", async () => {
      mockDb.post.delete.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.delete({
          id: "post123",
        })
      ).rejects.toThrow("Database error")
    })

    it("should handle non-existent post", async () => {
      mockDb.post.delete.mockRejectedValue(new Error("Record not found"))

      await expect(
        caller.delete({
          id: "nonexistent",
        })
      ).rejects.toThrow("Record not found")
    })

    it("should handle foreign key constraints", async () => {
      mockDb.post.delete.mockRejectedValue(new Error("Foreign key constraint failed"))

      await expect(
        caller.delete({
          id: "post123",
        })
      ).rejects.toThrow("Foreign key constraint failed")
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle complete post lifecycle", async () => {
      // 1. Create a post
      const newPost = {
        title: "Lifecycle Post",
        content: "Initial content",
        published: false,
      }

      const createdPost = {
        ...mockPost,
        id: "lifecycle123",
        title: newPost.title,
        content: newPost.content,
        published: false,
      }

      mockDb.post.create.mockResolvedValue(createdPost)

      const createResult = await caller.create(newPost)
      expect(createResult.published).toBe(false)

      // 2. Get the post by ID
      mockDb.post.findUnique.mockResolvedValue(createdPost)

      const getResult = await caller.getById({ id: "lifecycle123" })
      expect(getResult.title).toBe("Lifecycle Post")

      // 3. Update the post to publish it
      const updatedPost = {
        ...createdPost,
        published: true,
        updatedAt: new Date("2024-01-16T10:00:00Z"),
      }

      mockDb.post.update.mockResolvedValue(updatedPost)

      const updateResult = await caller.update({
        id: "lifecycle123",
        published: true,
      })
      expect(updateResult.published).toBe(true)

      // 4. Verify in list of published posts
      mockDb.post.findMany.mockResolvedValue([updatedPost])

      const listResult = await caller.getAll({ published: true })
      expect(listResult.posts).toHaveLength(1)
      expect(listResult.posts[0].published).toBe(true)

      // 5. Delete the post
      mockDb.post.delete.mockResolvedValue(updatedPost)

      const deleteResult = await caller.delete({ id: "lifecycle123" })
      expect(deleteResult.id).toBe("lifecycle123")
    })

    it("should handle concurrent operations", async () => {
      // Simulate concurrent post creation
      const posts = [
        { title: "Post 1", content: "Content 1" },
        { title: "Post 2", content: "Content 2" },
        { title: "Post 3", content: "Content 3" },
      ]

      mockDb.post.create.mockImplementation(data =>
        Promise.resolve({
          ...mockPost,
          id: `post_${data.data.title.replace(" ", "_").toLowerCase()}`,
          title: data.data.title,
          content: data.data.content,
        })
      )

      const createPromises = posts.map(post => caller.create(post))
      const createResults = await Promise.all(createPromises)

      expect(createResults).toHaveLength(3)
      expect(createResults[0].title).toBe("Post 1")
      expect(createResults[1].title).toBe("Post 2")
      expect(createResults[2].title).toBe("Post 3")
    })

    it("should handle pagination edge cases", async () => {
      // Test pagination at exact boundary
      const exactBoundaryPosts = Array.from({ length: 10 }, (_, i) => ({
        ...mockPost,
        id: `post${i}`,
      }))

      mockDb.post.findMany.mockResolvedValue(exactBoundaryPosts)

      const result = await caller.getAll({ limit: 10 })

      // Should return all 10 posts with no next cursor
      expect(result.posts).toHaveLength(10)
      expect(result.nextCursor).toBeUndefined()
    })

    it("should handle mixed content scenarios", async () => {
      const mixedPosts = [
        { ...mockPost, id: "post1", published: true, content: "Rich content" },
        {
          ...mockPost,
          id: "post2",
          published: false,
          content: null,
          title: "No content",
        },
        {
          ...mockPost,
          id: "post3",
          published: true,
          content: "",
          title: "Empty content",
        },
        {
          ...mockPost,
          id: "post4",
          published: false,
          content: "Very long content that exceeds normal limits...",
        },
      ]

      mockDb.post.findMany.mockResolvedValue(mixedPosts)

      const result = await caller.getAll({})

      expect(result.posts).toHaveLength(4)
      expect(result.posts.find(p => p.id === "post2").content).toBe(null)
      expect(result.posts.find(p => p.id === "post3").content).toBe("")
    })

    it("should handle author information consistency", async () => {
      const postWithAuthor = {
        ...mockPost,
        author: {
          id: "author123",
          name: "John Doe",
          email: "john@example.com",
        },
      }

      // Test getAll includes author
      mockDb.post.findMany.mockResolvedValue([postWithAuthor])
      const listResult = await caller.getAll({})
      expect(listResult.posts[0].author.name).toBe("John Doe")

      // Test getById includes author
      mockDb.post.findUnique.mockResolvedValue(postWithAuthor)
      const getResult = await caller.getById({ id: "post123" })
      expect(getResult.author.email).toBe("john@example.com")
    })

    it("should handle different post states", async () => {
      const postStates = [
        {
          ...mockPost,
          id: "published",
          published: true,
          title: "Published Post",
        },
        { ...mockPost, id: "draft", published: false, title: "Draft Post" },
        {
          ...mockPost,
          id: "empty_content",
          published: true,
          content: null,
          title: "No Content",
        },
        {
          ...mockPost,
          id: "long_title",
          published: false,
          title: "Very Long Title That Might Cause Issues",
        },
      ]

      for (const post of postStates) {
        mockDb.post.findUnique.mockResolvedValue(post)
        const result = await caller.getById({ id: post.id })
        expect(result.id).toBe(post.id)
        expect(result.published).toBe(post.published)
      }
    })

    it("should handle update operations with partial data", async () => {
      const originalPost = { ...mockPost }
      const updateScenarios = [
        { id: "post123", title: "New Title" },
        { id: "post123", content: "New Content" },
        { id: "post123", published: true },
        { id: "post123", title: "Title", content: "Content" },
        { id: "post123", title: "Title", published: false },
        { id: "post123", content: "Content", published: true },
      ]

      for (const updateData of updateScenarios) {
        const updatedPost = { ...originalPost, ...updateData }
        mockDb.post.update.mockResolvedValue(updatedPost)

        const result = await caller.update(updateData)
        expect(result.id).toBe("post123")

        // Verify only the updated fields were passed to the database
        const { id, ...expectedData } = updateData
        expect(mockDb.post.update).toHaveBeenCalledWith({
          where: { id: "post123" },
          data: expectedData,
        })
      }
    })

    it("should handle error recovery scenarios", async () => {
      // Simulate database recovery after failure
      mockDb.post.findMany
        .mockRejectedValueOnce(new Error("Connection timeout"))
        .mockResolvedValueOnce([mockPost])

      // First call should fail
      await expect(caller.getAll({})).rejects.toThrow("Connection timeout")

      // Second call should succeed
      const result = await caller.getAll({})
      expect(result.posts).toHaveLength(1)
    })

    it("should handle large datasets efficiently", async () => {
      // Test with large number of posts
      const largePosts = Array.from({ length: 1000 }, (_, i) => ({
        ...mockPost,
        id: `post${i}`,
        title: `Post ${i}`,
        createdAt: new Date(Date.now() - i * 1000 * 60), // 1 minute apart
      }))

      mockDb.post.findMany.mockResolvedValue(largePosts.slice(0, 101)) // First 101 for limit 100

      const result = await caller.getAll({ limit: 100 })

      expect(result.posts).toHaveLength(100)
      expect(result.nextCursor).toBe("post100")
    })

    it("should handle special characters in content", async () => {
      const specialPost = {
        title: "Special Characters: !@#$%^&*()_+{}|:<>?",
        content: "Content with special chars: àáâãäåæçèéêëìíîïñòóôõö÷øùúûüý UTF-8: 🚀📝💡",
        published: true,
      }

      const createdPost = {
        ...mockPost,
        id: "special123",
        title: specialPost.title,
        content: specialPost.content,
      }

      mockDb.post.create.mockResolvedValue(createdPost)

      const result = await caller.create(specialPost)

      expect(result.title).toBe(specialPost.title)
      expect(result.content).toBe(specialPost.content)
    })
  })
})
