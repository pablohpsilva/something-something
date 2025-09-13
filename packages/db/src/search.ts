import { prisma } from "./client";

export type SearchFilters = {
  tags?: string[];
  model?: string;
  status?: "PUBLISHED" | "DEPRECATED" | "ALL";
  contentType?: "PROMPT" | "RULE" | "MCP" | "GUIDE";
  authorHandle?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export type SearchResultRow = {
  ruleId: string;
  slug: string;
  title: string;
  summary: string | null;
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  scoreFinal: number;
  ftsRank: number;
  trend: number;
  snippet: string | null;
  tags: string[];
  primaryModel: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SuggestionRow = {
  ruleId: string;
  slug: string;
  title: string;
  similarity: number;
};

/**
 * Build a tsquery from user input with proper escaping and prefix matching
 */
function buildTsQuery(query: string): string {
  if (!query || query.trim().length === 0) {
    return "";
  }

  const trimmed = query.trim();

  // For very short queries, use simple term matching
  if (trimmed.length < 2) {
    return `'${trimmed.replace(/'/g, "''")}'`;
  }

  // Split into words and handle special cases
  const words = trimmed
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => {
      // Remove special characters that could break tsquery
      const cleaned = word.replace(/[^\w\-"]/g, "");
      if (cleaned.length === 0) return null;

      // Escape single quotes
      return cleaned.replace(/'/g, "''");
    })
    .filter(Boolean);

  if (words.length === 0) {
    return "";
  }

  // Add prefix matching to the last word for autocomplete-like behavior
  const lastIndex = words.length - 1;
  words[lastIndex] = `${words[lastIndex]}:*`;

  return words.join(" & ");
}

/**
 * Search rules using Postgres Full-Text Search with trending score integration
 */
export async function searchRulesDB(
  query: string,
  filters: SearchFilters,
  limit = 20,
  offset = 0
): Promise<SearchResultRow[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const tsQuery = buildTsQuery(query);
  if (!tsQuery) {
    return [];
  }

  // Build WHERE conditions for filters
  const whereConditions: string[] = [];
  const queryParams: any[] = [tsQuery, limit, offset];
  let paramIndex = 4;

  // Status filter
  if (filters.status === "ALL") {
    whereConditions.push(`r.status IN ('PUBLISHED', 'DEPRECATED')`);
  } else if (filters.status === "DEPRECATED") {
    whereConditions.push(`r.status = 'DEPRECATED'`);
  } else {
    // Default to PUBLISHED only
    whereConditions.push(`r.status = 'PUBLISHED'`);
  }

  // Tags filter
  if (filters.tags && filters.tags.length > 0) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM "RuleTag" rt2 
      JOIN "Tag" t2 ON t2.id = rt2."tagId" 
      WHERE rt2."ruleId" = r.id 
      AND t2.slug = ANY($${paramIndex})
    )`);
    queryParams.push(filters.tags);
    paramIndex++;
  }

  // Model filter
  if (filters.model) {
    whereConditions.push(`r."primaryModel" = $${paramIndex}`);
    queryParams.push(filters.model);
    paramIndex++;
  }

  // Content type filter
  if (filters.contentType) {
    whereConditions.push(`r."contentType" = $${paramIndex}`);
    queryParams.push(filters.contentType);
    paramIndex++;
  }

  // Author filter
  if (filters.authorHandle) {
    whereConditions.push(`u.handle = $${paramIndex}`);
    queryParams.push(filters.authorHandle);
    paramIndex++;
  }

  // Date range filters
  if (filters.dateFrom) {
    whereConditions.push(`r."createdAt" >= $${paramIndex}`);
    queryParams.push(filters.dateFrom);
    paramIndex++;
  }

  if (filters.dateTo) {
    whereConditions.push(`r."createdAt" <= $${paramIndex}`);
    queryParams.push(filters.dateTo);
    paramIndex++;
  }

  const whereClause =
    whereConditions.length > 0 ? `AND ${whereConditions.join(" AND ")}` : "";

  const searchQuery = `
    WITH search_results AS (
      SELECT 
        r.id as rule_id,
        r.slug,
        r.title,
        r.summary,
        r."primaryModel",
        r.status,
        r."createdAt",
        r."updatedAt",
        u.id as author_id,
        u.handle as author_handle,
        u."displayName" as author_display_name,
        u."avatarUrl" as author_avatar_url,
        rs.tsv,
        -- FTS ranking
        ts_rank_cd(rs.tsv, websearch_to_tsquery('english', unaccent($1))) as fts_rank,
        -- Get latest trending score
        COALESCE(m.score, 0) as trend_raw,
        -- Normalize trending score (0-1)
        CASE 
          WHEN max_score.max_val > 0 THEN COALESCE(m.score, 0) / max_score.max_val
          ELSE 0
        END as trend_norm
      FROM rule_search rs
      JOIN "Rule" r ON r.id = rs.rule_id
      JOIN "User" u ON u.id = r."createdByUserId"
      LEFT JOIN LATERAL (
        SELECT score FROM "RuleMetricDaily" 
        WHERE "ruleId" = r.id 
        ORDER BY date DESC 
        LIMIT 1
      ) m ON true
      CROSS JOIN (
        SELECT GREATEST(1, MAX(score)) as max_val 
        FROM "RuleMetricDaily"
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      ) max_score
      WHERE rs.tsv @@ websearch_to_tsquery('english', unaccent($1))
      ${whereClause}
    ),
    ranked_results AS (
      SELECT 
        *,
        -- Final blended score: 70% FTS relevance + 30% trending
        -- Apply penalty for deprecated rules
        CASE 
          WHEN status = 'DEPRECATED' THEN (0.7 * fts_rank + 0.3 * trend_norm) * 0.8
          ELSE (0.7 * fts_rank + 0.3 * trend_norm)
        END as score_final,
        -- Generate snippet with highlights
        ts_headline(
          'english',
          COALESCE(summary, ''),
          websearch_to_tsquery('english', unaccent($1)),
          'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MinWords=5, MaxWords=20'
        ) as snippet
      FROM search_results
    )
    SELECT 
      rr.*,
      -- Get tags as array
      COALESCE(
        array_agg(DISTINCT t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL),
        ARRAY[]::text[]
      ) as tags
    FROM ranked_results rr
    LEFT JOIN "RuleTag" rt ON rt."ruleId" = rr.rule_id
    LEFT JOIN "Tag" t ON t.id = rt."tagId"
    GROUP BY 
      rr.rule_id, rr.slug, rr.title, rr.summary, rr."primaryModel", 
      rr.status, rr."createdAt", rr."updatedAt", rr.author_id, 
      rr.author_handle, rr.author_display_name, rr.author_avatar_url,
      rr.fts_rank, rr.trend_raw, rr.trend_norm, rr.score_final, rr.snippet
    ORDER BY 
      rr.score_final DESC, 
      rr.fts_rank DESC, 
      rr."updatedAt" DESC,
      rr.rule_id ASC
    LIMIT $2 OFFSET $3
  `;

  try {
    const results = await prisma.$queryRaw<any[]>`${searchQuery}`;

    return results.map((row) => ({
      ruleId: row.rule_id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      authorId: row.author_id,
      authorHandle: row.author_handle,
      authorDisplayName: row.author_display_name,
      authorAvatarUrl: row.author_avatar_url,
      scoreFinal: Number(row.score_final),
      ftsRank: Number(row.fts_rank),
      trend: Number(row.trend_norm),
      snippet: row.snippet,
      tags: Array.isArray(row.tags) ? row.tags : [],
      primaryModel: row.primaryModel,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch (error) {
    console.error("Search query failed:", error);
    return [];
  }
}

/**
 * Get search suggestions using trigram similarity
 */
export async function suggestRulesDB(
  query: string,
  limit = 8
): Promise<SuggestionRow[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const trimmed = query.trim().toLowerCase();

  try {
    const results = await prisma.$queryRaw<any[]>`
      SELECT 
        r.id as rule_id,
        r.slug,
        r.title,
        GREATEST(
          similarity(LOWER(r.title), ${trimmed}),
          similarity(r.slug, ${trimmed})
        ) as similarity_score
      FROM "Rule" r
      WHERE r.status = 'PUBLISHED'
        AND (
          similarity(LOWER(r.title), ${trimmed}) > 0.2
          OR similarity(r.slug, ${trimmed}) > 0.2
        )
      ORDER BY similarity_score DESC, r."updatedAt" DESC
      LIMIT ${limit}
    `;

    return results.map((row) => ({
      ruleId: row.rule_id,
      slug: row.slug,
      title: row.title,
      similarity: Number(row.similarity_score),
    }));
  } catch (error) {
    console.error("Suggestion query failed:", error);
    return [];
  }
}

/**
 * Refresh search index for a specific rule
 */
export async function refreshRuleSearch(ruleId: string): Promise<void> {
  try {
    await prisma.$executeRaw`SELECT update_rule_tsv(${ruleId})`;
  } catch (error) {
    console.error(`Failed to refresh search for rule ${ruleId}:`, error);
    throw error;
  }
}

/**
 * Rebuild all search indexes (admin function)
 */
export async function rebuildAllSearch(): Promise<number> {
  try {
    const result = await prisma.$queryRaw<[{ rebuild_all_search: number }]>`
      SELECT rebuild_all_search()
    `;
    return result[0]?.rebuild_all_search || 0;
  } catch (error) {
    console.error("Failed to rebuild search indexes:", error);
    throw error;
  }
}

/**
 * Get search statistics
 */
export async function getSearchStats(): Promise<{
  totalIndexed: number;
  lastUpdated: Date | null;
  avgTsvLength: number;
}> {
  try {
    const result = await prisma.$queryRaw<
      any[]
    >`SELECT * FROM get_search_stats()`;
    const stats = result[0];

    return {
      totalIndexed: stats?.total_indexed || 0,
      lastUpdated: stats?.last_updated || null,
      avgTsvLength: Number(stats?.avg_tsv_length || 0),
    };
  } catch (error) {
    console.error("Failed to get search stats:", error);
    return {
      totalIndexed: 0,
      lastUpdated: null,
      avgTsvLength: 0,
    };
  }
}

/**
 * Search rules with simple text matching (fallback for very short queries)
 */
export async function searchRulesSimple(
  query: string,
  filters: SearchFilters,
  limit = 20,
  offset = 0
): Promise<SearchResultRow[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchTerm = `%${query.trim().toLowerCase()}%`;

  // Build WHERE conditions
  const whereConditions: string[] = [
    "(LOWER(r.title) LIKE $1 OR LOWER(r.summary) LIKE $1)",
  ];
  const queryParams: any[] = [searchTerm, limit, offset];
  let paramIndex = 4;

  // Apply same filters as FTS search
  if (filters.status === "ALL") {
    whereConditions.push(`r.status IN ('PUBLISHED', 'DEPRECATED')`);
  } else if (filters.status === "DEPRECATED") {
    whereConditions.push(`r.status = 'DEPRECATED'`);
  } else {
    whereConditions.push(`r.status = 'PUBLISHED'`);
  }

  if (filters.tags && filters.tags.length > 0) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM "RuleTag" rt2 
      JOIN "Tag" t2 ON t2.id = rt2."tagId" 
      WHERE rt2."ruleId" = r.id 
      AND t2.slug = ANY($${paramIndex})
    )`);
    queryParams.push(filters.tags);
    paramIndex++;
  }

  const whereClause = whereConditions.join(" AND ");

  try {
    const results = await prisma.$queryRaw<any[]>`
      SELECT 
        r.id as rule_id,
        r.slug,
        r.title,
        r.summary,
        r."primaryModel",
        r.status,
        r."createdAt",
        r."updatedAt",
        u.id as author_id,
        u.handle as author_handle,
        u."displayName" as author_display_name,
        u."avatarUrl" as author_avatar_url,
        0.5 as fts_rank,
        0.0 as trend_norm,
        0.5 as score_final,
        r.summary as snippet,
        COALESCE(
          array_agg(DISTINCT t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL),
          ARRAY[]::text[]
        ) as tags
      FROM "Rule" r
      JOIN "User" u ON u.id = r."createdByUserId"
      LEFT JOIN "RuleTag" rt ON rt."ruleId" = r.id
      LEFT JOIN "Tag" t ON t.id = rt."tagId"
      WHERE ${whereClause}
      GROUP BY 
        r.id, r.slug, r.title, r.summary, r."primaryModel", 
        r.status, r."createdAt", r."updatedAt", 
        u.id, u.handle, u."displayName", u."avatarUrl"
      ORDER BY 
        CASE WHEN LOWER(r.title) LIKE $1 THEN 1 ELSE 2 END,
        r."updatedAt" DESC,
        r.id ASC
      LIMIT $2 OFFSET $3
    `;

    return results.map((row) => ({
      ruleId: row.rule_id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      authorId: row.author_id,
      authorHandle: row.author_handle,
      authorDisplayName: row.author_display_name,
      authorAvatarUrl: row.author_avatar_url,
      scoreFinal: Number(row.score_final),
      ftsRank: Number(row.fts_rank),
      trend: Number(row.trend_norm),
      snippet: row.snippet,
      tags: Array.isArray(row.tags) ? row.tags : [],
      primaryModel: row.primaryModel,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch (error) {
    console.error("Simple search query failed:", error);
    return [];
  }
}
