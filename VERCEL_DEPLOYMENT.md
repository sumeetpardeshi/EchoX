# Vercel Deployment Guide

Complete guide for deploying EchoX to Vercel.

## Prerequisites

- ✅ GitHub repository with your code
- ✅ Vercel account (free tier works)
- ✅ Supabase project set up
- ✅ All environment variables ready

## Step 1: Prepare Your Repository

1. **Commit all changes:**
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push
   ```

2. **Verify these files exist:**
   - ✅ `vercel.json` (configured)
   - ✅ `package.json` (with build script)
   - ✅ `app/api/` directory (serverless functions)

## Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect it's a Vite project

## Step 3: Configure Build Settings

Vercel should auto-detect, but verify:

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

## Step 4: Set Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

### Required Variables

```env
# XAI API Key
XAI_API_KEY=your_xai_api_key_here

# Supabase (Server-side - for API routes)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Supabase (Client-side - for frontend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Internal Secrets (generate random strings)
INTERNAL_SECRET=your_random_secret_string_here
CRON_SECRET=your_random_cron_secret_here

# Optional: Gemini API (if using)
GEMINI_API_KEY=your_gemini_key_here
```

### Important Notes:

1. **VITE_ Prefix:** Client-side variables MUST have `VITE_` prefix for Vite projects
2. **Environment Scope:** 
   - Set all variables for **Production**
   - Optionally set for **Preview** and **Development** too
3. **Secrets:** Generate random strings for `INTERNAL_SECRET` and `CRON_SECRET`:
   ```bash
   # Generate random secrets
   openssl rand -hex 32
   ```

## Step 5: Deploy

1. Click **"Deploy"** in Vercel
2. Wait for build to complete (2-5 minutes)
3. Check build logs for any errors

## Step 6: Verify Deployment

### 1. Test API Endpoints

```bash
# Test trending endpoint
curl https://your-app.vercel.app/api/trending

# Test with interests filter
curl "https://your-app.vercel.app/api/trending?interests=Tech,Crypto"
```

### 2. Check Cron Jobs

1. Go to Vercel Dashboard → Your Project → **Cron Jobs**
2. You should see `/api/cron/trending` scheduled every 30 minutes
3. Wait for first run (or trigger manually)

### 3. Test Frontend

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Check browser console for errors
3. Try selecting interests and verify filtering works

## Step 7: Post-Deployment Setup

### 1. Populate Initial Data

After first deployment, run the populate script locally to seed the database:

```bash
npm run populate-db
```

Or manually trigger the refresh endpoint:

```bash
curl -X POST https://your-app.vercel.app/api/refresh/trending \
  -H "Authorization: Bearer your_internal_secret"
```

### 2. Verify Supabase Storage

1. Go to Supabase Dashboard → Storage
2. Verify buckets exist:
   - ✅ `trending-audio` (public)
   - ✅ `trending-images` (public)
3. Check that files are being uploaded

### 3. Monitor Logs

- **Vercel Logs:** Dashboard → Your Project → **Logs**
- **Cron Job Logs:** Dashboard → Your Project → **Cron Jobs** → Click on job
- **Supabase Logs:** Dashboard → Logs → API Logs

## Troubleshooting

### Build Fails

**Error: "Module not found"**
- Check all dependencies are in `package.json`
- Run `npm install` locally to verify

**Error: "Environment variable not found"**
- Verify all env vars are set in Vercel Dashboard
- Check variable names match exactly (case-sensitive)

### API Routes Not Working

**404 on `/api/trending`**
- Check `vercel.json` rewrite rules
- Verify files are in `app/api/` directory
- Check Vercel logs for routing errors

### Cron Job Not Running

**Cron job not executing:**
- Verify `CRON_SECRET` is set in environment variables
- Check cron job path matches in `vercel.json`
- Wait 30 minutes for first scheduled run
- Check Vercel → Cron Jobs for status

**Cron job failing:**
- Check Vercel logs for error messages
- Verify all environment variables are set
- Check Supabase connection

### Environment Variables Not Working

**Client-side vars not accessible:**
- Ensure `VITE_` prefix is used
- Redeploy after adding new variables
- Check browser console for undefined values

**Server-side vars not accessible:**
- Variables without `VITE_` prefix are server-only
- Check API route logs in Vercel

## Configuration Files

### vercel.json

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/app/api/$1"
    }
  ],
  "functions": {
    "app/api/**/*.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 300
    }
  },
  "crons": [
    {
      "path": "/api/cron/trending",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

## Environment Variables Checklist

Before deploying, ensure you have:

- [ ] `XAI_API_KEY`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `INTERNAL_SECRET`
- [ ] `CRON_SECRET`
- [ ] `GEMINI_API_KEY` (optional)

## Next Steps After Deployment

1. ✅ Test all API endpoints
2. ✅ Verify cron job is running
3. ✅ Populate initial database
4. ✅ Test interest filtering
5. ✅ Monitor logs for errors
6. ✅ Set up custom domain (optional)

## Support

If you encounter issues:
1. Check Vercel logs first
2. Verify all environment variables
3. Check Supabase dashboard for errors
4. Review this guide's troubleshooting section

