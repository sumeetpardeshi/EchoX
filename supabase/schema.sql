-- Trending topics with pre-generated audio
CREATE TABLE IF NOT EXISTS trending_topics (
  id BIGSERIAL PRIMARY KEY,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  tweets JSONB NOT NULL, -- Full tweet data with audioUrl, summary, etc.
  version INTEGER DEFAULT 1
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_trending_expires ON trending_topics(expires_at DESC);

-- Storage bucket for audio files
-- Note: Create this bucket in Supabase Dashboard:
-- 1. Go to Storage
-- 2. Create new bucket: "trending-audio"
-- 3. Set it to Public
-- 4. Enable RLS if needed, but allow public read access

