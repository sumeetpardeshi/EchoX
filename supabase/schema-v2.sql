-- Updated schema: One row per trending topic (better for querying and updates)

-- Drop old table if exists (optional - only if you want to migrate)
-- DROP TABLE IF EXISTS trending_topics;

CREATE TABLE IF NOT EXISTS trending_topics_v2 (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT NOT NULL,  -- Unique ID for the tweet/trend
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  tweet_data JSONB NOT NULL,  -- Single tweet/trend data
  version INTEGER DEFAULT 1,
  -- Unique constraint: one record per tweet_id per generation batch
  UNIQUE(tweet_id, generated_at)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_trending_expires_v2 ON trending_topics_v2(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_trending_tweet_id_v2 ON trending_topics_v2(tweet_id);
CREATE INDEX IF NOT EXISTS idx_trending_generated_v2 ON trending_topics_v2(generated_at DESC);

-- Migration: If you want to keep both tables during transition
-- You can query both and merge results

