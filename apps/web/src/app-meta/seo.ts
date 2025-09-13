/**
 * SEO and metadata utilities
 */

import type { Metadata } from "next";

const SITE_NAME = "Core Directory Engine";
const SITE_DESCRIPTION =
  "Discover, share, and collaborate on the best rules and patterns for modern development.";
const SITE_URL = process.env.WEB_BASE_URL || "http://localhost:3000";

/**
 * Default metadata for the site
 */
export const defaultMetadata: Metadata = {
  title: {
    template: `%s | ${SITE_NAME}`,
    default: SITE_NAME,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "development rules",
    "coding patterns",
    "best practices",
    "developer tools",
    "code quality",
    "software engineering",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

/**
 * Generate metadata for a rule page
 */
export function generateRuleMetadata(rule: {
  title: string;
  summary: string;
  slug: string;
  author: { displayName: string; handle: string };
  tags: Array<{ name: string }>;
}): Metadata {
  const title = rule.title;
  const description = rule.summary;
  const url = `${SITE_URL}/rules/${rule.slug}`;
  const authorName = rule.author.displayName;
  const tags = rule.tags.map((t) => t.name).join(", ");

  return {
    title,
    description,
    keywords: [
      ...rule.tags.map((t) => t.name),
      "development rule",
      "coding pattern",
    ],
    authors: [{ name: authorName }],
    alternates: {
      canonical: `/rules/${rule.slug}`,
    },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: SITE_NAME,
      images: [
        {
          url: `/api/og/rule/${rule.slug}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      authors: [authorName],
      tags: rule.tags.map((t) => t.name),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/api/og/rule/${rule.slug}`],
    },
    other: {
      "article:author": authorName,
      "article:tag": tags,
    },
  };
}

/**
 * Generate metadata for an author page
 */
export function generateAuthorMetadata(author: {
  displayName: string;
  handle: string;
  bio?: string;
  avatarUrl?: string;
}): Metadata {
  const title = `${author.displayName} (@${author.handle})`;
  const description =
    author.bio ||
    `View ${author.displayName}'s rules and contributions on ${SITE_NAME}`;
  const url = `${SITE_URL}/authors/${author.handle}`;

  return {
    title,
    description,
    alternates: {
      canonical: `/authors/${author.handle}`,
    },
    openGraph: {
      type: "profile",
      url,
      title,
      description,
      siteName: SITE_NAME,
      images: [
        {
          url: author.avatarUrl || `/api/og/author/${author.handle}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [author.avatarUrl || `/api/og/author/${author.handle}`],
    },
  };
}

/**
 * Generate metadata for search results
 */
export function generateSearchMetadata(
  query: string,
  count?: number
): Metadata {
  const title = `Search: "${query}"`;
  const description = count
    ? `Found ${count} results for "${query}" on ${SITE_NAME}`
    : `Search results for "${query}" on ${SITE_NAME}`;

  return {
    title,
    description,
    robots: {
      index: false, // Don't index search result pages
      follow: true,
    },
  };
}

/**
 * Generate metadata for leaderboards
 */
export function generateLeaderboardMetadata(
  period: string,
  scope: string,
  scopeRef?: string
): Metadata {
  let title = `${period.charAt(0).toUpperCase() + period.slice(1)} Leaderboard`;
  let description = `Top rules and authors for ${period} period`;

  if (scope === "tag" && scopeRef) {
    title = `${title} - ${scopeRef}`;
    description = `${description} in ${scopeRef} category`;
  } else if (scope === "model" && scopeRef) {
    title = `${title} - ${scopeRef}`;
    description = `${description} for ${scopeRef} model`;
  }

  return {
    title,
    description,
    alternates: {
      canonical: `/leaderboards`,
    },
    openGraph: {
      type: "website",
      title,
      description,
      siteName: SITE_NAME,
    },
  };
}

/**
 * Generate JSON-LD structured data for a rule
 */
export function generateRuleJsonLd(rule: {
  title: string;
  summary: string;
  slug: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { displayName: string; handle: string };
  tags: Array<{ name: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: rule.title,
    description: rule.summary,
    articleBody: rule.body,
    url: `${SITE_URL}/rules/${rule.slug}`,
    datePublished: rule.createdAt,
    dateModified: rule.updatedAt,
    author: {
      "@type": "Person",
      name: rule.author.displayName,
      url: `${SITE_URL}/authors/${rule.author.handle}`,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    keywords: rule.tags.map((t) => t.name),
  };
}

/**
 * Generate JSON-LD structured data for an author
 */
export function generateAuthorJsonLd(author: {
  displayName: string;
  handle: string;
  bio?: string;
  avatarUrl?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.displayName,
    alternateName: `@${author.handle}`,
    description: author.bio,
    image: author.avatarUrl,
    url: `${SITE_URL}/authors/${author.handle}`,
    sameAs: [`${SITE_URL}/authors/${author.handle}`],
  };
}
