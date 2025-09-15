import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";

// Mock all dependencies first
const mockLimit = vi.fn();
const mockHashIp = vi.fn();
const mockHashUA = vi.fn();
const mockExtractIp = vi.fn();
const mockExtractUA = vi.fn();
const mockAuditLog = vi.fn();
const mockGetRateLimit = vi.fn();

// Mock modules
vi.mock("@repo/utils/rate-limit", () => ({
  limit: mockLimit,
}));

vi.mock("@repo/utils/crypto", () => ({
  hashIp: mockHashIp,
  hashUA: mockHashUA,
  extractIp: mockExtractIp,
  extractUA: mockExtractUA,
}));

vi.mock("../../services/audit-log", () => ({
  AuditLog: {
    log: mockAuditLog,
  },
}));

vi.mock("@repo/config", () => ({
  AbuseConfig: {
    salts: {
      ip: "test-ip-salt",
      ua: "test-ua-salt",
    },
    audit: {
      logRateLimits: true,
    },
    shadowBan: {
      enabled: true,
      userIds: ["shadow-banned-user"],
    },
  },
  getRateLimit: mockGetRateLimit,
}));

// Mock tRPC middleware - return the middleware function directly for testing
const mockMiddleware = vi.fn().mockImplementation((fn) => {
  return {
    _middlewares: [fn],
    unstable_pipe: vi.fn(),
    // Add the middleware function as a property for testing
    _testMiddleware: fn,
  };
});

vi.mock("../../trpc", () => ({
  middleware: mockMiddleware,
}));

describe("Rate Limit Middleware", () => {
  const mockNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the middleware mock implementation
    mockMiddleware.mockImplementation((fn) => {
      return {
        _middlewares: [fn],
        unstable_pipe: vi.fn(),
        _testMiddleware: fn,
      };
    });

    mockNext.mockResolvedValue({ result: "success" });
    mockHashIp.mockReturnValue("hashed-ip");
    mockHashUA.mockReturnValue("hashed-ua");
    mockExtractIp.mockReturnValue("192.168.1.1");
    mockExtractUA.mockReturnValue("Mozilla/5.0");
    mockAuditLog.mockResolvedValue(undefined);
    mockGetRateLimit.mockReturnValue({ limit: 10, windowMs: 60000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("withRateLimit", () => {
    it("should allow request when rate limit is not exceeded", async () => {
      // Import after mocks are set up
      const { withRateLimit } = await import("../rate-limit");

      mockLimit.mockResolvedValue({
        ok: true,
        remaining: 5,
        resetMs: 30000,
      });

      // Create the middleware and get the function directly
      const middlewareObj = withRateLimit("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      // Call the captured middleware function directly
      const result = await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "mutation",
      });

      // The middleware should call next with enhanced context
      expect(mockNext).toHaveBeenCalledWith({
        ctx: expect.objectContaining({
          rateLimit: {
            bucket: "commentsPerUserPerMin",
            remaining: 5,
            resetMs: 30000,
          },
        }),
      });

      // The result should be what mockNext returns
      expect(result).toEqual({ result: "success" });
    });

    it("should throw TRPCError when rate limit is exceeded", async () => {
      const { withRateLimit } = await import("../rate-limit");

      mockLimit.mockResolvedValue({
        ok: false,
        retryAfterMs: 30000,
        resetMs: 30000,
      });

      const middlewareObj = withRateLimit("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await expect(
        middlewareFunction({
          ctx,
          next: mockNext,
          path: "test.path",
          type: "mutation",
        })
      ).rejects.toThrow(TRPCError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should log rate limit violation when audit logging is enabled", async () => {
      const { withRateLimit } = await import("../rate-limit");

      mockLimit.mockResolvedValue({
        ok: false,
        retryAfterMs: 30000,
        resetMs: 30000,
      });

      const middlewareObj = withRateLimit("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await expect(
        middlewareFunction({
          ctx,
          next: mockNext,
          path: "test.path",
          type: "mutation",
        })
      ).rejects.toThrow(TRPCError);

      expect(mockAuditLog).toHaveBeenCalledWith({
        action: "abuse.ratelimit",
        targetType: "RateLimit",
        actorId: "user-1",
        targetId: "commentsPerUserPerMin",
        metadata: expect.objectContaining({
          bucket: "commentsPerUserPerMin",
          path: "test.path",
          type: "mutation",
          retryAfterMs: 30000,
          ipHash: "hashed-ip",
          uaHash: "hashed-ua",
        }),
      });
    });

    it("should handle missing headers gracefully", async () => {
      const { withRateLimit } = await import("../rate-limit");

      mockLimit.mockResolvedValue({
        ok: true,
        remaining: 5,
        resetMs: 30000,
      });

      const middlewareObj = withRateLimit("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {},
      };

      await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "mutation",
      });

      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle unauthenticated users", async () => {
      const { withRateLimit } = await import("../rate-limit");

      mockLimit.mockResolvedValue({
        ok: true,
        remaining: 5,
        resetMs: 30000,
      });

      const middlewareObj = withRateLimit("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: null,
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "mutation",
      });

      expect(mockLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: undefined,
        }),
        expect.any(Object)
      );
    });

    it("should fail open on middleware errors", async () => {
      const { withRateLimit } = await import("../rate-limit");

      mockLimit.mockRejectedValue(new Error("Redis connection failed"));
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const middlewareObj = withRateLimit("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      const result = await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "mutation",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Rate limit middleware error:",
        expect.any(Error)
      );
      expect(mockNext).toHaveBeenCalledWith();
      expect(result).toEqual({ result: "success" });

      consoleSpy.mockRestore();
    });

    it("should re-throw TRPCErrors without modification", async () => {
      const { withRateLimit } = await import("../rate-limit");

      const tRPCError = new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Test error",
      });
      mockLimit.mockRejectedValue(tRPCError);

      const middlewareObj = withRateLimit("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await expect(
        middlewareFunction({
          ctx,
          next: mockNext,
          path: "test.path",
          type: "mutation",
        })
      ).rejects.toThrow(tRPCError);
    });
  });

  describe("withIPRateLimit", () => {
    it("should allow request for authenticated user", async () => {
      const { withIPRateLimit } = await import("../rate-limit");

      mockLimit.mockResolvedValue({
        ok: true,
        remaining: 5,
        resetMs: 30000,
      });

      const middlewareObj = withIPRateLimit("searchPerIpPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "query",
      });

      expect(mockLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          uaHash: "hashed-ua",
        }),
        expect.objectContaining({ weight: 1 })
      );
    });

    it("should not use UA hash for unauthenticated users", async () => {
      const { withIPRateLimit } = await import("../rate-limit");

      mockLimit.mockResolvedValue({
        ok: true,
        remaining: 5,
        resetMs: 30000,
      });

      const middlewareObj = withIPRateLimit("searchPerIpPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: null,
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "query",
      });

      expect(mockLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: undefined,
          uaHash: undefined,
        }),
        expect.any(Object)
      );
    });

    it("should throw UNAUTHORIZED when auth is required but user is not authenticated", async () => {
      const { withIPRateLimit } = await import("../rate-limit");

      const middlewareObj = withIPRateLimit("searchPerIpPerMin", {
        requireAuth: true,
      });
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: null,
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await expect(
        middlewareFunction({
          ctx,
          next: mockNext,
          path: "test.path",
          type: "query",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should apply custom weight", async () => {
      const { withIPRateLimit } = await import("../rate-limit");

      mockLimit.mockResolvedValue({
        ok: true,
        remaining: 5,
        resetMs: 30000,
      });

      const middlewareObj = withIPRateLimit("searchPerIpPerMin", { weight: 3 });
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "query",
      });

      expect(mockLimit).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ weight: 3 })
      );
    });

    it("should fail open on middleware errors", async () => {
      const { withIPRateLimit } = await import("../rate-limit");

      mockLimit.mockRejectedValue(new Error("Network error"));
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const middlewareObj = withIPRateLimit("searchPerIpPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "query",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "IP rate limit middleware error:",
        expect.any(Error)
      );
      expect(mockNext).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("withBurstProtection", () => {
    it("should allow request when both burst and sustained limits are not exceeded", async () => {
      const { withBurstProtection } = await import("../rate-limit");

      mockLimit
        .mockResolvedValueOnce({ ok: true, remaining: 5, resetMs: 5000 }) // burst
        .mockResolvedValueOnce({ ok: true, remaining: 50, resetMs: 30000 }); // sustained

      const middlewareObj = withBurstProtection("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "mutation",
      });

      expect(mockLimit).toHaveBeenCalledTimes(2);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should throw error when burst limit is exceeded", async () => {
      const { withBurstProtection } = await import("../rate-limit");

      mockLimit.mockResolvedValueOnce({
        ok: false,
        retryAfterMs: 5000,
        resetMs: 5000,
      });

      const middlewareObj = withBurstProtection("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await expect(
        middlewareFunction({
          ctx,
          next: mockNext,
          path: "test.path",
          type: "mutation",
        })
      ).rejects.toThrow(TRPCError);

      expect(mockLimit).toHaveBeenCalledTimes(1);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should throw error when sustained limit is exceeded", async () => {
      const { withBurstProtection } = await import("../rate-limit");

      mockLimit
        .mockResolvedValueOnce({ ok: true, remaining: 5, resetMs: 5000 }) // burst passes
        .mockResolvedValueOnce({
          ok: false,
          retryAfterMs: 30000,
          resetMs: 30000,
        }); // sustained fails

      const middlewareObj = withBurstProtection("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await expect(
        middlewareFunction({
          ctx,
          next: mockNext,
          path: "test.path",
          type: "mutation",
        })
      ).rejects.toThrow("Sustained rate limit exceeded");

      expect(mockLimit).toHaveBeenCalledTimes(2);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should fail open on middleware errors", async () => {
      const { withBurstProtection } = await import("../rate-limit");

      mockLimit.mockRejectedValue(new Error("Database error"));
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const middlewareObj = withBurstProtection("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "mutation",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Burst protection middleware error:",
        expect.any(Error)
      );
      expect(mockNext).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("withShadowBanCheck", () => {
    it("should allow request for non-shadow-banned user", async () => {
      const { withShadowBanCheck } = await import("../rate-limit");

      const middlewareObj = withShadowBanCheck();
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "normal-user" },
      };

      await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "mutation",
      });

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should allow request for unauthenticated user", async () => {
      const { withShadowBanCheck } = await import("../rate-limit");

      const middlewareObj = withShadowBanCheck();
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: null,
      };

      await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "mutation",
      });

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should mark context as shadow banned for banned user", async () => {
      const { withShadowBanCheck } = await import("../rate-limit");

      const middlewareObj = withShadowBanCheck();
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "shadow-banned-user" },
      };

      await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "mutation",
      });

      expect(mockAuditLog).toHaveBeenCalledWith({
        action: "abuse.shadowban_attempt",
        actorId: "shadow-banned-user",
        targetId: "shadow-banned-user",
        targetType: "User",
        metadata: { shadowBanned: true },
      });

      expect(mockNext).toHaveBeenCalledWith({
        ctx: expect.objectContaining({
          shadowBanned: true,
        }),
      });
    });
  });

  describe("createRateLimitedProcedure", () => {
    const mockBaseProcedure = {
      use: vi.fn().mockReturnThis(),
    };

    beforeEach(() => {
      mockBaseProcedure.use.mockClear().mockReturnThis();
    });

    it("should create procedure with shadow ban check and rate limiting for auth required", async () => {
      const { createRateLimitedProcedure } = await import("../rate-limit");

      const result = createRateLimitedProcedure(
        mockBaseProcedure,
        "commentsPerUserPerMin",
        { requireAuth: true }
      );

      expect(mockBaseProcedure.use).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockBaseProcedure);
    });

    it("should create procedure with IP rate limiting for non-auth required", async () => {
      const { createRateLimitedProcedure } = await import("../rate-limit");

      const result = createRateLimitedProcedure(
        mockBaseProcedure,
        "searchPerIpPerMin",
        { requireAuth: false }
      );

      expect(mockBaseProcedure.use).toHaveBeenCalledTimes(1); // Only rate limiting, no shadow ban
      expect(result).toBe(mockBaseProcedure);
    });

    it("should add burst protection when requested", async () => {
      const { createRateLimitedProcedure } = await import("../rate-limit");

      const result = createRateLimitedProcedure(
        mockBaseProcedure,
        "commentsPerUserPerMin",
        { burstProtection: true }
      );

      expect(mockBaseProcedure.use).toHaveBeenCalledTimes(3); // shadow ban + burst + rate limit
      expect(result).toBe(mockBaseProcedure);
    });

    it("should use default options when none provided", async () => {
      const { createRateLimitedProcedure } = await import("../rate-limit");

      const result = createRateLimitedProcedure(
        mockBaseProcedure,
        "commentsPerUserPerMin"
      );

      expect(mockBaseProcedure.use).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockBaseProcedure);
    });
  });

  describe("helper functions", () => {
    it("should extract headers from various contexts", async () => {
      const { withRateLimit } = await import("../rate-limit");

      mockLimit.mockResolvedValue({
        ok: true,
        remaining: 5,
        resetMs: 30000,
      });

      // Test different context formats
      const contexts = [
        {
          req: {
            headers: {
              "x-forwarded-for": "192.168.1.1",
              "user-agent": "Mozilla/5.0",
            },
          },
        },
        {
          req: {
            ip: "192.168.1.1",
            connection: { remoteAddress: "192.168.1.1" },
            get: vi.fn().mockReturnValue("Mozilla/5.0"),
            headers: { "user-agent": "Mozilla/5.0" },
          },
        },
      ];

      for (const ctx of contexts) {
        const middlewareObj = withRateLimit("commentsPerUserPerMin");
        const middlewareFunction = (middlewareObj as any)._testMiddleware;

        await middlewareFunction({
          ctx: { ...ctx, user: { id: "user-1" } },
          next: mockNext,
          path: "test.path",
          type: "mutation",
        });
      }

      expect(mockExtractIp).toHaveBeenCalled();
      expect(mockExtractUA).toHaveBeenCalled();
    });

    it("should handle missing request object", async () => {
      const { withRateLimit } = await import("../rate-limit");

      mockLimit.mockResolvedValue({
        ok: true,
        remaining: 5,
        resetMs: 30000,
      });

      const middlewareObj = withRateLimit("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        // No req object
      };

      await middlewareFunction({
        ctx,
        next: mockNext,
        path: "test.path",
        type: "mutation",
      });

      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle audit log failures gracefully", async () => {
      const { withRateLimit } = await import("../rate-limit");

      mockLimit.mockResolvedValue({
        ok: false,
        retryAfterMs: 30000,
        resetMs: 30000,
      });

      mockAuditLog.mockRejectedValue(new Error("Audit log failed"));
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const middlewareObj = withRateLimit("commentsPerUserPerMin");
      const middlewareFunction = (middlewareObj as any)._testMiddleware;

      const ctx = {
        user: { id: "user-1" },
        req: {
          headers: {
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "Mozilla/5.0",
          },
        },
      };

      try {
        await middlewareFunction({
          ctx,
          next: mockNext,
          path: "test.path",
          type: "mutation",
        });
      } catch (error) {
        // Expected to throw rate limit error
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to log rate limit violation:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
