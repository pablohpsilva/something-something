import { describe, it, expect } from "vitest";
import {
  submitClaimSchema,
  reviewClaimSchema,
  listMyClaimsSchema,
  listClaimsForReviewSchema,
  getClaimByIdSchema,
  assignClaimSchema,
  getClaimsByRuleSchema,
  type SubmitClaimInput,
  type ReviewClaimInput,
  type ListMyClaimsInput,
  type ListClaimsForReviewInput,
  type GetClaimByIdInput,
  type AssignClaimInput,
  type GetClaimsByRuleInput,
} from "./claims";

describe("Claims Schemas", () => {
  describe("submitClaimSchema", () => {
    it("should accept valid claim submission", () => {
      const validClaim = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        evidenceUrl: "https://example.com/evidence",
        description: "This is my evidence for claiming this rule",
        idempotencyKey: "claim-key-123",
      };

      const result = submitClaimSchema.parse(validClaim);
      expect(result).toEqual(validClaim);
    });

    it("should accept claim without evidence URL", () => {
      const validClaim = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        description: "This is my evidence for claiming this rule",
        idempotencyKey: "claim-key-123",
      };

      const result = submitClaimSchema.parse(validClaim);
      expect(result).toEqual(validClaim);
    });

    it("should accept claim without idempotency key", () => {
      const validClaim = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        description: "This is my evidence for claiming this rule",
      };

      const result = submitClaimSchema.parse(validClaim);
      expect(result).toEqual(validClaim);
    });

    it("should reject invalid rule ID", () => {
      expect(() =>
        submitClaimSchema.parse({
          ruleId: "invalid-id",
          description: "This is my evidence for claiming this rule",
        })
      ).toThrow();
    });

    it("should reject invalid evidence URL", () => {
      expect(() =>
        submitClaimSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          evidenceUrl: "not-a-url",
          description: "This is my evidence for claiming this rule",
        })
      ).toThrow();
    });

    it("should reject description that's too short", () => {
      expect(() =>
        submitClaimSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          description: "Too short",
        })
      ).toThrow();
    });

    it("should reject description that's too long", () => {
      expect(() =>
        submitClaimSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          description: "a".repeat(1001),
        })
      ).toThrow();
    });

    it("should accept description at minimum length", () => {
      const validClaim = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        description: "a".repeat(10), // Exactly 10 characters
      };

      expect(() => submitClaimSchema.parse(validClaim)).not.toThrow();
    });

    it("should accept description at maximum length", () => {
      const validClaim = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        description: "a".repeat(1000), // Exactly 1000 characters
      };

      expect(() => submitClaimSchema.parse(validClaim)).not.toThrow();
    });

    it("should reject missing required fields", () => {
      expect(() => submitClaimSchema.parse({})).toThrow();

      expect(() =>
        submitClaimSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
        })
      ).toThrow(); // Missing description

      expect(() =>
        submitClaimSchema.parse({
          description: "This is my evidence for claiming this rule",
        })
      ).toThrow(); // Missing ruleId
    });

    it("should have correct TypeScript type", () => {
      const claim: SubmitClaimInput = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        description: "This is my evidence for claiming this rule",
        evidenceUrl: "https://example.com/evidence",
        idempotencyKey: "claim-key-123",
      };

      expect(submitClaimSchema.parse(claim)).toEqual(claim);
    });
  });

  describe("reviewClaimSchema", () => {
    it("should accept valid claim review with approval", () => {
      const validReview = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
        verdict: "APPROVED" as const,
        note: "Evidence is sufficient",
        idempotencyKey: "review-key-123",
      };

      const result = reviewClaimSchema.parse(validReview);
      expect(result).toEqual(validReview);
    });

    it("should accept valid claim review with rejection", () => {
      const validReview = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
        verdict: "REJECTED" as const,
        note: "Evidence is insufficient",
        idempotencyKey: "review-key-123",
      };

      const result = reviewClaimSchema.parse(validReview);
      expect(result).toEqual(validReview);
    });

    it("should accept review without note", () => {
      const validReview = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
        verdict: "APPROVED" as const,
        idempotencyKey: "review-key-123",
      };

      const result = reviewClaimSchema.parse(validReview);
      expect(result).toEqual(validReview);
    });

    it("should accept review without idempotency key", () => {
      const validReview = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
        verdict: "APPROVED" as const,
      };

      const result = reviewClaimSchema.parse(validReview);
      expect(result).toEqual(validReview);
    });

    it("should reject invalid claim ID", () => {
      expect(() =>
        reviewClaimSchema.parse({
          claimId: "invalid-id",
          verdict: "APPROVED",
        })
      ).toThrow();
    });

    it("should reject invalid verdict", () => {
      expect(() =>
        reviewClaimSchema.parse({
          claimId: "clkv6tv5l0001l608w5i10wd7",
          verdict: "INVALID",
        })
      ).toThrow();

      expect(() =>
        reviewClaimSchema.parse({
          claimId: "clkv6tv5l0001l608w5i10wd7",
          verdict: "approved", // lowercase
        })
      ).toThrow();
    });

    it("should reject note that's too long", () => {
      expect(() =>
        reviewClaimSchema.parse({
          claimId: "clkv6tv5l0001l608w5i10wd7",
          verdict: "APPROVED",
          note: "a".repeat(1001),
        })
      ).toThrow();
    });

    it("should accept note at maximum length", () => {
      const validReview = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
        verdict: "APPROVED" as const,
        note: "a".repeat(1000), // Exactly 1000 characters
      };

      expect(() => reviewClaimSchema.parse(validReview)).not.toThrow();
    });

    it("should accept empty note", () => {
      const validReview = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
        verdict: "APPROVED" as const,
        note: "",
      };

      expect(() => reviewClaimSchema.parse(validReview)).not.toThrow();
    });

    it("should reject missing required fields", () => {
      expect(() => reviewClaimSchema.parse({})).toThrow();

      expect(() =>
        reviewClaimSchema.parse({
          claimId: "clkv6tv5l0001l608w5i10wd7",
        })
      ).toThrow(); // Missing verdict

      expect(() =>
        reviewClaimSchema.parse({
          verdict: "APPROVED",
        })
      ).toThrow(); // Missing claimId
    });

    it("should have correct TypeScript type", () => {
      const review: ReviewClaimInput = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
        verdict: "APPROVED",
        note: "Evidence is sufficient",
        idempotencyKey: "review-key-123",
      };

      expect(reviewClaimSchema.parse(review)).toEqual(review);
    });
  });

  describe("listMyClaimsSchema", () => {
    it("should accept valid list request with all parameters", () => {
      const validRequest = {
        cursor: "cursor-123",
        limit: 50,
        status: "PENDING" as const,
        sort: "new" as const,
      };

      const result = listMyClaimsSchema.parse(validRequest);
      expect(result).toEqual(validRequest);
    });

    it("should use default values", () => {
      const result = listMyClaimsSchema.parse({});
      expect(result).toEqual({
        limit: 20, // Default from paginationSchema
        sort: "new", // Default
      });
    });

    it("should accept partial parameters", () => {
      const validRequest = {
        limit: 10,
        status: "APPROVED" as const,
      };

      const result = listMyClaimsSchema.parse(validRequest);
      expect(result).toEqual({
        limit: 10,
        status: "APPROVED",
        sort: "new", // Default
      });
    });

    it("should accept all valid status values", () => {
      const statuses = ["PENDING", "APPROVED", "REJECTED"] as const;

      statuses.forEach((status) => {
        const result = listMyClaimsSchema.parse({ status });
        expect(result.status).toBe(status);
      });
    });

    it("should accept all valid sort values", () => {
      const sorts = ["new", "old"] as const;

      sorts.forEach((sort) => {
        const result = listMyClaimsSchema.parse({ sort });
        expect(result.sort).toBe(sort);
      });
    });

    it("should reject invalid status", () => {
      expect(() =>
        listMyClaimsSchema.parse({
          status: "INVALID",
        })
      ).toThrow();
    });

    it("should reject invalid sort", () => {
      expect(() =>
        listMyClaimsSchema.parse({
          sort: "invalid",
        })
      ).toThrow();

      expect(() =>
        listMyClaimsSchema.parse({
          sort: "priority", // Not available for user claims
        })
      ).toThrow();
    });

    it("should validate pagination parameters", () => {
      expect(() =>
        listMyClaimsSchema.parse({
          limit: 0,
        })
      ).toThrow();

      expect(() =>
        listMyClaimsSchema.parse({
          limit: 101,
        })
      ).toThrow();
    });

    it("should have correct TypeScript type", () => {
      const request: ListMyClaimsInput = {
        cursor: "cursor-123",
        limit: 25,
        status: "PENDING",
        sort: "old",
      };

      expect(listMyClaimsSchema.parse(request)).toEqual(request);
    });
  });

  describe("listClaimsForReviewSchema", () => {
    it("should accept valid list request with all parameters", () => {
      const validRequest = {
        cursor: "cursor-123",
        limit: 50,
        status: "PENDING" as const,
        sort: "priority" as const,
        assignedToMe: true,
      };

      const result = listClaimsForReviewSchema.parse(validRequest);
      expect(result).toEqual(validRequest);
    });

    it("should use default values", () => {
      const result = listClaimsForReviewSchema.parse({});
      expect(result).toEqual({
        limit: 20, // Default from paginationSchema
        sort: "new", // Default
        assignedToMe: false, // Default
      });
    });

    it("should accept partial parameters", () => {
      const validRequest = {
        limit: 10,
        assignedToMe: true,
      };

      const result = listClaimsForReviewSchema.parse(validRequest);
      expect(result).toEqual({
        limit: 10,
        sort: "new", // Default
        assignedToMe: true,
      });
    });

    it("should accept all valid status values", () => {
      const statuses = ["PENDING", "APPROVED", "REJECTED"] as const;

      statuses.forEach((status) => {
        const result = listClaimsForReviewSchema.parse({ status });
        expect(result.status).toBe(status);
      });
    });

    it("should accept all valid sort values", () => {
      const sorts = ["new", "old", "priority"] as const;

      sorts.forEach((sort) => {
        const result = listClaimsForReviewSchema.parse({ sort });
        expect(result.sort).toBe(sort);
      });
    });

    it("should accept both assignedToMe values", () => {
      expect(listClaimsForReviewSchema.parse({ assignedToMe: true })).toEqual({
        limit: 20,
        sort: "new",
        assignedToMe: true,
      });

      expect(listClaimsForReviewSchema.parse({ assignedToMe: false })).toEqual({
        limit: 20,
        sort: "new",
        assignedToMe: false,
      });
    });

    it("should reject invalid status", () => {
      expect(() =>
        listClaimsForReviewSchema.parse({
          status: "INVALID",
        })
      ).toThrow();
    });

    it("should reject invalid sort", () => {
      expect(() =>
        listClaimsForReviewSchema.parse({
          sort: "invalid",
        })
      ).toThrow();
    });

    it("should reject invalid assignedToMe", () => {
      expect(() =>
        listClaimsForReviewSchema.parse({
          assignedToMe: "true", // String instead of boolean
        })
      ).toThrow();
    });

    it("should validate pagination parameters", () => {
      expect(() =>
        listClaimsForReviewSchema.parse({
          limit: 0,
        })
      ).toThrow();

      expect(() =>
        listClaimsForReviewSchema.parse({
          limit: 101,
        })
      ).toThrow();
    });

    it("should have correct TypeScript type", () => {
      const request: ListClaimsForReviewInput = {
        cursor: "cursor-123",
        limit: 25,
        status: "PENDING",
        sort: "priority",
        assignedToMe: true,
      };

      expect(listClaimsForReviewSchema.parse(request)).toEqual(request);
    });
  });

  describe("getClaimByIdSchema", () => {
    it("should accept valid claim ID", () => {
      const validRequest = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
      };

      const result = getClaimByIdSchema.parse(validRequest);
      expect(result).toEqual(validRequest);
    });

    it("should reject invalid claim ID", () => {
      expect(() =>
        getClaimByIdSchema.parse({
          claimId: "invalid-id",
        })
      ).toThrow();
    });

    it("should reject missing claim ID", () => {
      expect(() => getClaimByIdSchema.parse({})).toThrow();
    });

    it("should have correct TypeScript type", () => {
      const request: GetClaimByIdInput = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
      };

      expect(getClaimByIdSchema.parse(request)).toEqual(request);
    });
  });

  describe("assignClaimSchema", () => {
    it("should accept valid assignment", () => {
      const validAssignment = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
        reviewerId: "reviewer-user-id",
        idempotencyKey: "assign-key-123",
      };

      const result = assignClaimSchema.parse(validAssignment);
      expect(result).toEqual(validAssignment);
    });

    it("should accept assignment without idempotency key", () => {
      const validAssignment = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
        reviewerId: "reviewer-user-id",
      };

      const result = assignClaimSchema.parse(validAssignment);
      expect(result).toEqual(validAssignment);
    });

    it("should reject invalid claim ID", () => {
      expect(() =>
        assignClaimSchema.parse({
          claimId: "invalid-id",
          reviewerId: "reviewer-user-id",
        })
      ).toThrow();
    });

    it("should reject missing required fields", () => {
      expect(() => assignClaimSchema.parse({})).toThrow();

      expect(() =>
        assignClaimSchema.parse({
          claimId: "clkv6tv5l0001l608w5i10wd7",
        })
      ).toThrow(); // Missing reviewerId

      expect(() =>
        assignClaimSchema.parse({
          reviewerId: "reviewer-user-id",
        })
      ).toThrow(); // Missing claimId
    });

    it("should accept any string as reviewerId", () => {
      const validAssignment = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
        reviewerId: "any-string-id",
      };

      expect(() => assignClaimSchema.parse(validAssignment)).not.toThrow();
    });

    it("should accept empty reviewerId", () => {
      // Note: The schema only validates that reviewerId is a string, not that it's non-empty
      expect(() =>
        assignClaimSchema.parse({
          claimId: "clkv6tv5l0001l608w5i10wd7",
          reviewerId: "",
        })
      ).not.toThrow();
    });

    it("should have correct TypeScript type", () => {
      const assignment: AssignClaimInput = {
        claimId: "clkv6tv5l0001l608w5i10wd7",
        reviewerId: "reviewer-user-id",
        idempotencyKey: "assign-key-123",
      };

      expect(assignClaimSchema.parse(assignment)).toEqual(assignment);
    });
  });

  describe("getClaimsByRuleSchema", () => {
    it("should accept valid request with all parameters", () => {
      const validRequest = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        cursor: "cursor-123",
        limit: 50,
        status: "APPROVED" as const,
      };

      const result = getClaimsByRuleSchema.parse(validRequest);
      expect(result).toEqual(validRequest);
    });

    it("should accept minimal request", () => {
      const validRequest = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
      };

      const result = getClaimsByRuleSchema.parse(validRequest);
      expect(result).toEqual({
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        limit: 20, // Default from paginationSchema
      });
    });

    it("should accept partial parameters", () => {
      const validRequest = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        limit: 10,
        status: "PENDING" as const,
      };

      const result = getClaimsByRuleSchema.parse(validRequest);
      expect(result).toEqual(validRequest);
    });

    it("should accept all valid status values", () => {
      const statuses = ["PENDING", "APPROVED", "REJECTED"] as const;

      statuses.forEach((status) => {
        const result = getClaimsByRuleSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          status,
        });
        expect(result.status).toBe(status);
      });
    });

    it("should reject invalid rule ID", () => {
      expect(() =>
        getClaimsByRuleSchema.parse({
          ruleId: "invalid-id",
        })
      ).toThrow();
    });

    it("should reject invalid status", () => {
      expect(() =>
        getClaimsByRuleSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          status: "INVALID",
        })
      ).toThrow();
    });

    it("should reject missing rule ID", () => {
      expect(() => getClaimsByRuleSchema.parse({})).toThrow();
    });

    it("should validate pagination parameters", () => {
      expect(() =>
        getClaimsByRuleSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          limit: 0,
        })
      ).toThrow();

      expect(() =>
        getClaimsByRuleSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          limit: 101,
        })
      ).toThrow();
    });

    it("should have correct TypeScript type", () => {
      const request: GetClaimsByRuleInput = {
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        cursor: "cursor-123",
        limit: 25,
        status: "APPROVED",
      };

      expect(getClaimsByRuleSchema.parse(request)).toEqual(request);
    });
  });

  describe("Schema Integration", () => {
    it("should work with complex nested validation", () => {
      // Test that schemas compose well together
      const claimSubmission = submitClaimSchema.parse({
        ruleId: "clkv6tv5l0001l608w5i10wd7",
        description: "I am the original author of this rule",
        evidenceUrl: "https://github.com/user/repo/commit/abc123",
        idempotencyKey: "unique-submission-key",
      });

      const claimReview = reviewClaimSchema.parse({
        claimId: "clkv6tv5l0001l608w5i10wd8",
        verdict: "APPROVED",
        note: "Evidence verified successfully",
        idempotencyKey: "unique-review-key",
      });

      expect(claimSubmission.ruleId).toBe("clkv6tv5l0001l608w5i10wd7");
      expect(claimReview.verdict).toBe("APPROVED");
    });

    it("should handle edge cases consistently", () => {
      // Test boundary conditions across schemas
      const minDescription = "a".repeat(10);
      const maxDescription = "a".repeat(1000);
      const maxNote = "a".repeat(1000);

      expect(() =>
        submitClaimSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          description: minDescription,
        })
      ).not.toThrow();

      expect(() =>
        submitClaimSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          description: maxDescription,
        })
      ).not.toThrow();

      expect(() =>
        reviewClaimSchema.parse({
          claimId: "clkv6tv5l0001l608w5i10wd7",
          verdict: "APPROVED",
          note: maxNote,
        })
      ).not.toThrow();
    });

    it("should validate CUID consistency", () => {
      const validCuid = "clkv6tv5l0001l608w5i10wd7";

      // All schemas should accept the same valid CUID format
      expect(() =>
        submitClaimSchema.parse({
          ruleId: validCuid,
          description: "Valid description",
        })
      ).not.toThrow();

      expect(() =>
        reviewClaimSchema.parse({
          claimId: validCuid,
          verdict: "APPROVED",
        })
      ).not.toThrow();

      expect(() =>
        getClaimByIdSchema.parse({
          claimId: validCuid,
        })
      ).not.toThrow();

      expect(() =>
        assignClaimSchema.parse({
          claimId: validCuid,
          reviewerId: "reviewer-id",
        })
      ).not.toThrow();

      expect(() =>
        getClaimsByRuleSchema.parse({
          ruleId: validCuid,
        })
      ).not.toThrow();
    });

    it("should handle pagination consistently", () => {
      const paginationParams = {
        cursor: "test-cursor",
        limit: 50,
      };

      // All list schemas should handle pagination the same way
      expect(() => listMyClaimsSchema.parse(paginationParams)).not.toThrow();

      expect(() =>
        listClaimsForReviewSchema.parse(paginationParams)
      ).not.toThrow();

      expect(() =>
        getClaimsByRuleSchema.parse({
          ruleId: "clkv6tv5l0001l608w5i10wd7",
          ...paginationParams,
        })
      ).not.toThrow();
    });

    it("should handle status filtering consistently", () => {
      const statuses = ["PENDING", "APPROVED", "REJECTED"] as const;

      statuses.forEach((status) => {
        // All schemas with status filtering should accept the same values
        expect(() => listMyClaimsSchema.parse({ status })).not.toThrow();

        expect(() => listClaimsForReviewSchema.parse({ status })).not.toThrow();

        expect(() =>
          getClaimsByRuleSchema.parse({
            ruleId: "clkv6tv5l0001l608w5i10wd7",
            status,
          })
        ).not.toThrow();
      });
    });
  });
});
