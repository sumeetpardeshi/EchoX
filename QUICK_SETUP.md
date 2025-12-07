# Quick Setup Guide - Manual Supabase Setup

You don't need the Supabase MCP integration marketplace. Let's set it up manually - it's actually easier!

## Step 1: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project (or create a new one)
3. Go to **Settings** → **API**
4. Copy these values:
   - **Project URL**: `https://ixonhypcadjznduyqaea.supabase.co` (or your project URL)
   - **Service Role Key**: (Keep this secret! Use for server-side)
   - **Anon Key**: (Public key, safe for client-side)

## Step 2: Create the Database Table

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste this SQL:

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

4. Click **Run** (or press Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned"

## Step 3: Create Storage Bucket

1. Go to **Storage** in the left sidebar
2. Click **Create bucket**
3. Fill in:
   - **Name**: `trending-audio`
   - **Public bucket**: ✅ **Toggle ON** (This is important!)
4. Click **Create bucket**

## Step 4: Set Up Environment Variables

Create a `.env` file in your project root (or add to existing):

```env
# Supabase
SUPABASE_URL=https://ixonhypcadjznduyqaea.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_SUPABASE_URL=https://ixonhypcadjznduyqaea.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# API Keys (you should already have these)
XAI_API_KEY=your_xai_key
GEMINI_API_KEY=your_gemini_key

# Internal Secrets (generate random strings)
INTERNAL_SECRET=your_random_secret_string_here
CRON_SECRET=your_random_cron_secret_here
```

**To generate random secrets:**
```bash
# Run this in terminal to generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 5: Verify Setup

### Test Database Connection

You can test if everything works by running a simple query in Supabase SQL Editor:

```sql
SELECT * FROM trending_topics LIMIT 1;
```

(Should return empty result, which is fine - means table exists!)

### Test Storage Bucket

1. Go to **Storage** → **trending-audio**
2. Try uploading a test file
3. Check if you can access it via public URL

## Step 6: Test the API (Optional)

Once you have environment variables set, you can test:

```bash
# Start your dev server
npm run dev

# In another terminal, test the endpoint
curl http://localhost:3000/api/trending
```

## For Vercel Deployment

When deploying to Vercel:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all the environment variables from Step 4
3. Deploy!

## Troubleshooting

### "Table doesn't exist"
- Make sure you ran the SQL in Step 2
- Check you're in the correct project

### "Storage bucket not found"
- Make sure bucket name is exactly `trending-audio`
- Check it's set to Public

### "Unauthorized" errors
- Double-check your Service Role Key
- Make sure environment variables are set correctly

### MCP Connection

Your existing MCP config should work for querying:
```json
"supabase": {
  "url": "https://mcp.supabase.com/mcp?project_ref=ixonhypcadjznduyqaea",
  "headers": {}
}
```

You can use this to query the database, but you don't need it for the initial setup!

## Next Steps

Once setup is complete:
1. The cron job will automatically generate trending topics + audio every 30 minutes
2. Users will get instant audio playback from cached data
3. Check Vercel logs to see cron job execution

