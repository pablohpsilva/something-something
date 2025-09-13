import { test as setup, expect } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // Skip auth setup if no test user configured
  if (!process.env.E2E_TEST_USER || !process.env.E2E_TEST_PASSWORD) {
    console.log("Skipping auth setup - no test credentials configured");
    return;
  }

  // Navigate to login page
  await page.goto("/sign-in");

  // Fill in login form (adjust selectors based on your auth provider)
  await page.fill(
    'input[name="email"], input[type="email"]',
    process.env.E2E_TEST_USER
  );
  await page.fill(
    'input[name="password"], input[type="password"]',
    process.env.E2E_TEST_PASSWORD
  );

  // Submit login form
  await page.click('button[type="submit"], button:has-text("Sign in")');

  // Wait for redirect to dashboard or home
  await page.waitForURL(/.*\/(dashboard|home|rules).*/);

  // Verify we're logged in
  await expect(page.locator("text=/sign out|logout|profile/i")).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });
});

setup.describe.configure({ mode: "serial" });
