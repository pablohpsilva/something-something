/**
 * Markdown sanitization utilities for safe HTML rendering
 */

import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Configuration for HTML sanitization
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    // Text formatting
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "code",
    "pre",
    // Headers
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    // Lists
    "ul",
    "ol",
    "li",
    // Links
    "a",
    // Quotes
    "blockquote",
    // Tables
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    // Other
    "hr",
    "div",
    "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    code: ["class"], // For syntax highlighting
    pre: ["class"],
    div: ["class"],
    span: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    a: ["http", "https", "mailto"],
  },
  transformTags: {
    // Ensure all links open in new tab with security attributes
    a: (tagName, attribs) => {
      return {
        tagName: "a",
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "nofollow noopener noreferrer",
        },
      };
    },
  },
  // Remove any script-like content
  disallowedTagsMode: "discard",
  allowedIframeHostnames: [], // No iframes allowed
};

/**
 * Configure marked for safe markdown parsing
 */
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
  // Note: sanitize option removed in newer marked versions - we handle sanitization separately
  // smartypants: false, // Disable smart quotes to avoid XSS (removed in newer marked versions)
});

/**
 * Convert markdown to safe HTML
 * @param markdown Raw markdown string
 * @returns Sanitized HTML string
 */
export function renderCommentMarkdownToSafeHtml(markdown: string): string {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  try {
    // Step 1: Convert markdown to HTML
    const rawHtml = marked(markdown.trim());

    // Step 2: Sanitize the HTML
    const sanitizedHtml = sanitizeHtml(rawHtml, SANITIZE_OPTIONS);

    // Step 3: Post-process for additional safety
    return postProcessHtml(sanitizedHtml);
  } catch (error) {
    console.error("Error rendering markdown:", error);
    // Return escaped plain text as fallback
    return escapeHtml(markdown);
  }
}

/**
 * Post-process HTML for additional safety and UX improvements
 * @param html Sanitized HTML
 * @returns Post-processed HTML
 */
function postProcessHtml(html: string): string {
  // Truncate very long URLs in link text
  return html.replace(
    /<a([^>]*)>([^<]{50,})<\/a>/g,
    (match, attributes, linkText) => {
      if (linkText.length > 50) {
        const truncated = linkText.substring(0, 47) + "...";
        return `<a${attributes}>${truncated}</a>`;
      }
      return match;
    }
  );
}

/**
 * Escape HTML entities for safe display
 * @param text Raw text
 * @returns HTML-escaped text
 */
function escapeHtml(text: string): string {
  // Server-safe HTML escaping without DOM APIs
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Strip all HTML tags and return plain text
 * @param html HTML string
 * @returns Plain text
 */
export function stripHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  });
}

/**
 * Get a preview of markdown content (first paragraph, plain text)
 * @param markdown Raw markdown
 * @param maxLength Maximum length of preview
 * @returns Plain text preview
 */
export function getMarkdownPreview(
  markdown: string,
  maxLength: number = 200
): string {
  if (!markdown) return "";

  // Convert to HTML then strip tags
  const html = renderCommentMarkdownToSafeHtml(markdown);
  const plainText = stripHtml(html);

  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Find the last space before the cutoff to avoid cutting words
  const cutoff = plainText.lastIndexOf(" ", maxLength);
  return plainText.substring(0, cutoff > 0 ? cutoff : maxLength) + "...";
}

/**
 * Validate markdown content for basic safety
 * @param markdown Raw markdown
 * @returns Object with validation result and issues
 */
export function validateMarkdownContent(markdown: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!markdown || typeof markdown !== "string") {
    issues.push("Content is required");
    return { isValid: false, issues };
  }

  if (markdown.length > 5000) {
    issues.push("Content is too long (maximum 5000 characters)");
  }

  if (markdown.trim().length === 0) {
    issues.push("Content cannot be empty");
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(markdown)) {
      issues.push("Content contains potentially unsafe elements");
      break;
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Server-side safe HTML rendering (for Node.js environments)
 * This version doesn't rely on DOM APIs
 */
export function renderMarkdownToSafeHtmlServer(markdown: string): string {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  try {
    // Convert markdown to HTML
    const rawHtml = marked(markdown.trim());

    // Sanitize with server-safe options
    const sanitizedHtml = sanitizeHtml(rawHtml, {
      ...SANITIZE_OPTIONS,
      // Server-side specific options
      parser: {
        lowerCaseAttributeNames: true,
      },
    });

    return sanitizedHtml;
  } catch (error) {
    console.error("Error rendering markdown on server:", error);
    // Return escaped plain text as fallback
    return markdown
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }
}

/**
 * Test cases for markdown sanitization
 * These should be run in unit tests
 */
export const TEST_CASES = {
  safe: {
    input:
      "# Hello\n\nThis is **bold** and *italic* text with a [link](https://example.com).",
    shouldContain: [
      "<h1>",
      "<strong>",
      "<em>",
      '<a href="https://example.com"',
    ],
    shouldNotContain: ["<script>", "javascript:", "onclick"],
  },
  dangerous: {
    input: '<script>alert("xss")</script><img src="x" onerror="alert(1)">',
    shouldContain: [],
    shouldNotContain: ["<script>", "onerror", "javascript:", "alert"],
  },
  links: {
    input:
      "[Safe link](https://example.com) and [mailto](mailto:test@example.com)",
    shouldContain: ['target="_blank"', 'rel="nofollow noopener noreferrer"'],
    shouldNotContain: ["javascript:", "data:"],
  },
};
