import { describe, it, expect } from "vitest";
import {
  createVersionSchema,
  forkVersionSchema,
  listVersionsByRuleSchema,
  getVersionByIdSchema,
  getVersionDiffSchema,
  updateVersionSchema,
  setCurrentVersionSchema,
  getVersionHistorySchema,
  compareVersionsSchema,
  getVersionStatsSchema,
  type CreateVersionInput,
  type ForkVersionInput,
  type ListVersionsByRuleInput,
  type GetVersionByIdInput,
  type GetVersionDiffInput,
  type UpdateVersionInput,
  type SetCurrentVersionInput,
  type GetVersionHistoryInput,
  type CompareVersionsInput,
  type GetVersionStatsInput,
} from "./version";

describe("Version Schemas", () => {
  describe("createVersionSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        baseVersionId: "clkv6q4a40000356h2g8h2g8i",
        body: "This is the rule body content",
        changelog: "Initial version with basic functionality",
        testedOn: {
          models: ["gpt-4", "claude-3"],
          stacks: ["openai", "anthropic"],
        },
        version: "1.0.0",
        idempotencyKey: "create-version-key-123",
      };

      const result = createVersionSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input with required fields only", () => {
      const minimalInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        body: "Minimal rule body",
        changelog: "Initial version",
        idempotencyKey: "minimal-create-key",
      };

      expect(() => createVersionSchema.parse(minimalInput)).not.toThrow();
    });

    it("should accept input without baseVersionId", () => {
      const inputWithoutBaseVersion = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        body: "Rule body without base version",
        changelog: "New version from scratch",
        idempotencyKey: "no-base-version-key",
      };

      expect(() =>
        createVersionSchema.parse(inputWithoutBaseVersion)
      ).not.toThrow();
    });

    it("should accept input without testedOn", () => {
      const inputWithoutTestedOn = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        body: "Rule body without testing info",
        changelog: "Version without testing details",
        idempotencyKey: "no-tested-on-key",
      };

      expect(() =>
        createVersionSchema.parse(inputWithoutTestedOn)
      ).not.toThrow();
    });

    it("should accept input without version (auto-increment)", () => {
      const inputWithoutVersion = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        body: "Rule body with auto version",
        changelog: "Auto-incremented version",
        idempotencyKey: "auto-version-key",
      };

      expect(() =>
        createVersionSchema.parse(inputWithoutVersion)
      ).not.toThrow();
    });

    it("should accept input without idempotencyKey", () => {
      const inputWithoutIdempotencyKey = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        body: "Rule body without idempotency key",
        changelog: "Version without idempotency key",
      };

      expect(() =>
        createVersionSchema.parse(inputWithoutIdempotencyKey)
      ).not.toThrow();
    });

    it("should validate ruleId (CUID)", () => {
      const validRuleIdInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        body: "Valid rule body",
        changelog: "Valid changelog",
        idempotencyKey: "valid-rule-id-key",
      };
      expect(() => createVersionSchema.parse(validRuleIdInput)).not.toThrow();

      // Test empty ruleId
      const emptyRuleIdInput = {
        ruleId: "",
        body: "Rule body",
        changelog: "Changelog",
        idempotencyKey: "empty-rule-id-key",
      };
      expect(() => createVersionSchema.parse(emptyRuleIdInput)).toThrow();
    });

    it("should validate baseVersionId (CUID) when provided", () => {
      const validBaseVersionInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        baseVersionId: "clkv6q4a40000356h2g8h2g8i",
        body: "Rule body with valid base version",
        changelog: "Based on previous version",
        idempotencyKey: "valid-base-version-key",
      };
      expect(() =>
        createVersionSchema.parse(validBaseVersionInput)
      ).not.toThrow();

      // Test empty baseVersionId
      const emptyBaseVersionInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        baseVersionId: "",
        body: "Rule body",
        changelog: "Changelog",
        idempotencyKey: "empty-base-version-key",
      };
      expect(() => createVersionSchema.parse(emptyBaseVersionInput)).toThrow();
    });

    it("should require mandatory fields", () => {
      const requiredFields = ["ruleId", "body"];

      requiredFields.forEach((field) => {
        const invalidInput = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          body: "Test body",
          changelog: "Test changelog",
          idempotencyKey: "test-key",
        };
        delete (invalidInput as any)[field];

        expect(() => createVersionSchema.parse(invalidInput)).toThrow();
      });
    });
  });

  describe("forkVersionSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        fromVersionId: "clkv6q4a40000356h2g8h2g8i",
        newBody: "Forked rule body with modifications",
        changelog: "Forked from version 1.0.0 with improvements",
        testedOn: {
          models: ["gpt-4-turbo"],
          stacks: ["openai"],
        },
        idempotencyKey: "fork-version-key-456",
      };

      const result = forkVersionSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input without optional fields", () => {
      const minimalInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        fromVersionId: "clkv6q4a40000356h2g8h2g8i",
        changelog: "Forked version",
        idempotencyKey: "minimal-fork-key",
      };

      expect(() => forkVersionSchema.parse(minimalInput)).not.toThrow();
    });

    it("should accept input without newBody", () => {
      const inputWithoutNewBody = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        fromVersionId: "clkv6q4a40000356h2g8h2g8i",
        changelog: "Fork without body changes",
        idempotencyKey: "no-new-body-key",
      };

      expect(() => forkVersionSchema.parse(inputWithoutNewBody)).not.toThrow();
    });

    it("should accept input without testedOn", () => {
      const inputWithoutTestedOn = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        fromVersionId: "clkv6q4a40000356h2g8h2g8i",
        newBody: "Forked body without testing info",
        changelog: "Fork without testing details",
        idempotencyKey: "no-tested-on-fork-key",
      };

      expect(() => forkVersionSchema.parse(inputWithoutTestedOn)).not.toThrow();
    });

    it("should accept input without idempotencyKey", () => {
      const inputWithoutIdempotencyKey = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        fromVersionId: "clkv6q4a40000356h2g8h2g8i",
        changelog: "Fork without idempotency key",
      };

      expect(() =>
        forkVersionSchema.parse(inputWithoutIdempotencyKey)
      ).not.toThrow();
    });

    it("should validate ruleId and fromVersionId (CUIDs)", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        fromVersionId: "clkv6q4a40000356h2g8h2g8i",
        changelog: "Valid fork",
        idempotencyKey: "valid-ids-key",
      };
      expect(() => forkVersionSchema.parse(validInput)).not.toThrow();

      // Test empty ruleId
      const emptyRuleIdInput = {
        ruleId: "",
        fromVersionId: "clkv6q4a40000356h2g8h2g8i",
        changelog: "Fork with empty rule ID",
        idempotencyKey: "empty-rule-id-fork-key",
      };
      expect(() => forkVersionSchema.parse(emptyRuleIdInput)).toThrow();

      // Test empty fromVersionId
      const emptyFromVersionInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        fromVersionId: "",
        changelog: "Fork with empty from version ID",
        idempotencyKey: "empty-from-version-key",
      };
      expect(() => forkVersionSchema.parse(emptyFromVersionInput)).toThrow();
    });

    it("should require mandatory fields", () => {
      const requiredFields = ["ruleId", "fromVersionId"];

      requiredFields.forEach((field) => {
        const invalidInput = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          fromVersionId: "clkv6q4a40000356h2g8h2g8i",
          changelog: "Test fork changelog",
          idempotencyKey: "test-fork-key",
        };
        delete (invalidInput as any)[field];

        expect(() => forkVersionSchema.parse(invalidInput)).toThrow();
      });
    });
  });

  describe("listVersionsByRuleSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        cursor: "version-cursor-123",
        limit: 50,
        includeBody: true,
      };

      const result = listVersionsByRuleSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input with defaults", () => {
      const minimalInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
      };

      const result = listVersionsByRuleSchema.parse(minimalInput);
      expect(result).toEqual({
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 20, // default from paginationSchema
        includeBody: false, // default value
      });
    });

    it("should accept input without cursor", () => {
      const inputWithoutCursor = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 30,
        includeBody: true,
      };

      expect(() =>
        listVersionsByRuleSchema.parse(inputWithoutCursor)
      ).not.toThrow();
    });

    it("should accept both includeBody values", () => {
      const includeBodyValues = [true, false];

      includeBodyValues.forEach((includeBody) => {
        const input = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          includeBody,
        };
        expect(() => listVersionsByRuleSchema.parse(input)).not.toThrow();
      });
    });

    it("should use default includeBody value", () => {
      const input = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
      };

      const result = listVersionsByRuleSchema.parse(input);
      expect(result.includeBody).toBe(false);
    });

    it("should validate pagination constraints from paginationSchema", () => {
      // Test minimum limit
      const minLimitInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 1,
      };
      expect(() => listVersionsByRuleSchema.parse(minLimitInput)).not.toThrow();

      // Test maximum limit
      const maxLimitInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 100,
      };
      expect(() => listVersionsByRuleSchema.parse(maxLimitInput)).not.toThrow();

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 0,
      };
      expect(() => listVersionsByRuleSchema.parse(invalidMinInput)).toThrow();

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 101,
      };
      expect(() => listVersionsByRuleSchema.parse(invalidMaxInput)).toThrow();
    });

    it("should validate integer limit", () => {
      const invalidIntegerInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 25.5, // Should be integer
      };

      expect(() =>
        listVersionsByRuleSchema.parse(invalidIntegerInput)
      ).toThrow();
    });

    it("should validate ruleId (CUID)", () => {
      const validRuleIdInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
      };
      expect(() =>
        listVersionsByRuleSchema.parse(validRuleIdInput)
      ).not.toThrow();

      // Test empty ruleId
      const emptyRuleIdInput = {
        ruleId: "",
      };
      expect(() => listVersionsByRuleSchema.parse(emptyRuleIdInput)).toThrow();
    });

    it("should require ruleId", () => {
      const inputWithoutRuleId = {
        limit: 20,
        includeBody: true,
      };

      expect(() =>
        listVersionsByRuleSchema.parse(inputWithoutRuleId)
      ).toThrow();
    });
  });

  describe("getVersionByIdSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
        includeUserActions: true,
      };

      const result = getVersionByIdSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input with defaults", () => {
      const minimalInput = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
      };

      const result = getVersionByIdSchema.parse(minimalInput);
      expect(result).toEqual({
        versionId: "clkv6q4a40000356h2g8h2g8h",
        includeUserActions: false, // default value
      });
    });

    it("should accept both includeUserActions values", () => {
      const includeUserActionsValues = [true, false];

      includeUserActionsValues.forEach((includeUserActions) => {
        const input = {
          versionId: "clkv6q4a40000356h2g8h2g8h",
          includeUserActions,
        };
        expect(() => getVersionByIdSchema.parse(input)).not.toThrow();
      });
    });

    it("should use default includeUserActions value", () => {
      const input = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
      };

      const result = getVersionByIdSchema.parse(input);
      expect(result.includeUserActions).toBe(false);
    });

    it("should validate versionId (CUID)", () => {
      const validVersionIdInput = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
      };
      expect(() =>
        getVersionByIdSchema.parse(validVersionIdInput)
      ).not.toThrow();

      // Test empty versionId
      const emptyVersionIdInput = {
        versionId: "",
      };
      expect(() => getVersionByIdSchema.parse(emptyVersionIdInput)).toThrow();
    });

    it("should require versionId", () => {
      const inputWithoutVersionId = {
        includeUserActions: true,
      };

      expect(() => getVersionByIdSchema.parse(inputWithoutVersionId)).toThrow();
    });
  });

  describe("getVersionDiffSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        prevVersionId: "clkv6q4a40000356h2g8h2g8h",
        currVersionId: "clkv6q4a40000356h2g8h2g8i",
        format: "split" as const,
      };

      const result = getVersionDiffSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input with defaults", () => {
      const minimalInput = {
        prevVersionId: "clkv6q4a40000356h2g8h2g8h",
        currVersionId: "clkv6q4a40000356h2g8h2g8i",
      };

      const result = getVersionDiffSchema.parse(minimalInput);
      expect(result).toEqual({
        prevVersionId: "clkv6q4a40000356h2g8h2g8h",
        currVersionId: "clkv6q4a40000356h2g8h2g8i",
        format: "unified", // default value
      });
    });

    it("should accept all valid format values", () => {
      const formatValues = ["unified", "split", "json"] as const;

      formatValues.forEach((format) => {
        const input = {
          prevVersionId: "clkv6q4a40000356h2g8h2g8h",
          currVersionId: "clkv6q4a40000356h2g8h2g8i",
          format,
        };
        expect(() => getVersionDiffSchema.parse(input)).not.toThrow();
      });
    });

    it("should use default format value", () => {
      const input = {
        prevVersionId: "clkv6q4a40000356h2g8h2g8h",
        currVersionId: "clkv6q4a40000356h2g8h2g8i",
      };

      const result = getVersionDiffSchema.parse(input);
      expect(result.format).toBe("unified");
    });

    it("should reject invalid format", () => {
      const invalidFormatInput = {
        prevVersionId: "clkv6q4a40000356h2g8h2g8h",
        currVersionId: "clkv6q4a40000356h2g8h2g8i",
        format: "invalid_format",
      };

      expect(() => getVersionDiffSchema.parse(invalidFormatInput)).toThrow();
    });

    it("should validate version IDs (CUIDs)", () => {
      const validInput = {
        prevVersionId: "clkv6q4a40000356h2g8h2g8h",
        currVersionId: "clkv6q4a40000356h2g8h2g8i",
      };
      expect(() => getVersionDiffSchema.parse(validInput)).not.toThrow();

      // Test empty prevVersionId
      const emptyPrevVersionInput = {
        prevVersionId: "",
        currVersionId: "clkv6q4a40000356h2g8h2g8i",
      };
      expect(() => getVersionDiffSchema.parse(emptyPrevVersionInput)).toThrow();

      // Test empty currVersionId
      const emptyCurrVersionInput = {
        prevVersionId: "clkv6q4a40000356h2g8h2g8h",
        currVersionId: "",
      };
      expect(() => getVersionDiffSchema.parse(emptyCurrVersionInput)).toThrow();
    });

    it("should require both version IDs", () => {
      const requiredFields = ["prevVersionId", "currVersionId"];

      requiredFields.forEach((field) => {
        const invalidInput = {
          prevVersionId: "clkv6q4a40000356h2g8h2g8h",
          currVersionId: "clkv6q4a40000356h2g8h2g8i",
        };
        delete (invalidInput as any)[field];

        expect(() => getVersionDiffSchema.parse(invalidInput)).toThrow();
      });
    });
  });

  describe("updateVersionSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
        changelog: "Updated changelog with bug fixes",
        testedOn: {
          models: ["gpt-4", "claude-3-sonnet"],
          stacks: ["openai", "anthropic"],
        },
        idempotencyKey: "update-version-key-789",
      };

      const result = updateVersionSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input without optional fields", () => {
      const minimalInput = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
        changelog: "Minimal update",
        idempotencyKey: "minimal-update-key",
      };

      expect(() => updateVersionSchema.parse(minimalInput)).not.toThrow();
    });

    it("should accept input without testedOn", () => {
      const inputWithoutTestedOn = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
        changelog: "Update without testing info",
        idempotencyKey: "no-tested-on-update-key",
      };

      expect(() =>
        updateVersionSchema.parse(inputWithoutTestedOn)
      ).not.toThrow();
    });

    it("should accept input without idempotencyKey", () => {
      const inputWithoutIdempotencyKey = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
        changelog: "Update without idempotency key",
      };

      expect(() =>
        updateVersionSchema.parse(inputWithoutIdempotencyKey)
      ).not.toThrow();
    });

    it("should validate versionId (CUID)", () => {
      const validVersionIdInput = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
        changelog: "Valid update",
        idempotencyKey: "valid-version-id-key",
      };
      expect(() =>
        updateVersionSchema.parse(validVersionIdInput)
      ).not.toThrow();

      // Test empty versionId
      const emptyVersionIdInput = {
        versionId: "",
        changelog: "Update with empty version ID",
        idempotencyKey: "empty-version-id-key",
      };
      expect(() => updateVersionSchema.parse(emptyVersionIdInput)).toThrow();
    });

    it("should require mandatory fields", () => {
      const requiredFields = ["versionId"];

      requiredFields.forEach((field) => {
        const invalidInput = {
          versionId: "clkv6q4a40000356h2g8h2g8h",
          changelog: "Test changelog",
          idempotencyKey: "test-update-key",
        };
        delete (invalidInput as any)[field];

        expect(() => updateVersionSchema.parse(invalidInput)).toThrow();
      });
    });
  });

  describe("setCurrentVersionSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        versionId: "clkv6q4a40000356h2g8h2g8i",
        idempotencyKey: "set-current-version-key-101",
      };

      const result = setCurrentVersionSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept input without idempotencyKey", () => {
      const inputWithoutIdempotencyKey = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        versionId: "clkv6q4a40000356h2g8h2g8i",
      };

      expect(() =>
        setCurrentVersionSchema.parse(inputWithoutIdempotencyKey)
      ).not.toThrow();
    });

    it("should validate ruleId and versionId (CUIDs)", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        versionId: "clkv6q4a40000356h2g8h2g8i",
        idempotencyKey: "valid-ids-set-current-key",
      };
      expect(() => setCurrentVersionSchema.parse(validInput)).not.toThrow();

      // Test empty ruleId
      const emptyRuleIdInput = {
        ruleId: "",
        versionId: "clkv6q4a40000356h2g8h2g8i",
        idempotencyKey: "empty-rule-id-set-key",
      };
      expect(() => setCurrentVersionSchema.parse(emptyRuleIdInput)).toThrow();

      // Test empty versionId
      const emptyVersionIdInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        versionId: "",
        idempotencyKey: "empty-version-id-set-key",
      };
      expect(() =>
        setCurrentVersionSchema.parse(emptyVersionIdInput)
      ).toThrow();
    });

    it("should require mandatory fields", () => {
      const requiredFields = ["ruleId", "versionId"];

      requiredFields.forEach((field) => {
        const invalidInput = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          versionId: "clkv6q4a40000356h2g8h2g8i",
          idempotencyKey: "test-set-current-key",
        };
        delete (invalidInput as any)[field];

        expect(() => setCurrentVersionSchema.parse(invalidInput)).toThrow();
      });
    });
  });

  describe("getVersionHistorySchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        cursor: "history-cursor-456",
        limit: 75,
        includeStats: false,
      };

      const result = getVersionHistorySchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input with defaults", () => {
      const minimalInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
      };

      const result = getVersionHistorySchema.parse(minimalInput);
      expect(result).toEqual({
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 20, // default from paginationSchema
        includeStats: true, // default value
      });
    });

    it("should accept input without cursor", () => {
      const inputWithoutCursor = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 40,
        includeStats: false,
      };

      expect(() =>
        getVersionHistorySchema.parse(inputWithoutCursor)
      ).not.toThrow();
    });

    it("should accept both includeStats values", () => {
      const includeStatsValues = [true, false];

      includeStatsValues.forEach((includeStats) => {
        const input = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          includeStats,
        };
        expect(() => getVersionHistorySchema.parse(input)).not.toThrow();
      });
    });

    it("should use default includeStats value", () => {
      const input = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
      };

      const result = getVersionHistorySchema.parse(input);
      expect(result.includeStats).toBe(true);
    });

    it("should validate pagination constraints from paginationSchema", () => {
      // Test minimum limit
      const minLimitInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 1,
      };
      expect(() => getVersionHistorySchema.parse(minLimitInput)).not.toThrow();

      // Test maximum limit
      const maxLimitInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 100,
      };
      expect(() => getVersionHistorySchema.parse(maxLimitInput)).not.toThrow();

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 0,
      };
      expect(() => getVersionHistorySchema.parse(invalidMinInput)).toThrow();

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 101,
      };
      expect(() => getVersionHistorySchema.parse(invalidMaxInput)).toThrow();
    });

    it("should validate integer limit", () => {
      const invalidIntegerInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        limit: 35.7, // Should be integer
      };

      expect(() =>
        getVersionHistorySchema.parse(invalidIntegerInput)
      ).toThrow();
    });

    it("should validate ruleId (CUID)", () => {
      const validRuleIdInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
      };
      expect(() =>
        getVersionHistorySchema.parse(validRuleIdInput)
      ).not.toThrow();

      // Test empty ruleId
      const emptyRuleIdInput = {
        ruleId: "",
      };
      expect(() => getVersionHistorySchema.parse(emptyRuleIdInput)).toThrow();
    });

    it("should require ruleId", () => {
      const inputWithoutRuleId = {
        limit: 20,
        includeStats: true,
      };

      expect(() => getVersionHistorySchema.parse(inputWithoutRuleId)).toThrow();
    });
  });

  describe("compareVersionsSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        baseVersionId: "clkv6q4a40000356h2g8h2g8h",
        compareVersionId: "clkv6q4a40000356h2g8h2g8i",
        format: "unified" as const,
      };

      const result = compareVersionsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input with defaults", () => {
      const minimalInput = {
        baseVersionId: "clkv6q4a40000356h2g8h2g8h",
        compareVersionId: "clkv6q4a40000356h2g8h2g8i",
      };

      const result = compareVersionsSchema.parse(minimalInput);
      expect(result).toEqual({
        baseVersionId: "clkv6q4a40000356h2g8h2g8h",
        compareVersionId: "clkv6q4a40000356h2g8h2g8i",
        format: "side-by-side", // default value
      });
    });

    it("should accept all valid format values", () => {
      const formatValues = ["side-by-side", "unified", "json"] as const;

      formatValues.forEach((format) => {
        const input = {
          baseVersionId: "clkv6q4a40000356h2g8h2g8h",
          compareVersionId: "clkv6q4a40000356h2g8h2g8i",
          format,
        };
        expect(() => compareVersionsSchema.parse(input)).not.toThrow();
      });
    });

    it("should use default format value", () => {
      const input = {
        baseVersionId: "clkv6q4a40000356h2g8h2g8h",
        compareVersionId: "clkv6q4a40000356h2g8h2g8i",
      };

      const result = compareVersionsSchema.parse(input);
      expect(result.format).toBe("side-by-side");
    });

    it("should reject invalid format", () => {
      const invalidFormatInput = {
        baseVersionId: "clkv6q4a40000356h2g8h2g8h",
        compareVersionId: "clkv6q4a40000356h2g8h2g8i",
        format: "invalid_compare_format",
      };

      expect(() => compareVersionsSchema.parse(invalidFormatInput)).toThrow();
    });

    it("should validate version IDs (CUIDs)", () => {
      const validInput = {
        baseVersionId: "clkv6q4a40000356h2g8h2g8h",
        compareVersionId: "clkv6q4a40000356h2g8h2g8i",
      };
      expect(() => compareVersionsSchema.parse(validInput)).not.toThrow();

      // Test empty baseVersionId
      const emptyBaseVersionInput = {
        baseVersionId: "",
        compareVersionId: "clkv6q4a40000356h2g8h2g8i",
      };
      expect(() =>
        compareVersionsSchema.parse(emptyBaseVersionInput)
      ).toThrow();

      // Test empty compareVersionId
      const emptyCompareVersionInput = {
        baseVersionId: "clkv6q4a40000356h2g8h2g8h",
        compareVersionId: "",
      };
      expect(() =>
        compareVersionsSchema.parse(emptyCompareVersionInput)
      ).toThrow();
    });

    it("should require both version IDs", () => {
      const requiredFields = ["baseVersionId", "compareVersionId"];

      requiredFields.forEach((field) => {
        const invalidInput = {
          baseVersionId: "clkv6q4a40000356h2g8h2g8h",
          compareVersionId: "clkv6q4a40000356h2g8h2g8i",
        };
        delete (invalidInput as any)[field];

        expect(() => compareVersionsSchema.parse(invalidInput)).toThrow();
      });
    });
  });

  describe("getVersionStatsSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
        period: "month" as const,
      };

      const result = getVersionStatsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input with defaults", () => {
      const minimalInput = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
      };

      const result = getVersionStatsSchema.parse(minimalInput);
      expect(result).toEqual({
        versionId: "clkv6q4a40000356h2g8h2g8h",
        period: "week", // default value
      });
    });

    it("should accept all valid period values", () => {
      const periodValues = ["day", "week", "month", "all"] as const;

      periodValues.forEach((period) => {
        const input = {
          versionId: "clkv6q4a40000356h2g8h2g8h",
          period,
        };
        expect(() => getVersionStatsSchema.parse(input)).not.toThrow();
      });
    });

    it("should use default period value", () => {
      const input = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
      };

      const result = getVersionStatsSchema.parse(input);
      expect(result.period).toBe("week");
    });

    it("should reject invalid period", () => {
      const invalidPeriodInput = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
        period: "invalid_period",
      };

      expect(() => getVersionStatsSchema.parse(invalidPeriodInput)).toThrow();
    });

    it("should validate versionId (CUID)", () => {
      const validVersionIdInput = {
        versionId: "clkv6q4a40000356h2g8h2g8h",
      };
      expect(() =>
        getVersionStatsSchema.parse(validVersionIdInput)
      ).not.toThrow();

      // Test empty versionId
      const emptyVersionIdInput = {
        versionId: "",
      };
      expect(() => getVersionStatsSchema.parse(emptyVersionIdInput)).toThrow();
    });

    it("should require versionId", () => {
      const inputWithoutVersionId = {
        period: "month" as const,
      };

      expect(() =>
        getVersionStatsSchema.parse(inputWithoutVersionId)
      ).toThrow();
    });
  });

  describe("Type Exports", () => {
    it("should export all input types", () => {
      // Test that types are properly exported by creating variables of each type
      const createVersionInput: CreateVersionInput = {
        ruleId: "test-rule-id",
        body: "test body",
        changelog: "test changelog",
      };

      const forkVersionInput: ForkVersionInput = {
        ruleId: "test-rule-id",
        fromVersionId: "test-from-version-id",
        changelog: "test fork changelog",
      };

      const listVersionsByRuleInput: ListVersionsByRuleInput = {
        ruleId: "test-rule-id",
      };

      const getVersionByIdInput: GetVersionByIdInput = {
        versionId: "test-version-id",
      };

      const getVersionDiffInput: GetVersionDiffInput = {
        prevVersionId: "test-prev-version-id",
        currVersionId: "test-curr-version-id",
      };

      const updateVersionInput: UpdateVersionInput = {
        versionId: "test-version-id",
        changelog: "test update changelog",
      };

      const setCurrentVersionInput: SetCurrentVersionInput = {
        ruleId: "test-rule-id",
        versionId: "test-version-id",
      };

      const getVersionHistoryInput: GetVersionHistoryInput = {
        ruleId: "test-rule-id",
      };

      const compareVersionsInput: CompareVersionsInput = {
        baseVersionId: "test-base-version-id",
        compareVersionId: "test-compare-version-id",
      };

      const getVersionStatsInput: GetVersionStatsInput = {
        versionId: "test-version-id",
      };

      expect(createVersionInput).toBeDefined();
      expect(forkVersionInput).toBeDefined();
      expect(listVersionsByRuleInput).toBeDefined();
      expect(getVersionByIdInput).toBeDefined();
      expect(getVersionDiffInput).toBeDefined();
      expect(updateVersionInput).toBeDefined();
      expect(setCurrentVersionInput).toBeDefined();
      expect(getVersionHistoryInput).toBeDefined();
      expect(compareVersionsInput).toBeDefined();
      expect(getVersionStatsInput).toBeDefined();
    });
  });

  describe("Edge Cases and Integration", () => {
    it("should handle complex version management scenarios", () => {
      // Complex create version scenario
      const complexCreateInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        baseVersionId: "clkv6q4a40000356h2g8h2g8i",
        body: "This is a comprehensive rule body that demonstrates the full capabilities of the version system. It includes detailed instructions, examples, and edge cases that need to be handled properly.",
        changelog:
          "Major version update with significant improvements:\n- Enhanced error handling\n- Better performance optimizations\n- Added support for new model types\n- Fixed critical bugs from previous version\n- Updated documentation and examples",
        testedOn: {
          models: [
            "gpt-4",
            "gpt-4-turbo",
            "claude-3-opus",
            "claude-3-sonnet",
            "claude-3-haiku",
          ],
          stacks: ["openai", "anthropic", "azure-openai"],
        },
        version: "2.1.0",
        idempotencyKey: "complex-create-version-key-with-timestamp-123456789",
      };
      expect(() => createVersionSchema.parse(complexCreateInput)).not.toThrow();

      // Complex fork version scenario
      const complexForkInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8j",
        fromVersionId: "clkv6q4a40000356h2g8h2g8h",
        newBody:
          "Forked version with specialized modifications for specific use case. This fork addresses unique requirements that differ from the original rule while maintaining compatibility with the core functionality.",
        changelog:
          "Forked from version 2.1.0 with the following changes:\n- Specialized for financial domain\n- Added compliance checks\n- Modified output format\n- Enhanced security measures",
        testedOn: {
          models: ["gpt-4", "claude-3-opus"],
          stacks: ["openai", "anthropic"],
        },
        idempotencyKey: "complex-fork-version-key-with-domain-specific-id",
      };
      expect(() => forkVersionSchema.parse(complexForkInput)).not.toThrow();
    });

    it("should handle boundary values for all constraints", () => {
      // Test pagination boundaries
      const paginationBoundaries = [
        { limit: 1 }, // Minimum
        { limit: 100 }, // Maximum
      ];

      paginationBoundaries.forEach((bounds) => {
        const listInput = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          ...bounds,
        };
        expect(() => listVersionsByRuleSchema.parse(listInput)).not.toThrow();

        const historyInput = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          ...bounds,
        };
        expect(() => getVersionHistorySchema.parse(historyInput)).not.toThrow();
      });

      // Test all enum values
      const diffFormats = ["unified", "split", "json"] as const;
      diffFormats.forEach((format) => {
        const diffInput = {
          prevVersionId: "clkv6q4a40000356h2g8h2g8h",
          currVersionId: "clkv6q4a40000356h2g8h2g8i",
          format,
        };
        expect(() => getVersionDiffSchema.parse(diffInput)).not.toThrow();
      });

      const compareFormats = ["side-by-side", "unified", "json"] as const;
      compareFormats.forEach((format) => {
        const compareInput = {
          baseVersionId: "clkv6q4a40000356h2g8h2g8h",
          compareVersionId: "clkv6q4a40000356h2g8h2g8i",
          format,
        };
        expect(() => compareVersionsSchema.parse(compareInput)).not.toThrow();
      });

      const periods = ["day", "week", "month", "all"] as const;
      periods.forEach((period) => {
        const statsInput = {
          versionId: "clkv6q4a40000356h2g8h2g8h",
          period,
        };
        expect(() => getVersionStatsSchema.parse(statsInput)).not.toThrow();
      });
    });

    it("should handle comprehensive version workflow", () => {
      // 1. Create initial version
      const createInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        body: "Initial rule body",
        changelog: "Initial version",
        version: "1.0.0",
        idempotencyKey: "workflow-create-key",
      };
      expect(() => createVersionSchema.parse(createInput)).not.toThrow();

      // 2. List versions for the rule
      const listInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        includeBody: true,
        limit: 50,
      };
      expect(() => listVersionsByRuleSchema.parse(listInput)).not.toThrow();

      // 3. Get specific version details
      const getByIdInput = {
        versionId: "clkv6q4a40000356h2g8h2g8i",
        includeUserActions: true,
      };
      expect(() => getVersionByIdSchema.parse(getByIdInput)).not.toThrow();

      // 4. Create a fork
      const forkInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8j",
        fromVersionId: "clkv6q4a40000356h2g8h2g8i",
        changelog: "Forked for customization",
        idempotencyKey: "workflow-fork-key",
      };
      expect(() => forkVersionSchema.parse(forkInput)).not.toThrow();

      // 5. Update version metadata
      const updateInput = {
        versionId: "clkv6q4a40000356h2g8h2g8i",
        changelog: "Updated changelog with additional details",
        testedOn: {
          models: ["gpt-4"],
          stacks: ["openai"],
        },
        idempotencyKey: "workflow-update-key",
      };
      expect(() => updateVersionSchema.parse(updateInput)).not.toThrow();

      // 6. Set as current version
      const setCurrentInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        versionId: "clkv6q4a40000356h2g8h2g8i",
        idempotencyKey: "workflow-set-current-key",
      };
      expect(() =>
        setCurrentVersionSchema.parse(setCurrentInput)
      ).not.toThrow();

      // 7. Get version history
      const historyInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        includeStats: true,
        limit: 25,
      };
      expect(() => getVersionHistorySchema.parse(historyInput)).not.toThrow();

      // 8. Compare versions
      const compareInput = {
        baseVersionId: "clkv6q4a40000356h2g8h2g8h",
        compareVersionId: "clkv6q4a40000356h2g8h2g8i",
        format: "side-by-side" as const,
      };
      expect(() => compareVersionsSchema.parse(compareInput)).not.toThrow();

      // 9. Get version diff
      const diffInput = {
        prevVersionId: "clkv6q4a40000356h2g8h2g8h",
        currVersionId: "clkv6q4a40000356h2g8h2g8i",
        format: "unified" as const,
      };
      expect(() => getVersionDiffSchema.parse(diffInput)).not.toThrow();

      // 10. Get version stats
      const statsInput = {
        versionId: "clkv6q4a40000356h2g8h2g8i",
        period: "month" as const,
      };
      expect(() => getVersionStatsSchema.parse(statsInput)).not.toThrow();
    });

    it("should handle edge cases for optional fields", () => {
      // Test all optional field combinations for createVersion
      const createVariations = [
        {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          body: "Test body",
          changelog: "Test changelog",
        }, // Only required fields
        {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          body: "Test body",
          changelog: "Test changelog",
          baseVersionId: "clkv6q4a40000356h2g8h2g8i",
        }, // With baseVersionId
        {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          body: "Test body",
          changelog: "Test changelog",
          version: "2.0.0",
        }, // With version
        {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          body: "Test body",
          changelog: "Test changelog",
          testedOn: {
            models: ["gpt-4"],
            stacks: ["openai"],
          },
        }, // With testedOn
      ];

      createVariations.forEach((variation) => {
        expect(() => createVersionSchema.parse(variation)).not.toThrow();
      });

      // Test optional field combinations for forkVersion
      const forkVariations = [
        {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          fromVersionId: "clkv6q4a40000356h2g8h2g8i",
          changelog: "Fork changelog",
        }, // Only required fields
        {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          fromVersionId: "clkv6q4a40000356h2g8h2g8i",
          changelog: "Fork changelog",
          newBody: "New forked body",
        }, // With newBody
        {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          fromVersionId: "clkv6q4a40000356h2g8h2g8i",
          changelog: "Fork changelog",
          testedOn: {
            models: ["claude-3"],
            stacks: ["anthropic"],
          },
        }, // With testedOn
      ];

      forkVariations.forEach((variation) => {
        expect(() => forkVersionSchema.parse(variation)).not.toThrow();
      });

      // Test boolean default variations
      const booleanVariations = [
        { includeBody: true },
        { includeBody: false },
        { includeUserActions: true },
        { includeUserActions: false },
        { includeStats: true },
        { includeStats: false },
      ];

      booleanVariations.forEach((variation) => {
        if ("includeBody" in variation) {
          const input = {
            ruleId: "clkv6q4a40000356h2g8h2g8h",
            ...variation,
          };
          expect(() => listVersionsByRuleSchema.parse(input)).not.toThrow();
        }
        if ("includeUserActions" in variation) {
          const input = {
            versionId: "clkv6q4a40000356h2g8h2g8h",
            ...variation,
          };
          expect(() => getVersionByIdSchema.parse(input)).not.toThrow();
        }
        if ("includeStats" in variation) {
          const input = {
            ruleId: "clkv6q4a40000356h2g8h2g8h",
            ...variation,
          };
          expect(() => getVersionHistorySchema.parse(input)).not.toThrow();
        }
      });
    });

    it("should handle various valid CUID patterns", () => {
      const validCuidVariations = [
        "clkv6q4a40000356h2g8h2g8h", // Standard CUID
        "clkv6q4a40000356h2g8h2g8i", // Different CUID
        "clkv6q4a40000356h2g8h2g8j", // Another CUID
        "clkv6q4a40000356h2g8h2g8k", // Yet another CUID
      ];

      validCuidVariations.forEach((id) => {
        // Test in various schemas that use CUID validation
        const createInput = {
          ruleId: id,
          body: "Test body",
          changelog: "Test changelog",
        };
        expect(() => createVersionSchema.parse(createInput)).not.toThrow();

        const getByIdInput = {
          versionId: id,
        };
        expect(() => getVersionByIdSchema.parse(getByIdInput)).not.toThrow();

        const statsInput = {
          versionId: id,
        };
        expect(() => getVersionStatsSchema.parse(statsInput)).not.toThrow();
      });
    });
  });
});
