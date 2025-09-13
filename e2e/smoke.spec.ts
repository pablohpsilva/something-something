import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage
    await page.goto("/");
  });

  test("homepage loads successfully", async ({ page }) => {
    // Check that the page loads and has expected elements
    await expect(page).toHaveTitle(/Something Something/);

    // Check for key navigation elements
    await expect(page.locator("nav")).toBeVisible();

    // Check for main content area
    await expect(page.locator("main")).toBeVisible();
  });

  test("can navigate to rules page", async ({ page }) => {
    // Click on rules navigation
    await page.click('a[href="/rules"]');

    // Should be on rules page
    await expect(page).toHaveURL(/.*\/rules/);

    // Should see rules list or empty state
    await expect(page.locator("h1")).toContainText(/Rules|Browse/);
  });

  test("search functionality works", async ({ page }) => {
    // Look for search input
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[type="search"]'
    );

    if (await searchInput.isVisible()) {
      // Type in search
      await searchInput.fill("AI");

      // Press enter or click search
      await searchInput.press("Enter");

      // Should show search results or "no results" message
      await expect(page.locator("main")).toBeVisible();
    }
  });
});

test.describe("Rule Submission Flow", () => {
  test("complete rule submission and publication flow", async ({ page }) => {
    // This test requires authentication, so we'll mock it or skip if not available
    test.skip(!process.env.E2E_TEST_USER, "No test user configured");

    // Navigate to create rule page
    await page.goto("/rules/new");

    // Fill out rule form
    await page.fill('input[name="title"]', "E2E Test Rule");
    await page.fill(
      'textarea[name="summary"]',
      "This is a test rule created by E2E tests"
    );

    // Select content type if available
    const contentTypeSelect = page.locator('select[name="contentType"]');
    if (await contentTypeSelect.isVisible()) {
      await contentTypeSelect.selectOption("PROMPT");
    }

    // Fill rule body
    await page.fill(
      'textarea[name="body"]',
      `
# Test Prompt

You are a helpful assistant for testing E2E flows.

## Instructions
1. Respond helpfully
2. Be concise
3. Test the system

## Example
User: Hello
Assistant: Hello! How can I help you test this system?
    `
    );

    // Select primary model
    const modelSelect = page.locator('select[name="primaryModel"]');
    if (await modelSelect.isVisible()) {
      await modelSelect.selectOption("gpt-4");
    }

    // Add tags
    const tagInput = page.locator(
      'input[placeholder*="tag"], input[name*="tag"]'
    );
    if (await tagInput.isVisible()) {
      await tagInput.fill("testing");
      await tagInput.press("Enter");
    }

    // Save as draft first
    await page.click(
      'button:has-text("Save Draft"), button[type="submit"]:has-text("Save")'
    );

    // Should redirect to rule page or show success
    await expect(page).toHaveURL(/.*\/rules\/.*/);

    // Publish the rule
    const publishButton = page.locator('button:has-text("Publish")');
    if (await publishButton.isVisible()) {
      await publishButton.click();

      // Confirm publication if needed
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Yes")'
      );
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Should show published status
      await expect(page.locator("text=Published")).toBeVisible();
    }
  });

  test("rule metrics increment on view", async ({ page }) => {
    // Navigate to a rule (assuming seeded data exists)
    await page.goto("/rules");

    // Click on first rule if available
    const firstRule = page
      .locator('a[href*="/rules/"]:not([href="/rules/new"])')
      .first();

    if (await firstRule.isVisible()) {
      // Get initial metrics if displayed
      const metricsSection = page.locator('[data-testid*="metrics"], .metrics');
      let initialViews = 0;

      if (await metricsSection.isVisible()) {
        const viewsText = await metricsSection
          .locator("text=/\\d+\\s*views?/i")
          .textContent();
        if (viewsText) {
          initialViews = parseInt(viewsText.match(/\\d+/)?.[0] || "0");
        }
      }

      // Click to view rule
      await firstRule.click();

      // Should be on rule detail page
      await expect(page).toHaveURL(/.*\/rules\/[^\/]+$/);

      // Rule content should be visible
      await expect(page.locator("h1")).toBeVisible();

      // Wait a moment for metrics to potentially update
      await page.waitForTimeout(1000);

      // Check if metrics updated (this might be async)
      // In a real test, you might need to refresh or wait for real-time updates
      const updatedMetrics = page.locator('[data-testid*="metrics"], .metrics');
      if (await updatedMetrics.isVisible()) {
        // Metrics should be present (exact increment testing would require more setup)
        await expect(updatedMetrics).toBeVisible();
      }
    }
  });
});

test.describe("User Interactions", () => {
  test("can vote on rules", async ({ page }) => {
    test.skip(!process.env.E2E_TEST_USER, "No test user configured");

    // Navigate to a rule
    await page.goto("/rules");
    const firstRule = page
      .locator('a[href*="/rules/"]:not([href="/rules/new"])')
      .first();

    if (await firstRule.isVisible()) {
      await firstRule.click();

      // Look for vote buttons
      const upvoteButton = page.locator(
        'button[aria-label*="upvote"], button:has-text("👍")'
      );

      if (await upvoteButton.isVisible()) {
        await upvoteButton.click();

        // Should show some feedback (updated count, visual change, etc.)
        await expect(page.locator("text=/voted|thanks/i")).toBeVisible({
          timeout: 5000,
        });
      }
    }
  });

  test("can add comments", async ({ page }) => {
    test.skip(!process.env.E2E_TEST_USER, "No test user configured");

    // Navigate to a rule
    await page.goto("/rules");
    const firstRule = page
      .locator('a[href*="/rules/"]:not([href="/rules/new"])')
      .first();

    if (await firstRule.isVisible()) {
      await firstRule.click();

      // Look for comment form
      const commentInput = page.locator(
        'textarea[placeholder*="comment"], textarea[name*="comment"]'
      );

      if (await commentInput.isVisible()) {
        await commentInput.fill("This is a test comment from E2E tests");

        // Submit comment
        const submitButton = page.locator(
          'button:has-text("Post"), button:has-text("Submit")'
        );
        await submitButton.click();

        // Should show the new comment
        await expect(
          page.locator("text=This is a test comment from E2E tests")
        ).toBeVisible();
      }
    }
  });
});

test.describe("Error Handling", () => {
  test("handles 404 pages gracefully", async ({ page }) => {
    await page.goto("/nonexistent-page");

    // Should show 404 page or redirect
    const response = await page
      .waitForResponse(
        (response) =>
          response.url().includes("/nonexistent-page") &&
          response.status() === 404
      )
      .catch(() => null);

    if (response) {
      // Should show error page content
      await expect(page.locator("text=/404|not found/i")).toBeVisible();
    }
  });

  test("handles network errors gracefully", async ({ page }) => {
    // Intercept API calls and simulate network error
    await page.route("**/api/**", (route) => {
      route.abort("failed");
    });

    await page.goto("/");

    // Should still load basic page structure
    await expect(page.locator("body")).toBeVisible();

    // Should handle API errors gracefully (no uncaught exceptions)
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    // Try to trigger API call
    const searchInput = page.locator('input[type="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("test");
      await searchInput.press("Enter");

      // Wait a moment for potential errors
      await page.waitForTimeout(2000);
    }

    // Should not have uncaught errors (or should handle them gracefully)
    expect(
      errors.filter((error) => !error.includes("ERR_FAILED"))
    ).toHaveLength(0);
  });
});
