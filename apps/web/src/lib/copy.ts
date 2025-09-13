/**
 * Clipboard utilities
 */

/**
 * Copy text to clipboard with fallback for older browsers
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Modern clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const success = document.execCommand("copy");
    document.body.removeChild(textArea);

    return success;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Copy rule content with metadata
 */
export function formatRuleForCopy(rule: {
  title: string;
  body: string;
  author?: { handle: string; displayName: string };
  url?: string;
}): string {
  const lines = [`# ${rule.title}`, "", rule.body];

  if (rule.author) {
    lines.push("", `*By ${rule.author.displayName} (@${rule.author.handle})*`);
  }

  if (rule.url) {
    lines.push("", `Source: ${rule.url}`);
  }

  return lines.join("\n");
}

/**
 * Copy rule URL to clipboard
 */
export async function copyRuleUrl(slug: string): Promise<boolean> {
  const url = `${window.location.origin}/rules/${slug}`;
  return copyToClipboard(url);
}

/**
 * Copy author profile URL to clipboard
 */
export async function copyAuthorUrl(handle: string): Promise<boolean> {
  const url = `${window.location.origin}/authors/${handle}`;
  return copyToClipboard(url);
}
