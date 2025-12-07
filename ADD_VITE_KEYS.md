# Add Vite Environment Variables

For the cache to work in the browser, add these to your `.env.local`:

```env
# Add these lines to .env.local for client-side cache access
VITE_SUPABASE_URL=https://ixonhypcadjznduyqaea.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Important**: 
- Keys starting with `VITE_` are exposed to the browser
- Use the **anon key** (not service_role key) for client-side
- Get the anon key from Supabase Dashboard → Settings → API

## Quick Steps

1. Open `.env.local`
2. Add the two lines above
3. Replace `your_anon_key_here` with your actual anon key
4. Save the file
5. **Restart your dev server** (`npm run dev`)

## Verify It Works

After restarting, check the browser console. You should see:
```
✅ Got 5 topics from cache (direct read)
```

Instead of:
```
📡 Fetching directly from XAI...
```

## Why VITE_ Prefix?

Vite only exposes environment variables that start with `VITE_` to the client-side code. This is a security feature.

