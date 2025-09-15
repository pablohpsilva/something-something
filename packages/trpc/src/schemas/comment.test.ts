import { describe, it, expect } from "vitest"
import {
  commentCreateSchema,
  commentListSchema,
  commentEditSchema,
  commentDeleteSchema,
  commentDTOSchema,
  commentListResponseSchema,
  type CommentCreateInput,
  type CommentListInput,
  type CommentEditInput,
  type CommentDeleteInput,
  type CommentDTO,
  type CommentListResponse,
} from "./comment"

describe("Comment Schemas", () => {
  describe("commentCreateSchema", () => {
    it("should accept valid comment creation", () => {
      const validComment = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        body: "This is a great rule!",
      }

      const result = commentCreateSchema.parse(validComment)
      expect(result).toEqual(validComment)
    })

    it("should accept comment with parent ID", () => {
      const validComment = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        parentId: "clkv6tv5l0001l608w5i10wd8",
        body: "This is a reply to another comment",
      }

      const result = commentCreateSchema.parse(validComment)
      expect(result).toEqual(validComment)
    })

    it("should accept comment without parent ID", () => {
      const validComment = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        body: "This is a top-level comment",
      }

      const result = commentCreateSchema.parse(validComment)
      expect(result).toEqual(validComment)
    })

    it("should reject empty rule ID", () => {
      expect(() =>
        commentCreateSchema.parse({
          ruleId: "",
          body: "This is a comment",
        })
      ).toThrow()
    })

    it("should reject empty parent ID", () => {
      expect(() =>
        commentCreateSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          parentId: "",
          body: "This is a comment",
        })
      ).toThrow()
    })

    it("should reject empty body", () => {
      expect(() =>
        commentCreateSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          body: "",
        })
      ).toThrow("Comment cannot be empty")
    })

    it("should reject body that's too long", () => {
      expect(() =>
        commentCreateSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          body: "a".repeat(5001),
        })
      ).toThrow("Comment too long")
    })

    it("should accept body at minimum length", () => {
      const validComment = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        body: "a", // Exactly 1 character
      }

      expect(() => commentCreateSchema.parse(validComment)).not.toThrow()
    })

    it("should accept body at maximum length", () => {
      const validComment = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        body: "a".repeat(5000), // Exactly 5000 characters
      }

      expect(() => commentCreateSchema.parse(validComment)).not.toThrow()
    })

    it("should reject missing required fields", () => {
      expect(() => commentCreateSchema.parse({})).toThrow()

      expect(() =>
        commentCreateSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
        })
      ).toThrow() // Missing body

      expect(() =>
        commentCreateSchema.parse({
          body: "This is a comment",
        })
      ).toThrow() // Missing ruleId
    })

    it("should have correct TypeScript type", () => {
      const comment: CommentCreateInput = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        parentId: "clkv6tv5l0001l608w5i10wd8",
        body: "This is a comment",
      }

      expect(commentCreateSchema.parse(comment)).toEqual(comment)
    })
  })

  describe("commentListSchema", () => {
    it("should accept valid list request with all parameters", () => {
      const validRequest = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        cursor: "cursor-123",
        limit: 25,
        mode: "flat" as const,
      }

      const result = commentListSchema.parse(validRequest)
      expect(result).toEqual(validRequest)
    })

    it("should use default values", () => {
      const result = commentListSchema.parse({
        ruleId: "clkv6tv5l0001l608w5i10wd7",
      })

      expect(result).toEqual({
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        limit: 20, // Default
        mode: "tree", // Default
      })
    })

    it("should accept partial parameters", () => {
      const validRequest = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        limit: 10,
      }

      const result = commentListSchema.parse(validRequest)
      expect(result).toEqual({
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        limit: 10,
        mode: "tree", // Default
      })
    })

    it("should accept both mode values", () => {
      const flatMode = commentListSchema.parse({
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        mode: "flat",
      })
      expect(flatMode.mode).toBe("flat")

      const treeMode = commentListSchema.parse({
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        mode: "tree",
      })
      expect(treeMode.mode).toBe("tree")
    })

    it("should reject empty rule ID", () => {
      expect(() =>
        commentListSchema.parse({
          ruleId: "",
        })
      ).toThrow()
    })

    it("should reject invalid mode", () => {
      expect(() =>
        commentListSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          mode: "invalid",
        })
      ).toThrow()
    })

    it("should reject limit that's too small", () => {
      expect(() =>
        commentListSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          limit: 0,
        })
      ).toThrow()
    })

    it("should reject limit that's too large", () => {
      expect(() =>
        commentListSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          limit: 51,
        })
      ).toThrow()
    })

    it("should accept limit at boundaries", () => {
      expect(() =>
        commentListSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          limit: 1, // Minimum
        })
      ).not.toThrow()

      expect(() =>
        commentListSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          limit: 50, // Maximum
        })
      ).not.toThrow()
    })

    it("should reject missing rule ID", () => {
      expect(() => commentListSchema.parse({})).toThrow()
    })

    it("should have correct TypeScript type", () => {
      const request: CommentListInput = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        cursor: "cursor-123",
        limit: 25,
        mode: "flat",
      }

      expect(commentListSchema.parse(request)).toEqual(request)
    })
  })

  describe("commentEditSchema", () => {
    it("should accept valid comment edit", () => {
      const validEdit = {
        commentId: "clkv6tv5l0001l608w5i10wd7",
        body: "This is the updated comment",
      }

      const result = commentEditSchema.parse(validEdit)
      expect(result).toEqual(validEdit)
    })

    it("should reject empty comment ID", () => {
      expect(() =>
        commentEditSchema.parse({
          commentId: "",
          body: "Updated comment",
        })
      ).toThrow()
    })

    it("should reject empty body", () => {
      expect(() =>
        commentEditSchema.parse({
          commentId: "clkv6tv5l0001l608w5i10wd7",
          body: "",
        })
      ).toThrow("Comment cannot be empty")
    })

    it("should reject body that's too long", () => {
      expect(() =>
        commentEditSchema.parse({
          commentId: "clkv6tv5l0001l608w5i10wd7",
          body: "a".repeat(5001),
        })
      ).toThrow("Comment too long")
    })

    it("should accept body at minimum length", () => {
      const validEdit = {
        commentId: "clkv6tv5l0001l608w5i10wd7",
        body: "a", // Exactly 1 character
      }

      expect(() => commentEditSchema.parse(validEdit)).not.toThrow()
    })

    it("should accept body at maximum length", () => {
      const validEdit = {
        commentId: "clkv6tv5l0001l608w5i10wd7",
        body: "a".repeat(5000), // Exactly 5000 characters
      }

      expect(() => commentEditSchema.parse(validEdit)).not.toThrow()
    })

    it("should reject missing required fields", () => {
      expect(() => commentEditSchema.parse({})).toThrow()

      expect(() =>
        commentEditSchema.parse({
          commentId: "clkv6tv5l0001l608w5i10wd7",
        })
      ).toThrow() // Missing body

      expect(() =>
        commentEditSchema.parse({
          body: "Updated comment",
        })
      ).toThrow() // Missing commentId
    })

    it("should have correct TypeScript type", () => {
      const edit: CommentEditInput = {
        commentId: "clkv6tv5l0001l608w5i10wd7",
        body: "This is the updated comment",
      }

      expect(commentEditSchema.parse(edit)).toEqual(edit)
    })
  })

  describe("commentDeleteSchema", () => {
    it("should accept valid comment deletion", () => {
      const validDelete = {
        commentId: "clkv6tv5l0001l608w5i10wd7",
        reason: "Inappropriate content",
      }

      const result = commentDeleteSchema.parse(validDelete)
      expect(result).toEqual(validDelete)
    })

    it("should accept deletion without reason", () => {
      const validDelete = {
        commentId: "clkv6tv5l0001l608w5i10wd7",
      }

      const result = commentDeleteSchema.parse(validDelete)
      expect(result).toEqual(validDelete)
    })

    it("should reject empty comment ID", () => {
      expect(() =>
        commentDeleteSchema.parse({
          commentId: "",
        })
      ).toThrow()
    })

    it("should reject reason that's too long", () => {
      expect(() =>
        commentDeleteSchema.parse({
          commentId: "clkv6tv5l0001l608w5i10wd7",
          reason: "a".repeat(201),
        })
      ).toThrow("Reason too long")
    })

    it("should accept reason at maximum length", () => {
      const validDelete = {
        commentId: "clkv6tv5l0001l608w5i10wd7",
        reason: "a".repeat(200), // Exactly 200 characters
      }

      expect(() => commentDeleteSchema.parse(validDelete)).not.toThrow()
    })

    it("should accept empty reason", () => {
      const validDelete = {
        commentId: "clkv6tv5l0001l608w5i10wd7",
        reason: "",
      }

      expect(() => commentDeleteSchema.parse(validDelete)).not.toThrow()
    })

    it("should reject missing comment ID", () => {
      expect(() => commentDeleteSchema.parse({})).toThrow()
    })

    it("should have correct TypeScript type", () => {
      const deletion: CommentDeleteInput = {
        commentId: "clkv6tv5l0001l608w5i10wd7",
        reason: "Inappropriate content",
      }

      expect(commentDeleteSchema.parse(deletion)).toEqual(deletion)
    })
  })

  describe("commentDTOSchema", () => {
    it("should accept valid comment DTO", () => {
      const validDTO = {
        id: "clkv6tv5l0001l608w5i10wd7",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        parentId: "clkv6tv5l0001l608w5i10wd9",
        author: {
          id: "user-123",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: "https://example.com/avatar.jpg",
        },
        bodyHtml: "<p>This is a comment</p>",
        isDeleted: false,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:05:00Z"),
        edited: true,
        depth: 0,
        children: [],
        canEdit: true,
        canDelete: false,
      }

      const result = commentDTOSchema.parse(validDTO)
      expect(result).toEqual(validDTO)
    })

    it("should accept comment DTO with null values", () => {
      const validDTO = {
        id: "clkv6tv5l0001l608w5i10wd7",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        parentId: null, // Null for top-level comment
        author: {
          id: "user-123",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null, // No avatar
        },
        bodyHtml: null, // Deleted comment
        isDeleted: true,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
        edited: false,
        depth: 0,
      }

      const result = commentDTOSchema.parse(validDTO)
      expect(result).toEqual(validDTO)
    })

    it("should accept comment DTO without optional fields", () => {
      const validDTO = {
        id: "clkv6tv5l0001l608w5i10wd7",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        parentId: null,
        author: {
          id: "user-123",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
        },
        bodyHtml: "<p>This is a comment</p>",
        isDeleted: false,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
        edited: false,
        depth: 0,
        // Optional fields omitted: children, canEdit, canDelete
      }

      const result = commentDTOSchema.parse(validDTO)
      expect(result).toEqual(validDTO)
    })

    it("should accept nested comment structure", () => {
      const childComment = {
        id: "clkv6tv5l0001l608w5i10wd9",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        parentId: "clkv6tv5l0001l608w5i10wd7",
        author: {
          id: "user-456",
          handle: "janedoe",
          displayName: "Jane Doe",
          avatarUrl: null,
        },
        bodyHtml: "<p>This is a reply</p>",
        isDeleted: false,
        createdAt: new Date("2024-01-01T01:00:00Z"),
        updatedAt: new Date("2024-01-01T01:00:00Z"),
        edited: false,
        depth: 1,
      }

      const parentComment = {
        id: "clkv6tv5l0001l608w5i10wd7",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        parentId: null,
        author: {
          id: "user-123",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: "https://example.com/avatar.jpg",
        },
        bodyHtml: "<p>This is a parent comment</p>",
        isDeleted: false,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
        edited: false,
        depth: 0,
        children: [childComment],
      }

      const result = commentDTOSchema.parse(parentComment)
      expect(result).toEqual(parentComment)
    })

    it("should accept deeply nested comment structure", () => {
      const deepChild = {
        id: "clkv6tv5l0001l608w5i10wda",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        parentId: "clkv6tv5l0001l608w5i10wd9",
        author: {
          id: "user-789",
          handle: "bobsmith",
          displayName: "Bob Smith",
          avatarUrl: null,
        },
        bodyHtml: "<p>Deep reply</p>",
        isDeleted: false,
        createdAt: new Date("2024-01-01T02:00:00Z"),
        updatedAt: new Date("2024-01-01T02:00:00Z"),
        edited: false,
        depth: 2,
      }

      const middleChild = {
        id: "clkv6tv5l0001l608w5i10wd9",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        parentId: "clkv6tv5l0001l608w5i10wd7",
        author: {
          id: "user-456",
          handle: "janedoe",
          displayName: "Jane Doe",
          avatarUrl: null,
        },
        bodyHtml: "<p>Middle reply</p>",
        isDeleted: false,
        createdAt: new Date("2024-01-01T01:00:00Z"),
        updatedAt: new Date("2024-01-01T01:00:00Z"),
        edited: false,
        depth: 1,
        children: [deepChild],
      }

      const parentComment = {
        id: "clkv6tv5l0001l608w5i10wd7",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        parentId: null,
        author: {
          id: "user-123",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: "https://example.com/avatar.jpg",
        },
        bodyHtml: "<p>Parent comment</p>",
        isDeleted: false,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
        edited: false,
        depth: 0,
        children: [middleChild],
      }

      const result = commentDTOSchema.parse(parentComment)
      expect(result).toEqual(parentComment)
    })

    it("should reject invalid depth", () => {
      expect(() =>
        commentDTOSchema.parse({
          id: "clkv6tv5l0001l608w5i10wd7",
          ruleId: "clkv6tv5l0001l608w5i10wd8",
          parentId: null,
          author: {
            id: "user-123",
            handle: "johndoe",
            displayName: "John Doe",
            avatarUrl: null,
          },
          bodyHtml: "<p>Comment</p>",
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          edited: false,
          depth: -1, // Invalid negative depth
        })
      ).toThrow()
    })

    it("should reject missing required fields", () => {
      expect(() => commentDTOSchema.parse({})).toThrow()

      expect(() =>
        commentDTOSchema.parse({
          id: "clkv6tv5l0001l608w5i10wd7",
          // Missing other required fields
        })
      ).toThrow()
    })

    it("should reject invalid author structure", () => {
      expect(() =>
        commentDTOSchema.parse({
          id: "clkv6tv5l0001l608w5i10wd7",
          ruleId: "clkv6tv5l0001l608w5i10wd8",
          parentId: null,
          author: {
            id: "user-123",
            // Missing handle, displayName
          },
          bodyHtml: "<p>Comment</p>",
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          edited: false,
          depth: 0,
        })
      ).toThrow()
    })

    it("should have correct TypeScript type", () => {
      const dto: CommentDTO = {
        id: "clkv6tv5l0001l608w5i10wd7",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        parentId: null,
        author: {
          id: "user-123",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: "https://example.com/avatar.jpg",
        },
        bodyHtml: "<p>This is a comment</p>",
        isDeleted: false,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:05:00Z"),
        edited: true,
        depth: 0,
        children: [],
        canEdit: true,
        canDelete: false,
      }

      expect(commentDTOSchema.parse(dto)).toEqual(dto)
    })
  })

  describe("commentListResponseSchema", () => {
    it("should accept valid comment list response", () => {
      const validResponse = {
        items: [
          {
            id: "clkv6tv5l0001l608w5i10wd7",
            ruleId: "clkv6tv5l0001l608w5i10wd8",
            parentId: null,
            author: {
              id: "user-123",
              handle: "johndoe",
              displayName: "John Doe",
              avatarUrl: "https://example.com/avatar.jpg",
            },
            bodyHtml: "<p>First comment</p>",
            isDeleted: false,
            createdAt: new Date("2024-01-01T00:00:00Z"),
            updatedAt: new Date("2024-01-01T00:00:00Z"),
            edited: false,
            depth: 0,
          },
          {
            id: "clkv6tv5l0001l608w5i10wd9",
            ruleId: "clkv6tv5l0001l608w5i10wd8",
            parentId: null,
            author: {
              id: "user-456",
              handle: "janedoe",
              displayName: "Jane Doe",
              avatarUrl: null,
            },
            bodyHtml: "<p>Second comment</p>",
            isDeleted: false,
            createdAt: new Date("2024-01-01T01:00:00Z"),
            updatedAt: new Date("2024-01-01T01:00:00Z"),
            edited: false,
            depth: 0,
          },
        ],
        nextCursor: "cursor-next",
        hasMore: true,
        totalCount: 50,
      }

      const result = commentListResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept response without nextCursor", () => {
      const validResponse = {
        items: [
          {
            id: "clkv6tv5l0001l608w5i10wd7",
            ruleId: "clkv6tv5l0001l608w5i10wd8",
            parentId: null,
            author: {
              id: "user-123",
              handle: "johndoe",
              displayName: "John Doe",
              avatarUrl: null,
            },
            bodyHtml: "<p>Only comment</p>",
            isDeleted: false,
            createdAt: new Date("2024-01-01T00:00:00Z"),
            updatedAt: new Date("2024-01-01T00:00:00Z"),
            edited: false,
            depth: 0,
          },
        ],
        hasMore: false,
        totalCount: 1,
      }

      const result = commentListResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept empty items array", () => {
      const validResponse = {
        items: [],
        hasMore: false,
        totalCount: 0,
      }

      const result = commentListResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept response with nested comments", () => {
      const validResponse = {
        items: [
          {
            id: "clkv6tv5l0001l608w5i10wd7",
            ruleId: "clkv6tv5l0001l608w5i10wd8",
            parentId: null,
            author: {
              id: "user-123",
              handle: "johndoe",
              displayName: "John Doe",
              avatarUrl: "https://example.com/avatar.jpg",
            },
            bodyHtml: "<p>Parent comment</p>",
            isDeleted: false,
            createdAt: new Date("2024-01-01T00:00:00Z"),
            updatedAt: new Date("2024-01-01T00:00:00Z"),
            edited: false,
            depth: 0,
            children: [
              {
                id: "clkv6tv5l0001l608w5i10wd9",
                ruleId: "clkv6tv5l0001l608w5i10wd8",
                parentId: "clkv6tv5l0001l608w5i10wd7",
                author: {
                  id: "user-456",
                  handle: "janedoe",
                  displayName: "Jane Doe",
                  avatarUrl: null,
                },
                bodyHtml: "<p>Child comment</p>",
                isDeleted: false,
                createdAt: new Date("2024-01-01T01:00:00Z"),
                updatedAt: new Date("2024-01-01T01:00:00Z"),
                edited: false,
                depth: 1,
              },
            ],
          },
        ],
        hasMore: false,
        totalCount: 2,
      }

      const result = commentListResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should reject invalid items", () => {
      expect(() =>
        commentListResponseSchema.parse({
          items: [
            {
              id: "invalid-comment", // Missing required fields
            },
          ],
          hasMore: false,
          totalCount: 1,
        })
      ).toThrow()
    })

    it("should reject missing required fields", () => {
      expect(() => commentListResponseSchema.parse({})).toThrow()

      expect(() =>
        commentListResponseSchema.parse({
          items: [],
          // Missing hasMore and totalCount
        })
      ).toThrow()
    })

    it("should have correct TypeScript type", () => {
      const response: CommentListResponse = {
        items: [
          {
            id: "clkv6tv5l0001l608w5i10wd7",
            ruleId: "clkv6tv5l0001l608w5i10wd8",
            parentId: null,
            author: {
              id: "user-123",
              handle: "johndoe",
              displayName: "John Doe",
              avatarUrl: "https://example.com/avatar.jpg",
            },
            bodyHtml: "<p>Comment</p>",
            isDeleted: false,
            createdAt: new Date("2024-01-01T00:00:00Z"),
            updatedAt: new Date("2024-01-01T00:00:00Z"),
            edited: false,
            depth: 0,
          },
        ],
        nextCursor: "cursor-next",
        hasMore: true,
        totalCount: 25,
      }

      expect(commentListResponseSchema.parse(response)).toEqual(response)
    })
  })

  describe("Schema Integration", () => {
    it("should work with complete comment workflow", () => {
      // Create a comment
      const createInput = commentCreateSchema.parse({
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        body: "This is a great rule!",
      })

      // List comments
      const listInput = commentListSchema.parse({
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        limit: 10,
        mode: "tree",
      })

      // Edit the comment
      const editInput = commentEditSchema.parse({
        commentId: "clkv6tv5l0001l608w5i10wd8",
        body: "This is an updated comment!",
      })

      // Delete the comment
      const deleteInput = commentDeleteSchema.parse({
        commentId: "clkv6tv5l0001l608w5i10wd8",
        reason: "User requested deletion",
      })

      expect(createInput.ruleId).toBe("clkv6tv5l0001l608w5i10wd7")
      expect(listInput.mode).toBe("tree")
      expect(editInput.body).toBe("This is an updated comment!")
      expect(deleteInput.reason).toBe("User requested deletion")
    })

    it("should handle edge cases consistently", () => {
      // Test boundary conditions across schemas
      const minBody = "a" // 1 character
      const maxBody = "a".repeat(5000) // 5000 characters
      const maxReason = "a".repeat(200) // 200 characters

      expect(() =>
        commentCreateSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          body: minBody,
        })
      ).not.toThrow()

      expect(() =>
        commentCreateSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          body: maxBody,
        })
      ).not.toThrow()

      expect(() =>
        commentEditSchema.parse({
          commentId: "clkv6tv5l0001l608w5i10wd7",
          body: maxBody,
        })
      ).not.toThrow()

      expect(() =>
        commentDeleteSchema.parse({
          commentId: "clkv6tv5l0001l608w5i10wd7",
          reason: maxReason,
        })
      ).not.toThrow()
    })

    it("should validate ID consistency", () => {
      const validId = "clkv6tv5l0001l608w5i10wd7"

      // All schemas should accept the same valid ID format (any non-empty string)
      expect(() =>
        commentCreateSchema.parse({
          ruleId: validId,
          body: "Comment",
        })
      ).not.toThrow()

      expect(() =>
        commentCreateSchema.parse({
          ruleId: validId,
          parentId: validId,
          body: "Reply",
        })
      ).not.toThrow()

      expect(() =>
        commentListSchema.parse({
          ruleId: validId,
        })
      ).not.toThrow()

      expect(() =>
        commentEditSchema.parse({
          commentId: validId,
          body: "Updated",
        })
      ).not.toThrow()

      expect(() =>
        commentDeleteSchema.parse({
          commentId: validId,
        })
      ).not.toThrow()

      // Should also accept other valid non-empty strings
      const simpleId = "simple-id"
      expect(() =>
        commentCreateSchema.parse({
          ruleId: simpleId,
          body: "Comment",
        })
      ).not.toThrow()
    })

    it("should handle comment threading correctly", () => {
      // Test that parent-child relationships work correctly
      const parentId = "clkv6tv5l0001l608w5i10wd7"
      const childId = "clkv6tv5l0001l608w5i10wd8"
      const ruleId = "clkv6tv5l0001l608w5i10wd9"

      // Create parent comment
      const parentCreate = commentCreateSchema.parse({
        ruleId,
        body: "Parent comment",
      })

      // Create child comment
      const childCreate = commentCreateSchema.parse({
        ruleId,
        parentId,
        body: "Child comment",
      })

      // Verify DTO structure supports threading
      const threadedComment = commentDTOSchema.parse({
        id: parentId,
        ruleId,
        parentId: null,
        author: {
          id: "user-123",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
        },
        bodyHtml: "<p>Parent comment</p>",
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        edited: false,
        depth: 0,
        children: [
          {
            id: childId,
            ruleId,
            parentId,
            author: {
              id: "user-456",
              handle: "janedoe",
              displayName: "Jane Doe",
              avatarUrl: null,
            },
            bodyHtml: "<p>Child comment</p>",
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            edited: false,
            depth: 1,
          },
        ],
      })

      expect(parentCreate.body).toBe("Parent comment")
      expect(childCreate.parentId).toBe(parentId)
      expect(threadedComment.children).toHaveLength(1)
      expect(threadedComment.children![0].depth).toBe(1)
    })

    it("should handle deleted comments appropriately", () => {
      // Test deleted comment representation
      const deletedComment = commentDTOSchema.parse({
        id: "clkv6tv5l0001l608w5i10wd7",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        parentId: null,
        author: {
          id: "user-123",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
        },
        bodyHtml: null, // Deleted content
        isDeleted: true,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:05:00Z"),
        edited: false,
        depth: 0,
      })

      expect(deletedComment.isDeleted).toBe(true)
      expect(deletedComment.bodyHtml).toBeNull()
    })

    it("should handle comment permissions correctly", () => {
      // Test permission flags in DTO
      const commentWithPermissions = commentDTOSchema.parse({
        id: "clkv6tv5l0001l608w5i10wd7",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        parentId: null,
        author: {
          id: "user-123",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
        },
        bodyHtml: "<p>Comment</p>",
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        edited: false,
        depth: 0,
        canEdit: true,
        canDelete: false,
      })

      expect(commentWithPermissions.canEdit).toBe(true)
      expect(commentWithPermissions.canDelete).toBe(false)
    })
  })
})
