import { Page } from "@playwright/test";

export interface TestRule {
  title: string;
  summary: string;
  body: string;
  contentType: "PROMPT" | "GUIDE" | "TEMPLATE";
  primaryModel: string;
  tags: string[];
}

export const sampleRules: TestRule[] = [
  {
    title: "E2E Code Review Assistant",
    summary: "AI-powered code review for testing purposes",
    contentType: "PROMPT",
    primaryModel: "gpt-4",
    body: `# Code Review Assistant

You are an expert code reviewer. Analyze the provided code and give constructive feedback.

## Instructions
1. Review for bugs and potential issues
2. Suggest improvements for readability
3. Check for security vulnerabilities
4. Recommend best practices

## Example
\`\`\`javascript
function add(a, b) {
  return a + b;
}
\`\`\`

This function looks good but could benefit from:
- Type checking or TypeScript
- Input validation
- JSDoc comments`,
    tags: ["coding", "ai", "productivity"],
  },
  {
    title: "E2E Meeting Notes Generator",
    summary: "Transform meeting recordings into structured notes",
    contentType: "GUIDE",
    primaryModel: "claude-3-sonnet",
    body: `# Meeting Notes Generator

This guide helps you create structured meeting notes from recordings or transcripts.

## Steps
1. **Preparation**
   - Gather meeting transcript or recording
   - Identify key participants
   - Note meeting objectives

2. **Processing**
   - Extract action items
   - Identify decisions made
   - Summarize key discussions

3. **Output Format**
   - Executive summary
   - Action items with owners
   - Next steps and deadlines

## Template
**Meeting:** [Title]
**Date:** [Date]
**Participants:** [Names]

### Summary
[Brief overview]

### Decisions
- [Decision 1]
- [Decision 2]

### Action Items
- [ ] [Task] - [Owner] - [Deadline]`,
    tags: ["productivity", "business", "automation"],
  },
];

export class TestDataHelper {
  constructor(private page: Page) {}

  async createRule(rule: TestRule): Promise<string> {
    // Navigate to create rule page
    await this.page.goto("/rules/new");

    // Fill form fields
    await this.page.fill('input[name="title"]', rule.title);
    await this.page.fill('textarea[name="summary"]', rule.summary);

    // Select content type
    const contentTypeSelect = this.page.locator('select[name="contentType"]');
    if (await contentTypeSelect.isVisible()) {
      await contentTypeSelect.selectOption(rule.contentType);
    }

    // Fill body
    await this.page.fill('textarea[name="body"]', rule.body);

    // Select model
    const modelSelect = this.page.locator('select[name="primaryModel"]');
    if (await modelSelect.isVisible()) {
      await modelSelect.selectOption(rule.primaryModel);
    }

    // Add tags
    for (const tag of rule.tags) {
      const tagInput = this.page.locator('input[placeholder*="tag"]');
      if (await tagInput.isVisible()) {
        await tagInput.fill(tag);
        await tagInput.press("Enter");
      }
    }

    // Save rule
    await this.page.click('button[type="submit"], button:has-text("Save")');

    // Get the rule URL
    await this.page.waitForURL(/.*\/rules\/.*/);
    return this.page.url();
  }

  async publishRule(ruleUrl: string): Promise<void> {
    await this.page.goto(ruleUrl);

    const publishButton = this.page.locator('button:has-text("Publish")');
    if (await publishButton.isVisible()) {
      await publishButton.click();

      // Handle confirmation dialog if present
      const confirmButton = this.page.locator(
        'button:has-text("Confirm"), button:has-text("Yes")'
      );
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  }

  async getMetrics(
    ruleUrl: string
  ): Promise<{ views: number; votes: number; comments: number }> {
    await this.page.goto(ruleUrl);

    const metrics = { views: 0, votes: 0, comments: 0 };

    // Extract views
    const viewsElement = this.page.locator(
      '[data-testid="views"], text=/\\d+\\s*views?/i'
    );
    if (await viewsElement.isVisible()) {
      const viewsText = await viewsElement.textContent();
      metrics.views = parseInt(viewsText?.match(/\\d+/)?.[0] || "0");
    }

    // Extract votes
    const votesElement = this.page.locator(
      '[data-testid="votes"], text=/\\d+\\s*votes?/i'
    );
    if (await votesElement.isVisible()) {
      const votesText = await votesElement.textContent();
      metrics.votes = parseInt(votesText?.match(/\\d+/)?.[0] || "0");
    }

    // Extract comments
    const commentsElement = this.page.locator(
      '[data-testid="comments"], text=/\\d+\\s*comments?/i'
    );
    if (await commentsElement.isVisible()) {
      const commentsText = await commentsElement.textContent();
      metrics.comments = parseInt(commentsText?.match(/\\d+/)?.[0] || "0");
    }

    return metrics;
  }

  async voteOnRule(
    ruleUrl: string,
    voteType: "up" | "down" = "up"
  ): Promise<void> {
    await this.page.goto(ruleUrl);

    const voteButton =
      voteType === "up"
        ? this.page.locator(
            'button[aria-label*="upvote"], button:has-text("👍")'
          )
        : this.page.locator(
            'button[aria-label*="downvote"], button:has-text("👎")'
          );

    if (await voteButton.isVisible()) {
      await voteButton.click();
      // Wait for vote to register
      await this.page.waitForTimeout(1000);
    }
  }

  async addComment(ruleUrl: string, comment: string): Promise<void> {
    await this.page.goto(ruleUrl);

    const commentInput = this.page.locator(
      'textarea[placeholder*="comment"], textarea[name*="comment"]'
    );
    if (await commentInput.isVisible()) {
      await commentInput.fill(comment);

      const submitButton = this.page.locator(
        'button:has-text("Post"), button:has-text("Submit")'
      );
      await submitButton.click();

      // Wait for comment to appear
      await this.page.waitForTimeout(1000);
    }
  }
}
