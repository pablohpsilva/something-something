import { describe, it, expect } from "vitest"
import {
  toggleFollowInputSchema,
  toggleWatchInputSchema,
  listFollowersInputSchema,
  listFollowingInputSchema,
  notificationsListInputSchema,
  markReadInputSchema,
  markManyReadInputSchema,
  deleteNotificationInputSchema,
  followResponseSchema,
  watchResponseSchema,
  followersListResponseSchema,
  followingListResponseSchema,
  notificationsListResponseSchema,
  unreadCountResponseSchema,
  markReadResponseSchema,
  markManyReadResponseSchema,
  deleteNotificationResponseSchema,
  type ToggleFollowInput,
  type ToggleWatchInput,
  type ListFollowersInput,
  type ListFollowingInput,
  type NotificationsListInput,
  type MarkReadInput,
  type MarkManyReadInput,
  type DeleteNotificationInput,
  type FollowResponse,
  type WatchResponse,
  type FollowersListResponse,
  type FollowingListResponse,
  type NotificationsListResponse,
  type UnreadCountResponse,
  type MarkReadResponse,
  type MarkManyReadResponse,
  type DeleteNotificationResponse,
} from "./social"

describe("Social Schemas", () => {
  describe("toggleFollowInputSchema", () => {
    it("should accept valid CUID", () => {
      const validInput = {
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
      }

      const result = toggleFollowInputSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept any non-empty string (cuidOrUuidSchema)", () => {
      const validInput = {
        authorUserId: "any-non-empty-string",
      }

      expect(() => toggleFollowInputSchema.parse(validInput)).not.toThrow()
    })

    it("should reject empty authorUserId", () => {
      const emptyInput = {
        authorUserId: "",
      }

      expect(() => toggleFollowInputSchema.parse(emptyInput)).toThrow()
    })

    it("should require authorUserId", () => {
      const inputWithoutAuthorUserId = {}

      expect(() => toggleFollowInputSchema.parse(inputWithoutAuthorUserId)).toThrow()
    })
  })

  describe("toggleWatchInputSchema", () => {
    it("should accept valid CUID", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
      }

      const result = toggleWatchInputSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept any non-empty string (cuidOrUuidSchema)", () => {
      const validInput = {
        ruleId: "any-non-empty-string",
      }

      expect(() => toggleWatchInputSchema.parse(validInput)).not.toThrow()
    })

    it("should reject empty ruleId", () => {
      const emptyInput = {
        ruleId: "",
      }

      expect(() => toggleWatchInputSchema.parse(emptyInput)).toThrow()
    })

    it("should require ruleId", () => {
      const inputWithoutRuleId = {}

      expect(() => toggleWatchInputSchema.parse(inputWithoutRuleId)).toThrow()
    })
  })

  describe("listFollowersInputSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
        cursor: "cursor-string-123",
        limit: 50,
      }

      const result = listFollowersInputSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept minimal input with defaults", () => {
      const minimalInput = {
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
      }

      const result = listFollowersInputSchema.parse(minimalInput)
      expect(result).toEqual({
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
        limit: 20, // default value
      })
    })

    it("should accept input without cursor", () => {
      const inputWithoutCursor = {
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
        limit: 10,
      }

      expect(() => listFollowersInputSchema.parse(inputWithoutCursor)).not.toThrow()
    })

    it("should validate limit constraints", () => {
      // Test minimum limit
      const minLimitInput = {
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
        limit: 1,
      }
      expect(() => listFollowersInputSchema.parse(minLimitInput)).not.toThrow()

      // Test maximum limit
      const maxLimitInput = {
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
        limit: 100,
      }
      expect(() => listFollowersInputSchema.parse(maxLimitInput)).not.toThrow()

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
        limit: 0,
      }
      expect(() => listFollowersInputSchema.parse(invalidMinInput)).toThrow()

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
        limit: 101,
      }
      expect(() => listFollowersInputSchema.parse(invalidMaxInput)).toThrow()
    })

    it("should validate integer limit", () => {
      const invalidIntegerInput = {
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
        limit: 25.5, // Should be integer
      }

      expect(() => listFollowersInputSchema.parse(invalidIntegerInput)).toThrow()
    })

    it("should reject empty authorUserId", () => {
      const emptyAuthorInput = {
        authorUserId: "",
        limit: 20,
      }

      expect(() => listFollowersInputSchema.parse(emptyAuthorInput)).toThrow()
    })

    it("should require authorUserId", () => {
      const inputWithoutAuthor = {
        limit: 20,
      }

      expect(() => listFollowersInputSchema.parse(inputWithoutAuthor)).toThrow()
    })
  })

  describe("listFollowingInputSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        userId: "clkv6q4a40000356h2g8h2g8h",
        cursor: "cursor-string-456",
        limit: 75,
      }

      const result = listFollowingInputSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept minimal input with defaults", () => {
      const minimalInput = {
        userId: "clkv6q4a40000356h2g8h2g8h",
      }

      const result = listFollowingInputSchema.parse(minimalInput)
      expect(result).toEqual({
        userId: "clkv6q4a40000356h2g8h2g8h",
        limit: 20, // default value
      })
    })

    it("should accept input without cursor", () => {
      const inputWithoutCursor = {
        userId: "clkv6q4a40000356h2g8h2g8h",
        limit: 15,
      }

      expect(() => listFollowingInputSchema.parse(inputWithoutCursor)).not.toThrow()
    })

    it("should validate limit constraints", () => {
      // Test minimum limit
      const minLimitInput = {
        userId: "clkv6q4a40000356h2g8h2g8h",
        limit: 1,
      }
      expect(() => listFollowingInputSchema.parse(minLimitInput)).not.toThrow()

      // Test maximum limit
      const maxLimitInput = {
        userId: "clkv6q4a40000356h2g8h2g8h",
        limit: 100,
      }
      expect(() => listFollowingInputSchema.parse(maxLimitInput)).not.toThrow()

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        userId: "clkv6q4a40000356h2g8h2g8h",
        limit: 0,
      }
      expect(() => listFollowingInputSchema.parse(invalidMinInput)).toThrow()

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        userId: "clkv6q4a40000356h2g8h2g8h",
        limit: 101,
      }
      expect(() => listFollowingInputSchema.parse(invalidMaxInput)).toThrow()
    })

    it("should validate integer limit", () => {
      const invalidIntegerInput = {
        userId: "clkv6q4a40000356h2g8h2g8h",
        limit: 30.7, // Should be integer
      }

      expect(() => listFollowingInputSchema.parse(invalidIntegerInput)).toThrow()
    })

    it("should reject empty userId", () => {
      const emptyUserInput = {
        userId: "",
        limit: 20,
      }

      expect(() => listFollowingInputSchema.parse(emptyUserInput)).toThrow()
    })

    it("should require userId", () => {
      const inputWithoutUser = {
        limit: 20,
      }

      expect(() => listFollowingInputSchema.parse(inputWithoutUser)).toThrow()
    })
  })

  describe("notificationsListInputSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        cursor: "notification-cursor-789",
        limit: 50,
        filter: "unread" as const,
      }

      const result = notificationsListInputSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept minimal input with defaults", () => {
      const minimalInput = {}

      const result = notificationsListInputSchema.parse(minimalInput)
      expect(result).toEqual({
        limit: 30, // default value
        filter: "all", // default value
      })
    })

    it("should accept input without cursor", () => {
      const inputWithoutCursor = {
        limit: 25,
        filter: "all" as const,
      }

      expect(() => notificationsListInputSchema.parse(inputWithoutCursor)).not.toThrow()
    })

    it("should validate limit constraints", () => {
      // Test minimum limit
      const minLimitInput = {
        limit: 1,
      }
      expect(() => notificationsListInputSchema.parse(minLimitInput)).not.toThrow()

      // Test maximum limit
      const maxLimitInput = {
        limit: 100,
      }
      expect(() => notificationsListInputSchema.parse(maxLimitInput)).not.toThrow()

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        limit: 0,
      }
      expect(() => notificationsListInputSchema.parse(invalidMinInput)).toThrow()

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        limit: 101,
      }
      expect(() => notificationsListInputSchema.parse(invalidMaxInput)).toThrow()
    })

    it("should validate integer limit", () => {
      const invalidIntegerInput = {
        limit: 45.3, // Should be integer
      }

      expect(() => notificationsListInputSchema.parse(invalidIntegerInput)).toThrow()
    })

    it("should accept all valid filter values", () => {
      const filterValues = ["all", "unread"] as const

      filterValues.forEach(filter => {
        const input = { filter }
        expect(() => notificationsListInputSchema.parse(input)).not.toThrow()
      })
    })

    it("should use default filter value", () => {
      const input = {}

      const result = notificationsListInputSchema.parse(input)
      expect(result.filter).toBe("all")
    })

    it("should reject invalid filter", () => {
      const invalidFilterInput = {
        filter: "invalid_filter",
      }

      expect(() => notificationsListInputSchema.parse(invalidFilterInput)).toThrow()
    })
  })

  describe("markReadInputSchema", () => {
    it("should accept valid CUID", () => {
      const validInput = {
        id: "clkv6q4a40000356h2g8h2g8h",
      }

      const result = markReadInputSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept any non-empty string (cuidOrUuidSchema)", () => {
      const validInput = {
        id: "notification-id-123",
      }

      expect(() => markReadInputSchema.parse(validInput)).not.toThrow()
    })

    it("should reject empty id", () => {
      const emptyInput = {
        id: "",
      }

      expect(() => markReadInputSchema.parse(emptyInput)).toThrow()
    })

    it("should require id", () => {
      const inputWithoutId = {}

      expect(() => markReadInputSchema.parse(inputWithoutId)).toThrow()
    })
  })

  describe("markManyReadInputSchema", () => {
    it("should accept valid array of IDs", () => {
      const validInput = {
        ids: [
          "clkv6q4a40000356h2g8h2g8h",
          "clkv6q4a40000356h2g8h2g8i",
          "clkv6q4a40000356h2g8h2g8j",
        ],
      }

      const result = markManyReadInputSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept single ID in array", () => {
      const singleIdInput = {
        ids: ["clkv6q4a40000356h2g8h2g8h"],
      }

      expect(() => markManyReadInputSchema.parse(singleIdInput)).not.toThrow()
    })

    it("should accept maximum number of IDs", () => {
      const maxIdsInput = {
        ids: Array(200).fill("clkv6q4a40000356h2g8h2g8h"), // Exactly 200 IDs
      }

      expect(() => markManyReadInputSchema.parse(maxIdsInput)).not.toThrow()
    })

    it("should reject empty array", () => {
      const emptyArrayInput = {
        ids: [],
      }

      expect(() => markManyReadInputSchema.parse(emptyArrayInput)).toThrow()
    })

    it("should reject too many IDs", () => {
      const tooManyIdsInput = {
        ids: Array(201).fill("clkv6q4a40000356h2g8h2g8h"), // Exceeds 200 ID limit
      }

      expect(() => markManyReadInputSchema.parse(tooManyIdsInput)).toThrow()
    })

    it("should reject array with empty string IDs", () => {
      const emptyStringIdInput = {
        ids: ["clkv6q4a40000356h2g8h2g8h", "", "clkv6q4a40000356h2g8h2g8i"],
      }

      expect(() => markManyReadInputSchema.parse(emptyStringIdInput)).toThrow()
    })

    it("should require ids field", () => {
      const inputWithoutIds = {}

      expect(() => markManyReadInputSchema.parse(inputWithoutIds)).toThrow()
    })
  })

  describe("deleteNotificationInputSchema", () => {
    it("should accept valid CUID", () => {
      const validInput = {
        id: "clkv6q4a40000356h2g8h2g8h",
      }

      const result = deleteNotificationInputSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept any non-empty string (cuidOrUuidSchema)", () => {
      const validInput = {
        id: "notification-to-delete-456",
      }

      expect(() => deleteNotificationInputSchema.parse(validInput)).not.toThrow()
    })

    it("should reject empty id", () => {
      const emptyInput = {
        id: "",
      }

      expect(() => deleteNotificationInputSchema.parse(emptyInput)).toThrow()
    })

    it("should require id", () => {
      const inputWithoutId = {}

      expect(() => deleteNotificationInputSchema.parse(inputWithoutId)).toThrow()
    })
  })

  describe("followResponseSchema", () => {
    it("should accept valid follow response", () => {
      const validResponse = {
        following: true,
        followersCount: 150,
        followingCount: 75,
      }

      const result = followResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept response with false following", () => {
      const unfollowResponse = {
        following: false,
        followersCount: 149,
        followingCount: 74,
      }

      expect(() => followResponseSchema.parse(unfollowResponse)).not.toThrow()
    })

    it("should accept zero counts", () => {
      const zeroCountsResponse = {
        following: true,
        followersCount: 0,
        followingCount: 0,
      }

      expect(() => followResponseSchema.parse(zeroCountsResponse)).not.toThrow()
    })

    it("should validate integer counts", () => {
      const invalidFollowersCountResponse = {
        following: true,
        followersCount: 25.5, // Should be integer
        followingCount: 10,
      }

      expect(() => followResponseSchema.parse(invalidFollowersCountResponse)).toThrow()

      const invalidFollowingCountResponse = {
        following: true,
        followersCount: 25,
        followingCount: 10.7, // Should be integer
      }

      expect(() => followResponseSchema.parse(invalidFollowingCountResponse)).toThrow()
    })

    it("should require all fields", () => {
      const requiredFields = ["following", "followersCount", "followingCount"]

      requiredFields.forEach(field => {
        const invalidResponse = {
          following: true,
          followersCount: 10,
          followingCount: 5,
        }
        delete (invalidResponse as any)[field]

        expect(() => followResponseSchema.parse(invalidResponse)).toThrow()
      })
    })
  })

  describe("watchResponseSchema", () => {
    it("should accept valid watch response", () => {
      const validResponse = {
        watching: true,
        watchersCount: 42,
      }

      const result = watchResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept response with false watching", () => {
      const unwatchResponse = {
        watching: false,
        watchersCount: 41,
      }

      expect(() => watchResponseSchema.parse(unwatchResponse)).not.toThrow()
    })

    it("should accept zero watchers count", () => {
      const zeroWatchersResponse = {
        watching: true,
        watchersCount: 0,
      }

      expect(() => watchResponseSchema.parse(zeroWatchersResponse)).not.toThrow()
    })

    it("should validate integer watchers count", () => {
      const invalidWatchersCountResponse = {
        watching: true,
        watchersCount: 15.3, // Should be integer
      }

      expect(() => watchResponseSchema.parse(invalidWatchersCountResponse)).toThrow()
    })

    it("should require all fields", () => {
      const requiredFields = ["watching", "watchersCount"]

      requiredFields.forEach(field => {
        const invalidResponse = {
          watching: true,
          watchersCount: 20,
        }
        delete (invalidResponse as any)[field]

        expect(() => watchResponseSchema.parse(invalidResponse)).toThrow()
      })
    })
  })

  describe("followersListResponseSchema", () => {
    it("should accept valid followers list response", () => {
      const validResponse = {
        items: [
          {
            id: "follower1",
            handle: "john-doe",
            displayName: "John Doe",
            avatarUrl: "https://example.com/avatar1.jpg",
            isVerified: true,
            followedAt: new Date("2024-01-15T10:00:00Z"),
          },
          {
            id: "follower2",
            handle: "jane-smith",
            displayName: "Jane Smith",
            avatarUrl: null,
            isVerified: false,
            followedAt: new Date("2024-01-20T15:30:00Z"),
          },
        ],
        nextCursor: "cursor-next-123",
        hasMore: true,
        totalCount: 150,
      }

      const result = followersListResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept empty followers list", () => {
      const emptyResponse = {
        items: [],
        hasMore: false,
        totalCount: 0,
      }

      expect(() => followersListResponseSchema.parse(emptyResponse)).not.toThrow()
    })

    it("should accept response without nextCursor", () => {
      const responseWithoutCursor = {
        items: [
          {
            id: "follower1",
            handle: "test-user",
            displayName: "Test User",
            avatarUrl: null,
            followedAt: new Date("2024-01-01T00:00:00Z"),
          },
        ],
        hasMore: false,
        totalCount: 1,
      }

      expect(() => followersListResponseSchema.parse(responseWithoutCursor)).not.toThrow()
    })

    it("should accept followers without isVerified field", () => {
      const responseWithoutVerified = {
        items: [
          {
            id: "follower1",
            handle: "test-user",
            displayName: "Test User",
            avatarUrl: null,
            followedAt: new Date("2024-01-01T00:00:00Z"),
            // isVerified is optional
          },
        ],
        hasMore: false,
        totalCount: 1,
      }

      expect(() => followersListResponseSchema.parse(responseWithoutVerified)).not.toThrow()
    })

    it("should accept null avatarUrl", () => {
      const responseWithNullAvatar = {
        items: [
          {
            id: "follower1",
            handle: "test-user",
            displayName: "Test User",
            avatarUrl: null, // nullable
            isVerified: false,
            followedAt: new Date("2024-01-01T00:00:00Z"),
          },
        ],
        hasMore: false,
        totalCount: 1,
      }

      expect(() => followersListResponseSchema.parse(responseWithNullAvatar)).not.toThrow()
    })

    it("should validate integer totalCount", () => {
      const invalidTotalCountResponse = {
        items: [],
        hasMore: false,
        totalCount: 25.5, // Should be integer
      }

      expect(() => followersListResponseSchema.parse(invalidTotalCountResponse)).toThrow()
    })

    it("should require all main fields", () => {
      const requiredFields = ["items", "hasMore", "totalCount"]

      requiredFields.forEach(field => {
        const invalidResponse = {
          items: [],
          hasMore: false,
          totalCount: 0,
        }
        delete (invalidResponse as any)[field]

        expect(() => followersListResponseSchema.parse(invalidResponse)).toThrow()
      })
    })

    it("should require all item fields except optional ones", () => {
      const requiredItemFields = ["id", "handle", "displayName", "followedAt"]

      requiredItemFields.forEach(field => {
        const invalidResponse = {
          items: [
            {
              id: "follower1",
              handle: "test-user",
              displayName: "Test User",
              avatarUrl: null,
              followedAt: new Date(),
            },
          ],
          hasMore: false,
          totalCount: 1,
        }
        delete (invalidResponse.items[0] as any)[field]

        expect(() => followersListResponseSchema.parse(invalidResponse)).toThrow()
      })
    })
  })

  describe("followingListResponseSchema", () => {
    it("should accept valid following list response", () => {
      const validResponse = {
        items: [
          {
            id: "following1",
            handle: "alice-wonder",
            displayName: "Alice Wonder",
            avatarUrl: "https://example.com/alice.jpg",
            isVerified: true,
            followedAt: new Date("2024-02-01T12:00:00Z"),
          },
          {
            id: "following2",
            handle: "bob-builder",
            displayName: "Bob Builder",
            avatarUrl: null,
            isVerified: false,
            followedAt: new Date("2024-02-05T08:30:00Z"),
          },
        ],
        nextCursor: "cursor-following-456",
        hasMore: true,
        totalCount: 75,
      }

      const result = followingListResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept empty following list", () => {
      const emptyResponse = {
        items: [],
        hasMore: false,
        totalCount: 0,
      }

      expect(() => followingListResponseSchema.parse(emptyResponse)).not.toThrow()
    })

    it("should accept response without nextCursor", () => {
      const responseWithoutCursor = {
        items: [
          {
            id: "following1",
            handle: "test-following",
            displayName: "Test Following",
            avatarUrl: null,
            followedAt: new Date("2024-01-01T00:00:00Z"),
          },
        ],
        hasMore: false,
        totalCount: 1,
      }

      expect(() => followingListResponseSchema.parse(responseWithoutCursor)).not.toThrow()
    })

    it("should accept following without isVerified field", () => {
      const responseWithoutVerified = {
        items: [
          {
            id: "following1",
            handle: "test-following",
            displayName: "Test Following",
            avatarUrl: null,
            followedAt: new Date("2024-01-01T00:00:00Z"),
            // isVerified is optional
          },
        ],
        hasMore: false,
        totalCount: 1,
      }

      expect(() => followingListResponseSchema.parse(responseWithoutVerified)).not.toThrow()
    })

    it("should accept null avatarUrl", () => {
      const responseWithNullAvatar = {
        items: [
          {
            id: "following1",
            handle: "test-following",
            displayName: "Test Following",
            avatarUrl: null, // nullable
            isVerified: false,
            followedAt: new Date("2024-01-01T00:00:00Z"),
          },
        ],
        hasMore: false,
        totalCount: 1,
      }

      expect(() => followingListResponseSchema.parse(responseWithNullAvatar)).not.toThrow()
    })

    it("should validate integer totalCount", () => {
      const invalidTotalCountResponse = {
        items: [],
        hasMore: false,
        totalCount: 30.7, // Should be integer
      }

      expect(() => followingListResponseSchema.parse(invalidTotalCountResponse)).toThrow()
    })

    it("should require all main fields", () => {
      const requiredFields = ["items", "hasMore", "totalCount"]

      requiredFields.forEach(field => {
        const invalidResponse = {
          items: [],
          hasMore: false,
          totalCount: 0,
        }
        delete (invalidResponse as any)[field]

        expect(() => followingListResponseSchema.parse(invalidResponse)).toThrow()
      })
    })

    it("should require all item fields except optional ones", () => {
      const requiredItemFields = ["id", "handle", "displayName", "followedAt"]

      requiredItemFields.forEach(field => {
        const invalidResponse = {
          items: [
            {
              id: "following1",
              handle: "test-following",
              displayName: "Test Following",
              avatarUrl: null,
              followedAt: new Date(),
            },
          ],
          hasMore: false,
          totalCount: 1,
        }
        delete (invalidResponse.items[0] as any)[field]

        expect(() => followingListResponseSchema.parse(invalidResponse)).toThrow()
      })
    })
  })

  describe("notificationsListResponseSchema", () => {
    it("should accept valid notifications list response", () => {
      const validResponse = {
        items: [
          {
            id: "notification1",
            type: "NEW_VERSION" as const,
            payload: {
              ruleId: "rule123",
              versionNumber: 2,
            },
            readAt: new Date("2024-01-16T10:00:00Z"),
            createdAt: new Date("2024-01-15T10:00:00Z"),
            title: "New Version Available",
            message: "A new version of your rule has been published",
            actionUrl: "/rules/rule123",
            actor: {
              id: "actor1",
              handle: "rule-author",
              displayName: "Rule Author",
              avatarUrl: "https://example.com/actor.jpg",
            },
          },
          {
            id: "notification2",
            type: "COMMENT_REPLY" as const,
            payload: {
              commentId: "comment456",
              replyId: "reply789",
            },
            readAt: null, // unread
            createdAt: new Date("2024-01-20T15:30:00Z"),
            title: "New Reply",
            message: "Someone replied to your comment",
            actionUrl: "/rules/rule123#comment456",
            actor: {
              id: "actor2",
              handle: "commenter",
              displayName: "Commenter",
              avatarUrl: null,
            },
          },
        ],
        nextCursor: "notification-cursor-789",
        hasMore: true,
        totalCount: 25,
        unreadCount: 5,
      }

      const result = notificationsListResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept all valid notification types", () => {
      const notificationTypes = [
        "NEW_VERSION",
        "COMMENT_REPLY",
        "AUTHOR_PUBLISHED",
        "CLAIM_VERDICT",
        "DONATION_RECEIVED",
      ] as const

      notificationTypes.forEach(type => {
        const response = {
          items: [
            {
              id: "notification1",
              type,
              payload: {},
              readAt: null,
              createdAt: new Date(),
            },
          ],
          hasMore: false,
          totalCount: 1,
          unreadCount: 1,
        }

        expect(() => notificationsListResponseSchema.parse(response)).not.toThrow()
      })
    })

    it("should reject invalid notification type", () => {
      const invalidTypeResponse = {
        items: [
          {
            id: "notification1",
            type: "INVALID_TYPE",
            payload: {},
            readAt: null,
            createdAt: new Date(),
          },
        ],
        hasMore: false,
        totalCount: 1,
        unreadCount: 1,
      }

      expect(() => notificationsListResponseSchema.parse(invalidTypeResponse)).toThrow()
    })

    it("should accept empty notifications list", () => {
      const emptyResponse = {
        items: [],
        hasMore: false,
        totalCount: 0,
        unreadCount: 0,
      }

      expect(() => notificationsListResponseSchema.parse(emptyResponse)).not.toThrow()
    })

    it("should accept response without nextCursor", () => {
      const responseWithoutCursor = {
        items: [
          {
            id: "notification1",
            type: "NEW_VERSION" as const,
            payload: {},
            readAt: null,
            createdAt: new Date(),
          },
        ],
        hasMore: false,
        totalCount: 1,
        unreadCount: 1,
      }

      expect(() => notificationsListResponseSchema.parse(responseWithoutCursor)).not.toThrow()
    })

    it("should accept notifications without optional fields", () => {
      const minimalNotificationResponse = {
        items: [
          {
            id: "notification1",
            type: "NEW_VERSION" as const,
            payload: {},
            readAt: null,
            createdAt: new Date(),
            // title, message, actionUrl, actor are optional
          },
        ],
        hasMore: false,
        totalCount: 1,
        unreadCount: 1,
      }

      expect(() => notificationsListResponseSchema.parse(minimalNotificationResponse)).not.toThrow()
    })

    it("should accept null readAt (unread notification)", () => {
      const unreadNotificationResponse = {
        items: [
          {
            id: "notification1",
            type: "NEW_VERSION" as const,
            payload: {},
            readAt: null, // nullable
            createdAt: new Date(),
          },
        ],
        hasMore: false,
        totalCount: 1,
        unreadCount: 1,
      }

      expect(() => notificationsListResponseSchema.parse(unreadNotificationResponse)).not.toThrow()
    })

    it("should accept actor with null avatarUrl", () => {
      const actorWithNullAvatarResponse = {
        items: [
          {
            id: "notification1",
            type: "COMMENT_REPLY" as const,
            payload: {},
            readAt: null,
            createdAt: new Date(),
            actor: {
              id: "actor1",
              handle: "test-actor",
              displayName: "Test Actor",
              avatarUrl: null, // nullable
            },
          },
        ],
        hasMore: false,
        totalCount: 1,
        unreadCount: 1,
      }

      expect(() => notificationsListResponseSchema.parse(actorWithNullAvatarResponse)).not.toThrow()
    })

    it("should validate integer counts", () => {
      const invalidTotalCountResponse = {
        items: [],
        hasMore: false,
        totalCount: 15.5, // Should be integer
        unreadCount: 3,
      }

      expect(() => notificationsListResponseSchema.parse(invalidTotalCountResponse)).toThrow()

      const invalidUnreadCountResponse = {
        items: [],
        hasMore: false,
        totalCount: 15,
        unreadCount: 3.7, // Should be integer
      }

      expect(() => notificationsListResponseSchema.parse(invalidUnreadCountResponse)).toThrow()
    })

    it("should require all main fields", () => {
      const requiredFields = ["items", "hasMore", "totalCount", "unreadCount"]

      requiredFields.forEach(field => {
        const invalidResponse = {
          items: [],
          hasMore: false,
          totalCount: 0,
          unreadCount: 0,
        }
        delete (invalidResponse as any)[field]

        expect(() => notificationsListResponseSchema.parse(invalidResponse)).toThrow()
      })
    })

    it("should require all notification item fields except optional ones", () => {
      const requiredItemFields = ["id", "type", "payload", "createdAt"]

      requiredItemFields.forEach(field => {
        const invalidResponse = {
          items: [
            {
              id: "notification1",
              type: "NEW_VERSION" as const,
              payload: {},
              readAt: null,
              createdAt: new Date(),
            },
          ],
          hasMore: false,
          totalCount: 1,
          unreadCount: 1,
        }
        delete (invalidResponse.items[0] as any)[field]

        expect(() => notificationsListResponseSchema.parse(invalidResponse)).toThrow()
      })
    })
  })

  describe("unreadCountResponseSchema", () => {
    it("should accept valid unread count response", () => {
      const validResponse = {
        count: 15,
      }

      const result = unreadCountResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept zero count", () => {
      const zeroCountResponse = {
        count: 0,
      }

      expect(() => unreadCountResponseSchema.parse(zeroCountResponse)).not.toThrow()
    })

    it("should validate integer count", () => {
      const invalidCountResponse = {
        count: 12.3, // Should be integer
      }

      expect(() => unreadCountResponseSchema.parse(invalidCountResponse)).toThrow()
    })

    it("should require count field", () => {
      const responseWithoutCount = {}

      expect(() => unreadCountResponseSchema.parse(responseWithoutCount)).toThrow()
    })
  })

  describe("markReadResponseSchema", () => {
    it("should accept valid mark read response", () => {
      const validResponse = {
        success: true,
      }

      const result = markReadResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept response with false success", () => {
      const failureResponse = {
        success: false,
      }

      expect(() => markReadResponseSchema.parse(failureResponse)).not.toThrow()
    })

    it("should require success field", () => {
      const responseWithoutSuccess = {}

      expect(() => markReadResponseSchema.parse(responseWithoutSuccess)).toThrow()
    })
  })

  describe("markManyReadResponseSchema", () => {
    it("should accept valid mark many read response", () => {
      const validResponse = {
        updated: 25,
      }

      const result = markManyReadResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept zero updated count", () => {
      const zeroUpdatedResponse = {
        updated: 0,
      }

      expect(() => markManyReadResponseSchema.parse(zeroUpdatedResponse)).not.toThrow()
    })

    it("should validate integer updated count", () => {
      const invalidUpdatedResponse = {
        updated: 18.7, // Should be integer
      }

      expect(() => markManyReadResponseSchema.parse(invalidUpdatedResponse)).toThrow()
    })

    it("should require updated field", () => {
      const responseWithoutUpdated = {}

      expect(() => markManyReadResponseSchema.parse(responseWithoutUpdated)).toThrow()
    })
  })

  describe("deleteNotificationResponseSchema", () => {
    it("should accept valid delete notification response", () => {
      const validResponse = {
        success: true,
      }

      const result = deleteNotificationResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept response with false success", () => {
      const failureResponse = {
        success: false,
      }

      expect(() => deleteNotificationResponseSchema.parse(failureResponse)).not.toThrow()
    })

    it("should require success field", () => {
      const responseWithoutSuccess = {}

      expect(() => deleteNotificationResponseSchema.parse(responseWithoutSuccess)).toThrow()
    })
  })

  describe("Type Exports", () => {
    it("should export all input and response types", () => {
      // Test that types are properly exported by creating variables of each type
      const toggleFollowInput: ToggleFollowInput = {
        authorUserId: "test-id",
      }

      const toggleWatchInput: ToggleWatchInput = {
        ruleId: "test-id",
      }

      const listFollowersInput: ListFollowersInput = {
        authorUserId: "test-id",
      }

      const listFollowingInput: ListFollowingInput = {
        userId: "test-id",
      }

      const notificationsListInput: NotificationsListInput = {}

      const markReadInput: MarkReadInput = {
        id: "test-id",
      }

      const markManyReadInput: MarkManyReadInput = {
        ids: ["test-id"],
      }

      const deleteNotificationInput: DeleteNotificationInput = {
        id: "test-id",
      }

      const followResponse: FollowResponse = {
        following: true,
        followersCount: 0,
        followingCount: 0,
      }

      const watchResponse: WatchResponse = {
        watching: true,
        watchersCount: 0,
      }

      const followersListResponse: FollowersListResponse = {
        items: [],
        hasMore: false,
        totalCount: 0,
      }

      const followingListResponse: FollowingListResponse = {
        items: [],
        hasMore: false,
        totalCount: 0,
      }

      const notificationsListResponse: NotificationsListResponse = {
        items: [],
        hasMore: false,
        totalCount: 0,
        unreadCount: 0,
      }

      const unreadCountResponse: UnreadCountResponse = {
        count: 0,
      }

      const markReadResponse: MarkReadResponse = {
        success: true,
      }

      const markManyReadResponse: MarkManyReadResponse = {
        updated: 0,
      }

      const deleteNotificationResponse: DeleteNotificationResponse = {
        success: true,
      }

      expect(toggleFollowInput).toBeDefined()
      expect(toggleWatchInput).toBeDefined()
      expect(listFollowersInput).toBeDefined()
      expect(listFollowingInput).toBeDefined()
      expect(notificationsListInput).toBeDefined()
      expect(markReadInput).toBeDefined()
      expect(markManyReadInput).toBeDefined()
      expect(deleteNotificationInput).toBeDefined()
      expect(followResponse).toBeDefined()
      expect(watchResponse).toBeDefined()
      expect(followersListResponse).toBeDefined()
      expect(followingListResponse).toBeDefined()
      expect(notificationsListResponse).toBeDefined()
      expect(unreadCountResponse).toBeDefined()
      expect(markReadResponse).toBeDefined()
      expect(markManyReadResponse).toBeDefined()
      expect(deleteNotificationResponse).toBeDefined()
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle complex social interaction scenarios", () => {
      // Complex follow scenario
      const complexFollowInput = {
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
      }
      expect(() => toggleFollowInputSchema.parse(complexFollowInput)).not.toThrow()

      // Complex watch scenario
      const complexWatchInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
      }
      expect(() => toggleWatchInputSchema.parse(complexWatchInput)).not.toThrow()

      // Complex notifications scenario
      const complexNotificationsInput = {
        cursor: "complex-cursor-with-special-chars-123",
        limit: 50,
        filter: "unread" as const,
      }
      expect(() => notificationsListInputSchema.parse(complexNotificationsInput)).not.toThrow()
    })

    it("should handle boundary values for list constraints", () => {
      // Test followers list boundaries
      const followersBoundaries = [
        { limit: 1 }, // Minimum
        { limit: 100 }, // Maximum
      ]

      followersBoundaries.forEach(bounds => {
        const input = {
          authorUserId: "clkv6q4a40000356h2g8h2g8h",
          ...bounds,
        }
        expect(() => listFollowersInputSchema.parse(input)).not.toThrow()
      })

      // Test following list boundaries
      const followingBoundaries = [
        { limit: 1 }, // Minimum
        { limit: 100 }, // Maximum
      ]

      followingBoundaries.forEach(bounds => {
        const input = {
          userId: "clkv6q4a40000356h2g8h2g8h",
          ...bounds,
        }
        expect(() => listFollowingInputSchema.parse(input)).not.toThrow()
      })

      // Test notifications list boundaries
      const notificationsBoundaries = [
        { limit: 1 }, // Minimum
        { limit: 100 }, // Maximum
      ]

      notificationsBoundaries.forEach(bounds => {
        const input = bounds
        expect(() => notificationsListInputSchema.parse(input)).not.toThrow()
      })
    })

    it("should handle comprehensive response structures", () => {
      const comprehensiveFollowersResponse = {
        items: [
          {
            id: "comprehensive-follower-id-1",
            handle: "comprehensive-follower-handle-1",
            displayName: "Comprehensive Follower Display Name 1",
            avatarUrl: "https://cdn.example.com/avatars/comprehensive-follower-1.jpg",
            isVerified: true,
            followedAt: new Date("2024-01-01T00:00:00.000Z"),
          },
          {
            id: "comprehensive-follower-id-2",
            handle: "comprehensive-follower-handle-2",
            displayName: "Comprehensive Follower Display Name 2",
            avatarUrl: null,
            isVerified: false,
            followedAt: new Date("2024-12-31T23:59:59.999Z"),
          },
        ],
        nextCursor: "comprehensive-followers-cursor-with-special-chars-123",
        hasMore: true,
        totalCount: 9999999,
      }

      expect(() => followersListResponseSchema.parse(comprehensiveFollowersResponse)).not.toThrow()

      const comprehensiveNotificationsResponse = {
        items: [
          {
            id: "comprehensive-notification-id-1",
            type: "DONATION_RECEIVED" as const,
            payload: {
              donationId: "donation123",
              amount: 50.0,
              currency: "USD",
              donorName: "Anonymous Donor",
              message: "Keep up the great work!",
            },
            readAt: new Date("2024-01-16T10:00:00Z"),
            createdAt: new Date("2024-01-15T10:00:00Z"),
            title: "New Donation Received",
            message: "You received a $50.00 donation with a message: Keep up the great work!",
            actionUrl: "/dashboard/donations",
            actor: {
              id: "comprehensive-actor-id",
              handle: "comprehensive-donor-handle",
              displayName: "Comprehensive Donor Display Name",
              avatarUrl: "https://cdn.example.com/avatars/comprehensive-donor.jpg",
            },
          },
          {
            id: "comprehensive-notification-id-2",
            type: "CLAIM_VERDICT" as const,
            payload: {
              claimId: "claim456",
              verdict: "APPROVED",
              reviewerId: "reviewer789",
              reviewerNote: "Claim verified successfully",
            },
            readAt: null,
            createdAt: new Date("2024-01-20T15:30:00Z"),
            title: "Claim Approved",
            message: "Your authorship claim has been approved by the review team",
            actionUrl: "/dashboard/claims",
            actor: {
              id: "comprehensive-reviewer-id",
              handle: "comprehensive-reviewer-handle",
              displayName: "Comprehensive Reviewer Display Name",
              avatarUrl: null,
            },
          },
        ],
        nextCursor: "comprehensive-notifications-cursor-with-special-chars-456",
        hasMore: true,
        totalCount: 1000000,
        unreadCount: 500000,
      }

      expect(() =>
        notificationsListResponseSchema.parse(comprehensiveNotificationsResponse)
      ).not.toThrow()
    })

    it("should handle mark many read with various ID counts", () => {
      const markManyVariations = [
        {
          ids: ["single-id"], // Single ID
        },
        {
          ids: Array(50).fill("clkv6q4a40000356h2g8h2g8h"), // Medium batch
        },
        {
          ids: Array(200).fill("clkv6q4a40000356h2g8h2g8h"), // Maximum batch
        },
      ]

      markManyVariations.forEach(variation => {
        expect(() => markManyReadInputSchema.parse(variation)).not.toThrow()
      })
    })

    it("should validate all schemas work together in a social flow", () => {
      // 1. Toggle follow
      const followInput = {
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
      }
      expect(() => toggleFollowInputSchema.parse(followInput)).not.toThrow()

      // 2. Follow response
      const followResponse = {
        following: true,
        followersCount: 151,
        followingCount: 76,
      }
      expect(() => followResponseSchema.parse(followResponse)).not.toThrow()

      // 3. List followers
      const followersInput = {
        authorUserId: "clkv6q4a40000356h2g8h2g8h",
        limit: 20,
      }
      expect(() => listFollowersInputSchema.parse(followersInput)).not.toThrow()

      // 4. Followers response
      const followersResponse = {
        items: [
          {
            id: "follower1",
            handle: "new-follower",
            displayName: "New Follower",
            avatarUrl: null,
            isVerified: false,
            followedAt: new Date(),
          },
        ],
        hasMore: false,
        totalCount: 151,
      }
      expect(() => followersListResponseSchema.parse(followersResponse)).not.toThrow()

      // 5. Toggle watch
      const watchInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
      }
      expect(() => toggleWatchInputSchema.parse(watchInput)).not.toThrow()

      // 6. Watch response
      const watchResponse = {
        watching: true,
        watchersCount: 43,
      }
      expect(() => watchResponseSchema.parse(watchResponse)).not.toThrow()

      // 7. Notifications list
      const notificationsInput = {
        filter: "unread" as const,
        limit: 30,
      }
      expect(() => notificationsListInputSchema.parse(notificationsInput)).not.toThrow()

      // 8. Notifications response
      const notificationsResponse = {
        items: [
          {
            id: "notification1",
            type: "AUTHOR_PUBLISHED" as const,
            payload: { ruleId: "clkv6q4a40000356h2g8h2g8h" },
            readAt: null,
            createdAt: new Date(),
            title: "New Rule Published",
            message: "An author you follow published a new rule",
            actionUrl: "/rules/clkv6q4a40000356h2g8h2g8h",
            actor: {
              id: "clkv6q4a40000356h2g8h2g8h",
              handle: "rule-author",
              displayName: "Rule Author",
              avatarUrl: null,
            },
          },
        ],
        hasMore: false,
        totalCount: 1,
        unreadCount: 1,
      }
      expect(() => notificationsListResponseSchema.parse(notificationsResponse)).not.toThrow()

      // 9. Mark notification as read
      const markReadInput = {
        id: "notification1",
      }
      expect(() => markReadInputSchema.parse(markReadInput)).not.toThrow()

      // 10. Mark read response
      const markReadResponse = {
        success: true,
      }
      expect(() => markReadResponseSchema.parse(markReadResponse)).not.toThrow()
    })
  })
})
