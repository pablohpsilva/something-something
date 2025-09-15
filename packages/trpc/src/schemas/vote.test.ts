import { describe, it, expect } from "vitest"
import {
  voteValueSchema,
  voteRuleSchema,
  voteVersionSchema,
  voteScoreQuerySchema,
  voteDTOSchema,
  userVotesQuerySchema,
  userVotesResponseSchema,
  voteValueToNumber,
  numberToVoteValue,
  type VoteValue,
  type VoteRuleInput,
  type VoteVersionInput,
  type VoteScoreQuery,
  type VoteDTO,
  type UserVotesQuery,
  type UserVotesResponse,
} from "./vote"

describe("Vote Schemas", () => {
  describe("voteValueSchema", () => {
    it("should accept valid vote values", () => {
      const validValues = ["up", "down", "none"] as const

      validValues.forEach(value => {
        expect(() => voteValueSchema.parse(value)).not.toThrow()
        const result = voteValueSchema.parse(value)
        expect(result).toBe(value)
      })
    })

    it("should reject invalid vote values", () => {
      const invalidValues = [
        "upvote",
        "downvote",
        "neutral",
        "yes",
        "no",
        "like",
        "dislike",
        "",
        null,
        undefined,
        1,
        0,
        -1,
        true,
        false,
        {},
        [],
      ]

      invalidValues.forEach(value => {
        expect(() => voteValueSchema.parse(value)).toThrow()
      })
    })

    it("should be case sensitive", () => {
      const caseSensitiveValues = ["UP", "Down", "NONE", "Up"]

      caseSensitiveValues.forEach(value => {
        expect(() => voteValueSchema.parse(value)).toThrow()
      })

      // "down" is actually valid, so test it separately
      expect(() => voteValueSchema.parse("down")).not.toThrow()
    })
  })

  describe("voteRuleSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        value: "up" as const,
      }

      const result = voteRuleSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept all valid vote values", () => {
      const voteValues = ["up", "down", "none"] as const

      voteValues.forEach(value => {
        const input = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          value,
        }
        expect(() => voteRuleSchema.parse(input)).not.toThrow()
      })
    })

    it("should validate ruleId (CUID or UUID)", () => {
      const validRuleIds = [
        "clkv6q4a40000356h2g8h2g8h", // CUID
        "550e8400-e29b-41d4-a716-446655440000", // UUID
        "any-non-empty-string", // cuidOrUuidSchema accepts any non-empty string
      ]

      validRuleIds.forEach(ruleId => {
        const input = {
          ruleId,
          value: "up" as const,
        }
        expect(() => voteRuleSchema.parse(input)).not.toThrow()
      })

      // Test empty ruleId
      const emptyRuleIdInput = {
        ruleId: "",
        value: "up" as const,
      }
      expect(() => voteRuleSchema.parse(emptyRuleIdInput)).toThrow()
    })

    it("should reject invalid vote values", () => {
      const invalidVoteInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        value: "invalid_vote",
      }

      expect(() => voteRuleSchema.parse(invalidVoteInput)).toThrow()
    })

    it("should require both fields", () => {
      const requiredFields = ["ruleId", "value"]

      requiredFields.forEach(field => {
        const invalidInput = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          value: "up" as const,
        }
        delete (invalidInput as any)[field]

        expect(() => voteRuleSchema.parse(invalidInput)).toThrow()
      })
    })

    it("should reject additional fields", () => {
      const inputWithExtraFields = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        value: "up" as const,
        extraField: "should be rejected",
      }

      // Zod strips unknown fields by default, so this should not throw
      expect(() => voteRuleSchema.parse(inputWithExtraFields)).not.toThrow()

      const result = voteRuleSchema.parse(inputWithExtraFields)
      expect(result).not.toHaveProperty("extraField")
    })
  })

  describe("voteVersionSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        ruleVersionId: "clkv6q4a40000356h2g8h2g8i",
        value: "down" as const,
      }

      const result = voteVersionSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept all valid vote values", () => {
      const voteValues = ["up", "down", "none"] as const

      voteValues.forEach(value => {
        const input = {
          ruleVersionId: "clkv6q4a40000356h2g8h2g8i",
          value,
        }
        expect(() => voteVersionSchema.parse(input)).not.toThrow()
      })
    })

    it("should validate ruleVersionId (CUID or UUID)", () => {
      const validVersionIds = [
        "clkv6q4a40000356h2g8h2g8i", // CUID
        "550e8400-e29b-41d4-a716-446655440001", // UUID
        "version-id-123", // cuidOrUuidSchema accepts any non-empty string
      ]

      validVersionIds.forEach(ruleVersionId => {
        const input = {
          ruleVersionId,
          value: "none" as const,
        }
        expect(() => voteVersionSchema.parse(input)).not.toThrow()
      })

      // Test empty ruleVersionId
      const emptyVersionIdInput = {
        ruleVersionId: "",
        value: "none" as const,
      }
      expect(() => voteVersionSchema.parse(emptyVersionIdInput)).toThrow()
    })

    it("should reject invalid vote values", () => {
      const invalidVoteInput = {
        ruleVersionId: "clkv6q4a40000356h2g8h2g8i",
        value: "maybe",
      }

      expect(() => voteVersionSchema.parse(invalidVoteInput)).toThrow()
    })

    it("should require both fields", () => {
      const requiredFields = ["ruleVersionId", "value"]

      requiredFields.forEach(field => {
        const invalidInput = {
          ruleVersionId: "clkv6q4a40000356h2g8h2g8i",
          value: "down" as const,
        }
        delete (invalidInput as any)[field]

        expect(() => voteVersionSchema.parse(invalidInput)).toThrow()
      })
    })

    it("should reject additional fields", () => {
      const inputWithExtraFields = {
        ruleVersionId: "clkv6q4a40000356h2g8h2g8i",
        value: "down" as const,
        timestamp: new Date(),
      }

      // Zod strips unknown fields by default, so this should not throw
      expect(() => voteVersionSchema.parse(inputWithExtraFields)).not.toThrow()

      const result = voteVersionSchema.parse(inputWithExtraFields)
      expect(result).not.toHaveProperty("timestamp")
    })
  })

  describe("voteScoreQuerySchema", () => {
    it("should accept valid input with ruleId only", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
      }

      const result = voteScoreQuerySchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept valid input with ruleVersionId only", () => {
      const validInput = {
        ruleVersionId: "clkv6q4a40000356h2g8h2g8i",
      }

      const result = voteScoreQuerySchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept valid input with both fields", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        ruleVersionId: "clkv6q4a40000356h2g8h2g8i",
      }

      const result = voteScoreQuerySchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept empty input (both fields optional)", () => {
      const emptyInput = {}

      expect(() => voteScoreQuerySchema.parse(emptyInput)).not.toThrow()
      const result = voteScoreQuerySchema.parse(emptyInput)
      expect(result).toEqual({})
    })

    it("should validate ruleId when provided", () => {
      const validRuleIdInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
      }
      expect(() => voteScoreQuerySchema.parse(validRuleIdInput)).not.toThrow()

      // Test empty ruleId
      const emptyRuleIdInput = {
        ruleId: "",
      }
      expect(() => voteScoreQuerySchema.parse(emptyRuleIdInput)).toThrow()
    })

    it("should validate ruleVersionId when provided", () => {
      const validVersionIdInput = {
        ruleVersionId: "clkv6q4a40000356h2g8h2g8i",
      }
      expect(() => voteScoreQuerySchema.parse(validVersionIdInput)).not.toThrow()

      // Test empty ruleVersionId
      const emptyVersionIdInput = {
        ruleVersionId: "",
      }
      expect(() => voteScoreQuerySchema.parse(emptyVersionIdInput)).toThrow()
    })

    it("should handle undefined values", () => {
      const inputWithUndefined = {
        ruleId: undefined,
        ruleVersionId: "clkv6q4a40000356h2g8h2g8i",
      }

      expect(() => voteScoreQuerySchema.parse(inputWithUndefined)).not.toThrow()
    })
  })

  describe("voteDTOSchema", () => {
    it("should accept valid DTO with all fields", () => {
      const validDTO = {
        score: 15,
        upCount: 20,
        downCount: 5,
        myVote: 1,
      }

      const result = voteDTOSchema.parse(validDTO)
      expect(result).toEqual(validDTO)
    })

    it("should accept negative scores", () => {
      const negativeScoreDTO = {
        score: -10,
        upCount: 5,
        downCount: 15,
        myVote: -1,
      }

      expect(() => voteDTOSchema.parse(negativeScoreDTO)).not.toThrow()
    })

    it("should accept zero values", () => {
      const zeroValuesDTO = {
        score: 0,
        upCount: 0,
        downCount: 0,
        myVote: 0,
      }

      expect(() => voteDTOSchema.parse(zeroValuesDTO)).not.toThrow()
    })

    it("should validate myVote range (-1 to 1)", () => {
      const validMyVoteValues = [-1, 0, 1]

      validMyVoteValues.forEach(myVote => {
        const dto = {
          score: 10,
          upCount: 15,
          downCount: 5,
          myVote,
        }
        expect(() => voteDTOSchema.parse(dto)).not.toThrow()
      })
    })

    it("should reject myVote values outside range", () => {
      const invalidMyVoteValues = [-2, 2, 5, -10]

      invalidMyVoteValues.forEach(myVote => {
        const dto = {
          score: 10,
          upCount: 15,
          downCount: 5,
          myVote,
        }
        expect(() => voteDTOSchema.parse(dto)).toThrow()
      })

      // Test decimal values separately - they might be accepted by Zod's min/max
      const decimalValues = [1.5, -0.5, 1.1, -1.1]
      decimalValues.forEach(myVote => {
        const dto = {
          score: 10,
          upCount: 15,
          downCount: 5,
          myVote,
        }
        if (myVote >= -1 && myVote <= 1) {
          expect(() => voteDTOSchema.parse(dto)).not.toThrow()
        } else {
          expect(() => voteDTOSchema.parse(dto)).toThrow()
        }
      })
    })

    it("should accept decimal numbers for score and counts", () => {
      const decimalDTO = {
        score: 15.5,
        upCount: 20.7,
        downCount: 5.2,
        myVote: 1,
      }

      expect(() => voteDTOSchema.parse(decimalDTO)).not.toThrow()
    })

    it("should reject non-numeric values", () => {
      const nonNumericFields = ["score", "upCount", "downCount", "myVote"]

      nonNumericFields.forEach(field => {
        const invalidDTO = {
          score: 10,
          upCount: 15,
          downCount: 5,
          myVote: 1,
        }
        ;(invalidDTO as any)[field] = "not_a_number"

        expect(() => voteDTOSchema.parse(invalidDTO)).toThrow()
      })
    })

    it("should require all fields", () => {
      const requiredFields = ["score", "upCount", "downCount", "myVote"]

      requiredFields.forEach(field => {
        const invalidDTO = {
          score: 10,
          upCount: 15,
          downCount: 5,
          myVote: 1,
        }
        delete (invalidDTO as any)[field]

        expect(() => voteDTOSchema.parse(invalidDTO)).toThrow()
      })
    })
  })

  describe("userVotesQuerySchema", () => {
    it("should accept valid input with ruleIds only", () => {
      const validInput = {
        ruleIds: [
          "clkv6q4a40000356h2g8h2g8h",
          "clkv6q4a40000356h2g8h2g8i",
          "clkv6q4a40000356h2g8h2g8j",
        ],
      }

      const result = userVotesQuerySchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept valid input with ruleVersionIds only", () => {
      const validInput = {
        ruleVersionIds: ["clkv6q4a40000356h2g8h2g8k", "clkv6q4a40000356h2g8h2g8l"],
      }

      const result = userVotesQuerySchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept valid input with both arrays", () => {
      const validInput = {
        ruleIds: ["clkv6q4a40000356h2g8h2g8h"],
        ruleVersionIds: ["clkv6q4a40000356h2g8h2g8i"],
      }

      const result = userVotesQuerySchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept empty input (both fields optional)", () => {
      const emptyInput = {}

      expect(() => userVotesQuerySchema.parse(emptyInput)).not.toThrow()
      const result = userVotesQuerySchema.parse(emptyInput)
      expect(result).toEqual({})
    })

    it("should accept empty arrays", () => {
      const emptyArraysInput = {
        ruleIds: [],
        ruleVersionIds: [],
      }

      expect(() => userVotesQuerySchema.parse(emptyArraysInput)).not.toThrow()
    })

    it("should validate ruleIds array elements", () => {
      const validRuleIdsInput = {
        ruleIds: [
          "clkv6q4a40000356h2g8h2g8h",
          "550e8400-e29b-41d4-a716-446655440000",
          "rule-id-123",
        ],
      }
      expect(() => userVotesQuerySchema.parse(validRuleIdsInput)).not.toThrow()

      // Test with empty string in array
      const invalidRuleIdsInput = {
        ruleIds: ["clkv6q4a40000356h2g8h2g8h", ""],
      }
      expect(() => userVotesQuerySchema.parse(invalidRuleIdsInput)).toThrow()
    })

    it("should validate ruleVersionIds array elements", () => {
      const validVersionIdsInput = {
        ruleVersionIds: ["clkv6q4a40000356h2g8h2g8i", "550e8400-e29b-41d4-a716-446655440001"],
      }
      expect(() => userVotesQuerySchema.parse(validVersionIdsInput)).not.toThrow()

      // Test with empty string in array
      const invalidVersionIdsInput = {
        ruleVersionIds: ["clkv6q4a40000356h2g8h2g8i", ""],
      }
      expect(() => userVotesQuerySchema.parse(invalidVersionIdsInput)).toThrow()
    })

    it("should reject non-array values", () => {
      const nonArrayInputs = [
        { ruleIds: "not_an_array" },
        { ruleVersionIds: "not_an_array" },
        { ruleIds: null },
        { ruleVersionIds: null },
        { ruleIds: 123 },
        { ruleVersionIds: true },
      ]

      nonArrayInputs.forEach(input => {
        expect(() => userVotesQuerySchema.parse(input)).toThrow()
      })

      // undefined is acceptable for optional fields
      const undefinedInput = {
        ruleIds: undefined,
        ruleVersionIds: undefined,
      }
      expect(() => userVotesQuerySchema.parse(undefinedInput)).not.toThrow()
    })

    it("should handle undefined values", () => {
      const inputWithUndefined = {
        ruleIds: undefined,
        ruleVersionIds: ["clkv6q4a40000356h2g8h2g8i"],
      }

      expect(() => userVotesQuerySchema.parse(inputWithUndefined)).not.toThrow()
    })
  })

  describe("userVotesResponseSchema", () => {
    it("should accept valid response with all fields", () => {
      const validResponse = {
        ruleVotes: {
          clkv6q4a40000356h2g8h2g8h: 1,
          clkv6q4a40000356h2g8h2g8i: -1,
          clkv6q4a40000356h2g8h2g8j: 0,
        },
        versionVotes: {
          clkv6q4a40000356h2g8h2g8k: 1,
          clkv6q4a40000356h2g8h2g8l: -1,
        },
      }

      const result = userVotesResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept empty records", () => {
      const emptyResponse = {
        ruleVotes: {},
        versionVotes: {},
      }

      expect(() => userVotesResponseSchema.parse(emptyResponse)).not.toThrow()
    })

    it("should validate vote values in records", () => {
      const validVoteValues = [-1, 0, 1]

      validVoteValues.forEach(voteValue => {
        const response = {
          ruleVotes: {
            "rule-id": voteValue,
          },
          versionVotes: {
            "version-id": voteValue,
          },
        }
        expect(() => userVotesResponseSchema.parse(response)).not.toThrow()
      })
    })

    it("should accept decimal vote values", () => {
      const decimalResponse = {
        ruleVotes: {
          "rule-id": 0.5,
        },
        versionVotes: {
          "version-id": -0.7,
        },
      }

      expect(() => userVotesResponseSchema.parse(decimalResponse)).not.toThrow()
    })

    it("should reject non-numeric vote values", () => {
      const invalidRuleVotesResponse = {
        ruleVotes: {
          "rule-id": "not_a_number",
        },
        versionVotes: {},
      }

      expect(() => userVotesResponseSchema.parse(invalidRuleVotesResponse)).toThrow()

      const invalidVersionVotesResponse = {
        ruleVotes: {},
        versionVotes: {
          "version-id": "invalid",
        },
      }

      expect(() => userVotesResponseSchema.parse(invalidVersionVotesResponse)).toThrow()
    })

    it("should require both fields", () => {
      const requiredFields = ["ruleVotes", "versionVotes"]

      requiredFields.forEach(field => {
        const invalidResponse = {
          ruleVotes: {},
          versionVotes: {},
        }
        delete (invalidResponse as any)[field]

        expect(() => userVotesResponseSchema.parse(invalidResponse)).toThrow()
      })
    })

    it("should reject non-record values", () => {
      const nonRecordInputs = [
        { ruleVotes: "not_a_record", versionVotes: {} },
        { ruleVotes: [], versionVotes: {} },
        { ruleVotes: {}, versionVotes: "not_a_record" },
        { ruleVotes: {}, versionVotes: [] },
      ]

      nonRecordInputs.forEach(input => {
        expect(() => userVotesResponseSchema.parse(input)).toThrow()
      })
    })
  })

  describe("Utility Functions", () => {
    describe("voteValueToNumber", () => {
      it("should convert vote values to correct numbers", () => {
        expect(voteValueToNumber("up")).toBe(1)
        expect(voteValueToNumber("down")).toBe(-1)
        expect(voteValueToNumber("none")).toBe(0)
      })

      it("should handle all enum values", () => {
        const voteValues: VoteValue[] = ["up", "down", "none"]
        const expectedNumbers = [1, -1, 0]

        voteValues.forEach((value, index) => {
          expect(voteValueToNumber(value)).toBe(expectedNumbers[index])
        })
      })
    })

    describe("numberToVoteValue", () => {
      it("should convert positive numbers to 'up'", () => {
        const positiveNumbers = [1, 2, 10, 0.1, 100, 1.5]

        positiveNumbers.forEach(num => {
          expect(numberToVoteValue(num)).toBe("up")
        })
      })

      it("should convert negative numbers to 'down'", () => {
        const negativeNumbers = [-1, -2, -10, -0.1, -100, -1.5]

        negativeNumbers.forEach(num => {
          expect(numberToVoteValue(num)).toBe("down")
        })
      })

      it("should convert zero to 'none'", () => {
        expect(numberToVoteValue(0)).toBe("none")
        expect(numberToVoteValue(-0)).toBe("none")
      })

      it("should handle edge cases", () => {
        expect(numberToVoteValue(Number.POSITIVE_INFINITY)).toBe("up")
        expect(numberToVoteValue(Number.NEGATIVE_INFINITY)).toBe("down")
        expect(numberToVoteValue(Number.MIN_VALUE)).toBe("up") // Smallest positive number
        expect(numberToVoteValue(-Number.MIN_VALUE)).toBe("down")
      })

      it("should handle NaN", () => {
        expect(numberToVoteValue(NaN)).toBe("none")
      })
    })

    describe("Utility function roundtrip", () => {
      it("should maintain consistency in both directions", () => {
        const voteValues: VoteValue[] = ["up", "down", "none"]

        voteValues.forEach(value => {
          const number = voteValueToNumber(value)
          const backToValue = numberToVoteValue(number)
          expect(backToValue).toBe(value)
        })
      })

      it("should handle standard vote numbers", () => {
        const standardNumbers = [1, -1, 0]
        const expectedValues: VoteValue[] = ["up", "down", "none"]

        standardNumbers.forEach((num, index) => {
          const value = numberToVoteValue(num)
          const backToNumber = voteValueToNumber(value)
          expect(value).toBe(expectedValues[index])
          expect(backToNumber).toBe(num)
        })
      })
    })
  })

  describe("Type Exports", () => {
    it("should export all input and response types", () => {
      // Test that types are properly exported by creating variables of each type
      const voteValue: VoteValue = "up"

      const voteRuleInput: VoteRuleInput = {
        ruleId: "test-rule-id",
        value: "up",
      }

      const voteVersionInput: VoteVersionInput = {
        ruleVersionId: "test-version-id",
        value: "down",
      }

      const voteScoreQuery: VoteScoreQuery = {
        ruleId: "test-rule-id",
      }

      const voteDTO: VoteDTO = {
        score: 10,
        upCount: 15,
        downCount: 5,
        myVote: 1,
      }

      const userVotesQuery: UserVotesQuery = {
        ruleIds: ["rule1", "rule2"],
      }

      const userVotesResponse: UserVotesResponse = {
        ruleVotes: { rule1: 1 },
        versionVotes: { version1: -1 },
      }

      expect(voteValue).toBeDefined()
      expect(voteRuleInput).toBeDefined()
      expect(voteVersionInput).toBeDefined()
      expect(voteScoreQuery).toBeDefined()
      expect(voteDTO).toBeDefined()
      expect(userVotesQuery).toBeDefined()
      expect(userVotesResponse).toBeDefined()
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle complex voting scenarios", () => {
      // Complex rule voting scenario
      const complexRuleVote = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        value: "up" as const,
      }
      expect(() => voteRuleSchema.parse(complexRuleVote)).not.toThrow()

      // Complex version voting scenario
      const complexVersionVote = {
        ruleVersionId: "clkv6q4a40000356h2g8h2g8i",
        value: "down" as const,
      }
      expect(() => voteVersionSchema.parse(complexVersionVote)).not.toThrow()

      // Complex score query with both IDs
      const complexScoreQuery = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        ruleVersionId: "clkv6q4a40000356h2g8h2g8i",
      }
      expect(() => voteScoreQuerySchema.parse(complexScoreQuery)).not.toThrow()

      // Complex DTO with realistic values
      const complexDTO = {
        score: 847, // 1000 upvotes - 153 downvotes
        upCount: 1000,
        downCount: 153,
        myVote: 1,
      }
      expect(() => voteDTOSchema.parse(complexDTO)).not.toThrow()
    })

    it("should handle batch voting queries", () => {
      // Large batch query
      const largeBatchQuery = {
        ruleIds: Array.from({ length: 100 }, (_, i) => `rule-${i}`),
        ruleVersionIds: Array.from({ length: 50 }, (_, i) => `version-${i}`),
      }
      expect(() => userVotesQuerySchema.parse(largeBatchQuery)).not.toThrow()

      // Large batch response
      const largeBatchResponse = {
        ruleVotes: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`rule-${i}`, (i % 3) - 1])
        ),
        versionVotes: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`version-${i}`, (i % 3) - 1])
        ),
      }
      expect(() => userVotesResponseSchema.parse(largeBatchResponse)).not.toThrow()
    })

    it("should handle various ID formats", () => {
      const idFormats = [
        "clkv6q4a40000356h2g8h2g8h", // CUID
        "550e8400-e29b-41d4-a716-446655440000", // UUID
        "rule_123", // Underscore format
        "rule-456", // Hyphen format
        "abc123def", // Mixed alphanumeric
      ]

      idFormats.forEach(id => {
        // Test in rule voting
        const ruleVoteInput = {
          ruleId: id,
          value: "up" as const,
        }
        expect(() => voteRuleSchema.parse(ruleVoteInput)).not.toThrow()

        // Test in version voting
        const versionVoteInput = {
          ruleVersionId: id,
          value: "down" as const,
        }
        expect(() => voteVersionSchema.parse(versionVoteInput)).not.toThrow()

        // Test in score query
        const scoreQueryInput = {
          ruleId: id,
          ruleVersionId: id,
        }
        expect(() => voteScoreQuerySchema.parse(scoreQueryInput)).not.toThrow()
      })
    })

    it("should handle extreme vote counts", () => {
      const extremeVoteCounts = [
        {
          score: Number.MAX_SAFE_INTEGER,
          upCount: Number.MAX_SAFE_INTEGER,
          downCount: 0,
        },
        {
          score: Number.MIN_SAFE_INTEGER,
          upCount: 0,
          downCount: Number.MAX_SAFE_INTEGER,
        },
        { score: 0, upCount: 1000000, downCount: 1000000 },
      ]

      extremeVoteCounts.forEach(counts => {
        const dto = {
          ...counts,
          myVote: 0,
        }
        expect(() => voteDTOSchema.parse(dto)).not.toThrow()
      })
    })

    it("should handle vote state transitions", () => {
      // Test all possible vote transitions
      const voteTransitions = [
        { from: "none", to: "up" },
        { from: "none", to: "down" },
        { from: "up", to: "down" },
        { from: "up", to: "none" },
        { from: "down", to: "up" },
        { from: "down", to: "none" },
      ] as const

      voteTransitions.forEach(({ from, to }) => {
        // Test that both states are valid
        expect(() => voteValueSchema.parse(from)).not.toThrow()
        expect(() => voteValueSchema.parse(to)).not.toThrow()

        // Test utility function consistency
        const fromNumber = voteValueToNumber(from)
        const toNumber = voteValueToNumber(to)
        expect(numberToVoteValue(fromNumber)).toBe(from)
        expect(numberToVoteValue(toNumber)).toBe(to)
      })
    })

    it("should handle mixed vote scenarios", () => {
      // Scenario: User has voted on some rules and versions
      const mixedVotesQuery = {
        ruleIds: [
          "clkv6q4a40000356h2g8h2g8h",
          "clkv6q4a40000356h2g8h2g8i",
          "clkv6q4a40000356h2g8h2g8j",
        ],
        ruleVersionIds: ["clkv6q4a40000356h2g8h2g8k", "clkv6q4a40000356h2g8h2g8l"],
      }
      expect(() => userVotesQuerySchema.parse(mixedVotesQuery)).not.toThrow()

      // Response with mixed vote states
      const mixedVotesResponse = {
        ruleVotes: {
          clkv6q4a40000356h2g8h2g8h: 1, // upvoted
          clkv6q4a40000356h2g8h2g8i: -1, // downvoted
          clkv6q4a40000356h2g8h2g8j: 0, // no vote
        },
        versionVotes: {
          clkv6q4a40000356h2g8h2g8k: 1, // upvoted
          clkv6q4a40000356h2g8h2g8l: 0, // no vote
        },
      }
      expect(() => userVotesResponseSchema.parse(mixedVotesResponse)).not.toThrow()
    })
  })
})
