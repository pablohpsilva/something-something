-- Enable required extensions for Full-Text Search
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create search index table for materialized tsvector
CREATE TABLE IF NOT EXISTS rule_search (
  rule_id TEXT PRIMARY KEY REFERENCES "Rule"(id) ON DELETE CASCADE,
  tsv tsvector NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_rule_search_tsv ON rule_search USING GIN (tsv);

-- Additional indexes for search performance
CREATE INDEX IF NOT EXISTS idx_rule_search_updated_at ON rule_search (updated_at);

-- Function to update rule tsvector with weighted fields
CREATE OR REPLACE FUNCTION update_rule_tsv(p_rule_id TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_title TEXT;
  v_summary TEXT;
  v_body TEXT;
  v_tags TEXT;
  v_model TEXT;
  v_current_version_id TEXT;
BEGIN
  -- Get rule data
  SELECT r.title, r.summary, r."primaryModel", r."currentVersionId"
    INTO v_title, v_summary, v_model, v_current_version_id
  FROM "Rule" r
  WHERE r.id = p_rule_id;

  -- Skip if rule doesn't exist
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Get current version body
  IF v_current_version_id IS NULL THEN
    v_body := '';
  ELSE
    SELECT rv.body INTO v_body 
    FROM "RuleVersion" rv 
    WHERE rv.id = v_current_version_id;
    
    IF NOT FOUND THEN
      v_body := '';
    END IF;
  END IF;

  -- Get concatenated tag names
  SELECT string_agg(t.name, ' ')
    INTO v_tags
  FROM "RuleTag" rt
  JOIN "Tag" t ON t.id = rt."tagId"
  WHERE rt."ruleId" = p_rule_id;

  -- Build weighted tsvector
  -- A: title (highest weight)
  -- B: tags + primaryModel (high weight)
  -- C: summary (medium weight)
  -- D: body (lowest weight)
  INSERT INTO rule_search(rule_id, tsv, updated_at)
  VALUES (
    p_rule_id,
    setweight(to_tsvector('english', unaccent(coalesce(v_title,''))), 'A') ||
    setweight(to_tsvector('english', unaccent(coalesce(v_tags,'') || ' ' || coalesce(v_model,''))), 'B') ||
    setweight(to_tsvector('english', unaccent(coalesce(v_summary,''))), 'C') ||
    setweight(to_tsvector('english', unaccent(coalesce(v_body,''))), 'D'),
    now()
  )
  ON CONFLICT (rule_id) DO UPDATE
  SET tsv = EXCLUDED.tsv, updated_at = now();
END$$;

-- Trigger function for Rule changes
CREATE OR REPLACE FUNCTION trg_rule_search_on_rule()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Update search index when rule metadata changes
  PERFORM update_rule_tsv(NEW.id);
  RETURN NEW;
END$$;

-- Trigger function for RuleVersion changes
CREATE OR REPLACE FUNCTION trg_rule_search_on_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE 
  v_rule_id TEXT;
  v_is_current BOOLEAN := FALSE;
BEGIN
  -- Get rule ID from version
  IF TG_OP = 'DELETE' THEN
    SELECT rv."ruleId" INTO v_rule_id FROM "RuleVersion" rv WHERE rv.id = OLD.id;
  ELSE
    SELECT rv."ruleId" INTO v_rule_id FROM "RuleVersion" rv WHERE rv.id = NEW.id;
  END IF;
  
  IF v_rule_id IS NOT NULL THEN
    -- Check if this version is/was current for the rule
    SELECT (r."currentVersionId" = COALESCE(NEW.id, OLD.id)) INTO v_is_current
    FROM "Rule" r WHERE r.id = v_rule_id;
    
    -- Only update search if this is the current version
    IF v_is_current THEN
      PERFORM update_rule_tsv(v_rule_id);
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END$$;

-- Trigger function for RuleTag changes
CREATE OR REPLACE FUNCTION trg_rule_search_on_ruletag()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Update search index when tags change
  IF TG_OP = 'DELETE' THEN
    PERFORM update_rule_tsv(OLD."ruleId");
  ELSE
    PERFORM update_rule_tsv(NEW."ruleId");
  END IF;
  RETURN COALESCE(NEW, OLD);
END$$;

-- Create triggers
DROP TRIGGER IF EXISTS trg_rule_search_rule ON "Rule";
CREATE TRIGGER trg_rule_search_rule
AFTER INSERT OR UPDATE OF title, summary, "primaryModel", "currentVersionId" ON "Rule"
FOR EACH ROW EXECUTE PROCEDURE trg_rule_search_on_rule();

DROP TRIGGER IF EXISTS trg_rule_search_version ON "RuleVersion";
CREATE TRIGGER trg_rule_search_version
AFTER INSERT OR UPDATE OF body ON "RuleVersion"
FOR EACH ROW EXECUTE PROCEDURE trg_rule_search_on_version();

DROP TRIGGER IF EXISTS trg_rule_search_ruletag ON "RuleTag";
CREATE TRIGGER trg_rule_search_ruletag
AFTER INSERT OR DELETE ON "RuleTag"
FOR EACH ROW EXECUTE PROCEDURE trg_rule_search_on_ruletag();

-- Function to rebuild all search indexes (admin use)
CREATE OR REPLACE FUNCTION rebuild_all_search()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER := 0;
  v_rule_id TEXT;
BEGIN
  -- Clear existing search data
  TRUNCATE rule_search;
  
  -- Rebuild for all published rules
  FOR v_rule_id IN 
    SELECT id FROM "Rule" WHERE status IN ('PUBLISHED', 'DEPRECATED')
  LOOP
    PERFORM update_rule_tsv(v_rule_id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END$$;

-- Function to get search statistics
CREATE OR REPLACE FUNCTION get_search_stats()
RETURNS TABLE(
  total_indexed INTEGER,
  last_updated TIMESTAMPTZ,
  avg_tsv_length NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_indexed,
    MAX(updated_at) as last_updated,
    AVG(array_length(string_to_array(tsv::text, ' '), 1))::NUMERIC as avg_tsv_length
  FROM rule_search;
END$$;
