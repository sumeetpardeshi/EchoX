# Add Missing Environment Variables

The test found some missing keys. Add these to your `.env.local` file:

## Missing Keys

### 1. Internal Secrets (for API route protection)

Add these to your `.env.local`:

```env
INTERNAL_SECRET=82a2500c63c766da75a5f0b770c8a56a040e863777bb5ad9a7ed3d416c19be4f
CRON_SECRET=39c5ebcded96d8643224dc8cc1a7777bfab9f40c6b61cdc2cf1508aa8d2d0eb6
```

### 2. Supabase Keys

Add these to your `.env.local` (get them from Supabase Dashboard → Settings → API):

```env
# Supabase Configuration
SUPABASE_URL=https://ixonhypcadjznduyqaea.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_SUPABASE_URL=https://ixonhypcadjznduyqaea.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## Quick Steps

1. Open `.env.local` in your editor
2. Add the missing keys above
3. Replace `your_service_role_key_here` and `your_anon_key_here` with actual keys from Supabase
4. Save the file
5. Run `npm run test-setup` again

## Where to Find Supabase Keys

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
   - **anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

See `FIND_SUPABASE_KEYS.md` for detailed instructions.

