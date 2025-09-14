/**
 * Sanitize HTML content for safe rendering
 * This is a simple implementation that only allows <mark> tags for search highlights
 */

const ALLOWED_TAGS = ["mark"];
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  mark: [],
};

/**
 * Sanitize HTML string to only allow safe tags and attributes
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  // Simple regex-based sanitization for search highlights
  // Only allows <mark> tags with no attributes
  return html
    .replace(/<(?!\/?mark\b)[^>]*>/gi, "") // Remove all tags except <mark>
    .replace(/<mark[^>]*>/gi, "<mark>") // Remove attributes from mark tags
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

/**
 * Check if HTML content is safe (only contains allowed tags)
 */
export function isHtmlSafe(html: string): boolean {
  if (!html) return true;

  // Check for any tags that aren't in the allowed list
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const tagName = match[1]?.toLowerCase();
    if (!tagName || !ALLOWED_TAGS.includes(tagName)) {
      return false;
    }
  }

  return true;
}

/**
 * Strip all HTML tags from content
 */
export function stripHtml(html: string): string {
  if (!html) return "";

  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim();
}

/**
 * Highlight search terms in text (client-side fallback)
 */
export function highlightSearchTerms(
  text: string,
  searchTerms: string[]
): string {
  if (!text || !searchTerms.length) return text;

  let highlightedText = text;

  searchTerms.forEach((term) => {
    if (term.length < 2) return; // Skip very short terms

    const regex = new RegExp(`(${escapeRegex(term)})`, "gi");
    highlightedText = highlightedText.replace(regex, "<mark>$1</mark>");
  });

  return highlightedText;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract plain text from search snippet for fallback display
 */
export function extractSnippetText(snippet: string, maxLength = 200): string {
  const plainText = stripHtml(snippet);

  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Try to break at word boundary
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}
