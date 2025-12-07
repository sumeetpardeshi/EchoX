# Supabase Setup Using MCP

You can use Supabase MCP to help set up the database and storage.

## Step 1: Create the Table

You can run the SQL from `supabase/schema.sql` directly in Supabase Dashboard, or use MCP if it supports SQL execution.

The SQL to run:

```sql
CREATE TABLE IF NOT EXISTS trending_topics (
  id BIGSERIAL PRIMARY KEY,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  tweets JSONB NOT NULL,
  version INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_trending_expires ON trending_topics(expires_at DESC);
```

## Step 2: Create Storage Buckets

### Bucket 1: trending-audio

1. Go to Supabase Dashboard → Storage
2. Click "Create bucket"
3. Name: `trending-audio`
4. **Important**: Set to **Public** (so audio URLs are accessible)
5. Click "Create bucket"

### Bucket 2: trending-images

1. Go to Supabase Dashboard → Storage
2. Click "Create bucket"
3. Name: `trending-images`
4. **Important**: Set to **Public** (so image URLs are accessible)
5. Click "Create bucket"

## Step 3: Get Your Credentials

From Supabase Dashboard → Settings → API:

- **Project URL**: `https://your-project.supabase.co`
- **Service Role Key**: (Keep this secret! Use for server-side)
- **Anon Key**: (Public key, safe for client-side)

## Step 4: Test Connection

Once you've set up environment variables, the cache service will automatically connect when API routes are called.

## Verification

After setup, you can verify:

1. **Table exists**: Check Supabase Dashboard → Table Editor → `trending_topics_v2`
2. **Buckets exist**: Check Supabase Dashboard → Storage → `trending-audio` and `trending-images`
3. **API works**: Call `/api/trending` endpoint
4. **Populate data**: Run `npm run populate-db` to generate and store audio/images

## Using MCP

If your Supabase MCP supports it, you can:
- Query the database to verify setup
- Check storage bucket configuration
- Monitor cache entries

