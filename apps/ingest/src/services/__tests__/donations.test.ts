import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Stripe from "stripe";

// Mock process.env to prevent validation errors
const originalEnv = process.env;
process.env = {
  ...originalEnv,
  DATABASE_URL: "postgresql://test",
  CRON_SECRET: "test_cron_secret",
  INGEST_APP_TOKEN: "test_ingest_token",
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_WEBHOOK_SECRET: "whsec_test_123",
  PORT: "8787",
  LOG_LEVEL: "info",
  NODE_ENV: "test",
};

// Mock process.exit to prevent test termination
const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

// Mock environment module
const mockGetEnv = vi.hoisted(() =>
  vi.fn(() => ({
    DATABASE_URL: "postgresql://test",
    CRON_SECRET: "test_cron_secret",
    INGEST_APP_TOKEN: "test_ingest_token",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: "whsec_test_123",
    PORT: 8787,
    LOG_LEVEL: "info" as const,
    NODE_ENV: "test" as const,
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_EVENTS_PER_IP: 60,
    RATE_LIMIT_CRAWL_PER_TOKEN: 30,
    VIEW_DEDUPE_WINDOW_MS: 600000,
    ROLLUP_DAYS_BACK: 7,
    TRENDING_DECAY_LAMBDA: 0.25,
  }))
);

vi.mock("../env", () => ({
  getEnv: mockGetEnv,
}));

// Mock dependencies
vi.mock("@repo/db", () => ({
  prisma: {
    auditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    donation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    authorMetricDaily: {
      upsert: vi.fn(),
    },
    event: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@repo/trpc/services/notify", () => ({
  Notifications: {
    donationReceived: vi.fn(),
  },
}));

// Mock Stripe
const { mockStripeInstance, MockStripeSignatureVerificationError, MockStripe } =
  vi.hoisted(() => {
    const mockStripeInstance = {
      webhooks: {
        constructEvent: vi.fn(),
      },
    };

    const MockStripeSignatureVerificationError = class extends Error {
      constructor(message: string) {
        super(message);
        this.name = "StripeSignatureVerificationError";
      }
    };

    const MockStripe = vi.fn(() => mockStripeInstance);
    (MockStripe as any).errors = {
      StripeSignatureVerificationError: MockStripeSignatureVerificationError,
    };

    return {
      mockStripeInstance,
      MockStripeSignatureVerificationError,
      MockStripe,
    };
  });

vi.mock("stripe", () => ({
  default: MockStripe,
}));

// Import after mocks are set up
import { handleStripeEvent, type StripeEventResult } from "../donations";

describe("Donations Service", () => {
  let mockPrisma: any;
  let mockLogger: any;
  let mockNotifications: any;
  let mockStripe: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import mocked modules
    mockPrisma = vi.mocked((await import("@repo/db")).prisma);
    mockLogger = vi.mocked(((await import("../../logger")) as any).logger);
    mockNotifications = vi.mocked(
      (await import("@repo/trpc/services/notify")).Notifications
    );

    // Get the mocked Stripe instance
    mockStripe = mockStripeInstance;

    // Reset all mock implementations
    mockPrisma.auditLog.findFirst.mockResolvedValue(null);
    mockPrisma.auditLog.create.mockResolvedValue({} as any);
    mockPrisma.donation.findUnique.mockResolvedValue(null);
    mockPrisma.donation.findFirst.mockResolvedValue(null);
    mockPrisma.donation.update.mockResolvedValue({} as any);
    mockPrisma.authorMetricDaily.upsert.mockResolvedValue({} as any);
    mockPrisma.event.create.mockResolvedValue({} as any);
    mockPrisma.$transaction.mockImplementation((callback: any) =>
      callback(mockPrisma)
    );
    mockNotifications.donationReceived.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockExit.mockRestore();
    process.env = originalEnv;
  });

  describe("handleStripeEvent", () => {
    const mockRawBody = "raw_body_content";
    const mockSignature = "stripe_signature";

    it("should handle checkout.session.completed event successfully", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_test_123",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            metadata: {
              donationId: "donation_123",
              toUserId: "user_456",
              ruleId: "rule_789",
            },
            amount_total: 1000,
            currency: "usd",
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      const mockDonation = {
        id: "donation_123",
        status: "INIT",
        fromUserId: "user_from",
        toUserId: "user_456",
        ruleId: "rule_789",
        amountCents: 1000,
        currency: "usd",
        fromUser: {
          handle: "donor_handle",
          displayName: "Donor Name",
        },
        rule: {
          slug: "test-rule",
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrisma.donation.findUnique.mockResolvedValue(mockDonation as any);
      mockPrisma.donation.update.mockResolvedValue({
        ...mockDonation,
        status: "SUCCEEDED",
        providerRef: "cs_test_123",
      } as any);

      const result = await handleStripeEvent(mockRawBody, mockSignature);

      expect(result).toEqual({
        processed: true,
        donationId: "donation_123",
        action: "checkout_completed",
      });

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        mockRawBody,
        mockSignature,
        "whsec_test"
      );

      expect(mockPrisma.auditLog.findFirst).toHaveBeenCalledWith({
        where: {
          action: "stripe.webhook",
          entityId: "evt_test_123",
        },
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.donation.findUnique).toHaveBeenCalledWith({
        where: { id: "donation_123" },
      });

      expect(mockPrisma.donation.update).toHaveBeenCalledWith({
        where: { id: "donation_123" },
        data: {
          status: "SUCCEEDED",
          providerRef: "cs_test_123",
          amountCents: 1000,
          currency: "usd",
        },
      });

      expect(mockPrisma.authorMetricDaily.upsert).toHaveBeenCalled();
      expect(mockPrisma.event.create).toHaveBeenCalledWith({
        data: {
          type: "DONATE",
          ruleId: "rule_789",
          userId: "user_from",
          ipHash: "stripe",
          uaHash: "stripe",
          createdAt: expect.any(Date),
        },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: "stripe.webhook",
          entityType: "stripe_event",
          entityId: "evt_test_123",
          diff: {
            eventType: "checkout.session.completed",
            processed: true,
            donationId: "donation_123",
            action: "checkout_completed",
          },
          ipHash: "stripe",
          createdAt: expect.any(Date),
        },
      });

      expect(mockNotifications.donationReceived).toHaveBeenCalledWith({
        toUserId: "user_456",
        donationId: "donation_123",
        amountCents: 1000,
        currency: "usd",
        fromUserId: "user_from",
        fromUserHandle: "donor_handle",
        fromUserDisplayName: "Donor Name",
        ruleId: "rule_789",
        ruleSlug: "test-rule",
      });
    });

    it("should handle payment_intent.succeeded event", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_test_456",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_123",
            amount: 1500,
          } as Stripe.PaymentIntent,
        },
      } as Stripe.Event;

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = await handleStripeEvent(mockRawBody, mockSignature);

      expect(result).toEqual({
        processed: true,
        action: "payment_succeeded",
      });
    });

    it("should handle payment_intent.payment_failed event", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_test_789",
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_test_failed",
          } as Stripe.PaymentIntent,
        },
      } as Stripe.Event;

      const mockDonation = {
        id: "donation_failed",
        status: "INIT",
        providerRef: "pi_test_failed",
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrisma.donation.findFirst.mockResolvedValue(mockDonation as any);
      mockPrisma.donation.update.mockResolvedValue({
        ...mockDonation,
        status: "FAILED",
      } as any);

      const result = await handleStripeEvent(mockRawBody, mockSignature);

      expect(result).toEqual({
        processed: true,
        donationId: "donation_failed",
        action: "payment_failed",
      });

      expect(mockPrisma.donation.findFirst).toHaveBeenCalledWith({
        where: { providerRef: "pi_test_failed" },
      });

      expect(mockPrisma.donation.update).toHaveBeenCalledWith({
        where: { id: "donation_failed" },
        data: { status: "FAILED" },
      });
    });

    it("should handle unhandled event types", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_test_unhandled",
        type: "customer.created" as any,
        data: { object: {} },
      } as Stripe.Event;

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = await handleStripeEvent(mockRawBody, mockSignature);

      expect(result).toEqual({
        processed: false,
        action: "unhandled_event_type",
      });
    });

    it("should handle already processed events", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_already_processed",
        type: "checkout.session.completed",
        data: { object: {} },
      } as Stripe.Event;

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrisma.auditLog.findFirst.mockResolvedValue({
        id: "audit_123",
        action: "stripe.webhook",
        entityId: "evt_already_processed",
      } as any);

      const result = await handleStripeEvent(mockRawBody, mockSignature);

      expect(result).toEqual({
        processed: false,
        action: "already_processed",
      });

      // Should not create audit log for already processed events
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("should handle invalid signature error", async () => {
      const signatureError = new MockStripeSignatureVerificationError(
        "Invalid signature"
      );
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw signatureError;
      });

      const result = await handleStripeEvent(mockRawBody, mockSignature);

      expect(result).toEqual({
        processed: false,
        error: "invalid_signature",
      });
    });

    it("should throw other errors", async () => {
      const genericError = new Error("Database connection failed");
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw genericError;
      });

      await expect(
        handleStripeEvent(mockRawBody, mockSignature)
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle checkout session without metadata", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_no_metadata",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_no_metadata",
            metadata: null,
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = await handleStripeEvent(mockRawBody, mockSignature);

      expect(result).toEqual({
        processed: false,
        error: "missing_metadata",
      });
    });

    it("should handle checkout session with invalid metadata", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_invalid_metadata",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_invalid_metadata",
            metadata: {
              // Missing donationId and toUserId
              ruleId: "rule_123",
            },
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = await handleStripeEvent(mockRawBody, mockSignature);

      expect(result).toEqual({
        processed: false,
        error: "invalid_metadata",
      });
    });

    it("should handle donation not found", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_donation_not_found",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_donation_not_found",
            metadata: {
              donationId: "nonexistent_donation",
              toUserId: "user_456",
            },
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrisma.donation.findUnique.mockResolvedValue(null);

      await expect(
        handleStripeEvent(mockRawBody, mockSignature)
      ).rejects.toThrow("Donation nonexistent_donation not found");
    });

    it("should handle already processed donation", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_already_processed_donation",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_already_processed",
            metadata: {
              donationId: "donation_already_processed",
              toUserId: "user_456",
            },
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      const mockDonation = {
        id: "donation_already_processed",
        status: "SUCCEEDED", // Already processed
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrisma.donation.findUnique.mockResolvedValue(mockDonation as any);

      const result = await handleStripeEvent(mockRawBody, mockSignature);

      expect(result).toEqual({
        processed: false,
        action: "already_processed",
      });
    });

    it("should handle payment failure when donation not found", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_payment_failed_no_donation",
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_not_found",
          } as Stripe.PaymentIntent,
        },
      } as Stripe.Event;

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrisma.donation.findFirst.mockResolvedValue(null);

      const result = await handleStripeEvent(mockRawBody, mockSignature);

      expect(result).toEqual({
        processed: false,
        action: "donation_not_found",
      });
    });

    it("should handle notification failure gracefully", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_notification_failure",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_notification_failure",
            metadata: {
              donationId: "donation_notification_failure",
              toUserId: "user_456",
            },
            amount_total: 1000,
            currency: "usd",
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      const mockDonation = {
        id: "donation_notification_failure",
        status: "INIT",
        fromUserId: "user_from",
        toUserId: "user_456",
        amountCents: 1000,
        currency: "usd",
        fromUser: {
          handle: "donor_handle",
          displayName: "Donor Name",
        },
        rule: null,
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrisma.donation.findUnique.mockResolvedValue(mockDonation as any);
      mockPrisma.donation.update.mockResolvedValue({
        ...mockDonation,
        status: "SUCCEEDED",
      } as any);

      // Mock notification failure
      mockNotifications.donationReceived.mockRejectedValue(
        new Error("Notification service unavailable")
      );

      const result = await handleStripeEvent(mockRawBody, mockSignature);

      // Should still succeed despite notification failure
      expect(result).toEqual({
        processed: true,
        donationId: "donation_notification_failure",
        action: "checkout_completed",
      });
    });

    it("should create correct author metrics for today", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_metrics_test",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_metrics_test",
            metadata: {
              donationId: "donation_metrics_test",
              toUserId: "user_metrics",
            },
            amount_total: 2500,
            currency: "usd",
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      const mockDonation = {
        id: "donation_metrics_test",
        status: "INIT",
        fromUserId: "user_from",
        toUserId: "user_metrics",
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrisma.donation.findUnique.mockResolvedValue(mockDonation as any);
      mockPrisma.donation.update.mockResolvedValue({
        ...mockDonation,
        status: "SUCCEEDED",
      } as any);

      await handleStripeEvent(mockRawBody, mockSignature);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      expect(mockPrisma.authorMetricDaily.upsert).toHaveBeenCalledWith({
        where: {
          date_authorUserId: {
            date: today,
            authorUserId: "user_metrics",
          },
        },
        update: {
          donations: { increment: 1 },
          donationsCents: { increment: 2500 },
        },
        create: {
          date: today,
          authorUserId: "user_metrics",
          views: 0,
          copies: 0,
          saves: 0,
          forks: 0,
          votes: 0,
          score: 0,
          donations: 1,
          donationsCents: 2500,
        },
      });
    });
  });

  describe("Error Handling", () => {
    const mockRawBody = "raw_body_content";
    const mockSignature = "stripe_signature";

    it("should handle non-Error objects in catch blocks", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_non_error",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_non_error",
            metadata: {
              donationId: "donation_non_error",
              toUserId: "user_456",
            },
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrisma.donation.findUnique.mockRejectedValue("String error");

      await expect(handleStripeEvent(mockRawBody, mockSignature)).rejects.toBe(
        "String error"
      );
    });

    it("should handle webhook processing non-Error objects", async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw { custom: "webhook error" };
      });

      await expect(handleStripeEvent("raw_body", "signature")).rejects.toEqual({
        custom: "webhook error",
      });
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete donation flow with all features", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_complete_flow",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_complete_flow",
            metadata: {
              donationId: "donation_complete_flow",
              toUserId: "author_user",
              ruleId: "rule_complete_flow",
            },
            amount_total: 5000,
            currency: "eur",
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      const mockDonation = {
        id: "donation_complete_flow",
        status: "INIT",
        fromUserId: "donor_user",
        toUserId: "author_user",
        ruleId: "rule_complete_flow",
        amountCents: 5000,
        currency: "eur",
        fromUser: {
          handle: "generous_donor",
          displayName: "Generous Donor",
        },
        rule: {
          slug: "amazing-rule",
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrisma.donation.findUnique
        .mockResolvedValueOnce(mockDonation as any) // First call in transaction
        .mockResolvedValueOnce(mockDonation as any); // Second call for notification

      mockPrisma.donation.update.mockResolvedValue({
        ...mockDonation,
        status: "SUCCEEDED",
        providerRef: "cs_complete_flow",
      } as any);

      const result = await handleStripeEvent("raw_body", "signature");

      expect(result).toEqual({
        processed: true,
        donationId: "donation_complete_flow",
        action: "checkout_completed",
      });

      // Verify all database operations
      expect(mockPrisma.donation.update).toHaveBeenCalledWith({
        where: { id: "donation_complete_flow" },
        data: {
          status: "SUCCEEDED",
          providerRef: "cs_complete_flow",
          amountCents: 5000,
          currency: "eur",
        },
      });

      expect(mockPrisma.event.create).toHaveBeenCalledWith({
        data: {
          type: "DONATE",
          ruleId: "rule_complete_flow",
          userId: "donor_user",
          ipHash: "stripe",
          uaHash: "stripe",
          createdAt: expect.any(Date),
        },
      });

      expect(mockNotifications.donationReceived).toHaveBeenCalledWith({
        toUserId: "author_user",
        donationId: "donation_complete_flow",
        amountCents: 5000,
        currency: "eur",
        fromUserId: "donor_user",
        fromUserHandle: "generous_donor",
        fromUserDisplayName: "Generous Donor",
        ruleId: "rule_complete_flow",
        ruleSlug: "amazing-rule",
      });
    });
  });
});
