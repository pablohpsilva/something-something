"use server";

import { createServerCaller } from "@/server/trpc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Example server action that creates a rule using tRPC
 */
export async function createRuleAction(formData: FormData) {
  try {
    const trpc = await createServerCaller();

    const title = formData.get("title") as string;
    const summary = formData.get("summary") as string;
    const body = formData.get("body") as string;
    const contentType = formData.get("contentType") as
      | "PROMPT"
      | "RULE"
      | "GUIDE"
      | "MCP";
    const tags = formData.get("tags") as string;
    const primaryModel = formData.get("primaryModel") as string;

    // Parse tags from comma-separated string
    const tagArray = tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const result = await trpc.rules.create({
      title,
      summary: summary || undefined,
      body,
      contentType,
      tags: tagArray,
      primaryModel: primaryModel || undefined,
      idempotencyKey: `create-rule-${Date.now()}-${Math.random()}`,
    });

    // Revalidate the rules list page
    revalidatePath("/rules");

    // Redirect to the new rule
    redirect(`/rules/${result.slug}`);
  } catch (error) {
    console.error("Failed to create rule:", error);
    throw new Error("Failed to create rule. Please try again.");
  }
}

/**
 * Example server action that publishes a rule
 */
export async function publishRuleAction(ruleId: string) {
  try {
    const trpc = await createServerCaller();

    await trpc.rules.publish({
      ruleId,
      idempotencyKey: `publish-rule-${ruleId}-${Date.now()}`,
    });

    // Revalidate the rule page and rules list
    revalidatePath("/rules");
    revalidatePath(`/rules/*`);

    return { success: true };
  } catch (error) {
    console.error("Failed to publish rule:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to publish rule",
    };
  }
}

/**
 * Example server action that gets rule data for SSR
 */
export async function getRuleData(slug: string) {
  try {
    const trpc = await createServerCaller();

    const rule = await trpc.rules.getBySlug({
      slug,
      includeMetrics: true,
      includeUserActions: true,
    });

    return rule;
  } catch (error) {
    console.error("Failed to get rule:", error);
    return null;
  }
}
