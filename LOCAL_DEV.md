# Local Development Guide

## Option 1: Use Vercel CLI (Recommended for Testing API Routes)

This allows you to test the full stack including API routes locally.

### Setup

1. Install Vercel CLI globally:
```bash
npm install -g vercel
```

2. Run Vercel dev server:
```bash
vercel dev
```

This will:
- Start your Vite frontend
- Run serverless functions locally
- Handle API routes (`/api/trending`, etc.)

### Access

- Frontend: http://localhost:3000
- API routes will work at http://localhost:3000/api/trending

## Option 2: Vite Dev Server Only (Current Setup)

For frontend-only development:

```bash
npm run dev
```

**Note**: API routes won't work, but the app will automatically fall back to direct XAI API calls.

### What Works
- ✅ Frontend development
- ✅ Direct XAI API calls (no caching)
- ✅ Client-side audio generation

### What Doesn't Work
- ❌ `/api/trending` endpoint (falls back to direct calls)
- ❌ Pre-generated audio (uses client-side generation)
- ❌ Cached trending topics

## Option 3: Enable API in Local Dev

If you want to test API routes with Vite dev server, add to `.env.local`:

```env
VITE_USE_API=true
```

Then the frontend will try to call API routes. But you'll still need Vercel CLI or a separate server for the API routes to work.

## Recommended Workflow

### For Frontend Development
```bash
npm run dev
```
- Fast iteration
- Direct API calls work
- No need for backend

### For Full Stack Testing
```bash
vercel dev
```
- Tests complete flow
- API routes work
- Pre-generated audio works
- Caching works

### For Production
Deploy to Vercel - everything works automatically!

## Troubleshooting

### "ECONNREFUSED" Error
- This is normal if you're using `npm run dev` without `vercel dev`
- The app will automatically fall back to direct XAI calls
- To fix: Use `vercel dev` instead

### API Routes Not Working
- Make sure you're using `vercel dev` not `npm run dev`
- Check environment variables are set
- Verify Supabase connection

