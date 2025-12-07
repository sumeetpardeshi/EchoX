# Pre-Generated Audio Setup Guide

This guide will help you set up the pre-generated audio system for trending topics.

## Prerequisites

1. Supabase account and project
2. Vercel account (for deployment)
3. Environment variables configured

## Step 1: Set Up Supabase Database

### Create the Table

Run the SQL in `supabase/schema.sql` in your Supabase SQL Editor:

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

### Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "Create bucket"
3. Name: `trending-audio`
4. Set to **Public**
5. Enable RLS if needed, but allow public read access

## Step 2: Install Dependencies

```bash
npm install @supabase/supabase-js
```

## Step 3: Configure Environment Variables

### Local Development (.env)

```env
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# API Keys
XAI_API_KEY=your_xai_api_key
GEMINI_API_KEY=your_gemini_api_key

# Internal Secrets (for API route protection)
INTERNAL_SECRET=your_random_secret_string
CRON_SECRET=your_random_cron_secret
```

### Vercel Environment Variables

Add all the above variables in Vercel Dashboard → Settings → Environment Variables

## Step 4: Test the Setup

### 1. Test Database Connection

The cache service will automatically connect when the API routes are called.

### 2. Manually Trigger Audio Generation

You can manually trigger the refresh endpoint to generate audio:

```bash
curl -X POST http://localhost:3000/api/refresh/trending \
  -H "Authorization: Bearer your_internal_secret"
```

### 3. Test Trending Endpoint

```bash
curl http://localhost:3000/api/trending
```

## Step 5: Deploy to Vercel

1. Push your code to GitHub
2. Connect your repo to Vercel
3. Vercel will automatically:
   - Build your project
   - Deploy serverless functions
   - Set up cron jobs (every 30 minutes)

## How It Works

1. **Cron Job** (`/api/cron/trending`): Runs every 30 minutes
   - Fetches trending topics from XAI
   - Generates audio for each topic
   - Uploads audio to Supabase Storage
   - Saves tweets with audio URLs to database

2. **Trending Endpoint** (`/api/trending`): Serves cached data
   - Checks database for fresh cache
   - Returns cached tweets with pre-generated audio URLs
   - Falls back to generating on-demand if cache expired

3. **Frontend**: Uses pre-generated audio
   - Fetches trending topics from `/api/trending`
   - If `audioUrl` exists, loads audio directly (instant playback!)
   - Falls back to client-side generation if needed

## Troubleshooting

### Audio not playing
- Check Supabase Storage bucket is public
- Verify audio URLs are accessible
- Check browser console for CORS errors

### Cache not updating
- Verify cron job is running (check Vercel logs)
- Check `CRON_SECRET` matches in environment variables
- Manually trigger refresh endpoint

### Database errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check table exists in Supabase
- Verify RLS policies allow access

## Next Steps

- Monitor audio generation in Vercel logs
- Check Supabase Storage usage
- Optimize audio file sizes if needed
- Add error handling for failed audio generation

