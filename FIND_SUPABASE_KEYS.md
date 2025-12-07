# How to Find Your Supabase Keys

## Step-by-Step Guide

### Step 1: Go to Supabase Dashboard

1. Open [https://app.supabase.com](https://app.supabase.com)
2. Log in to your account
3. Select your project (or create a new one if you don't have one)

### Step 2: Navigate to API Settings

1. In the left sidebar, click on **Settings** (gear icon at the bottom)
2. Click on **API** in the settings menu

### Step 3: Find Your Keys

You'll see a page with several sections. Here's what you need:

#### 📍 Project URL
- **Location**: At the top of the page, under "Project URL"
- **Looks like**: `https://ixonhypcadjznduyqaea.supabase.co`
- **Use for**: `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`

#### 🔑 anon / public key
- **Location**: In the "Project API keys" section
- **Label**: "anon" or "public" key
- **Looks like**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long JWT token)
- **Use for**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Note**: This is safe to use in client-side code (it's public)

#### 🔐 service_role / secret key
- **Location**: In the "Project API keys" section
- **Label**: "service_role" or "secret" key
- **Looks like**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long JWT token)
- **Use for**: `SUPABASE_SERVICE_ROLE_KEY`
- **⚠️ IMPORTANT**: 
  - This key has **full admin access** to your database
  - **NEVER** expose this in client-side code
  - Only use it in server-side code (API routes, backend)
  - Keep it secret!

### Step 4: Copy Your Keys

1. Click the **eye icon** 👁️ next to the key to reveal it
2. Click the **copy icon** 📋 to copy the key
3. Paste it into your `.env` file

## Visual Guide

```
Supabase Dashboard
├── Settings (gear icon)
    └── API
        ├── Project URL: https://your-project.supabase.co
        └── Project API keys
            ├── anon / public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
            └── service_role / secret: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Your .env File Should Look Like:

```env
# Supabase Configuration
SUPABASE_URL=https://ixonhypcadjznduyqaea.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your_service_role_key
NEXT_PUBLIC_SUPABASE_URL=https://ixonhypcadjznduyqaea.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your_anon_key

# Your existing API keys
XAI_API_KEY=your_xai_key
GEMINI_API_KEY=your_gemini_key

# Generated secrets (use the ones from terminal)
INTERNAL_SECRET=82a2500c63c766da75a5f0b770c8a56a040e863777bb5ad9a7ed3d416c19be4f
CRON_SECRET=39c5ebcded96d8643224dc8cc1a7777bfab9f40c6b61cdc2cf1508aa8d2d0eb6
```

## Quick Checklist

- [ ] Found Project URL
- [ ] Found anon/public key
- [ ] Found service_role/secret key
- [ ] Copied all keys to `.env` file
- [ ] Verified keys are correct (no extra spaces)

## Troubleshooting

### "I don't see the keys"
- Make sure you're in the correct project
- Check you're in Settings → API (not Database or other sections)
- Try refreshing the page

### "The key is hidden"
- Click the eye icon 👁️ to reveal it
- Some browsers may hide it - try clicking the copy icon directly

### "Which key is which?"
- **anon/public**: Shorter label, safe for client-side
- **service_role/secret**: Longer label, **NEVER** use in client-side code

## Security Reminder

🔒 **Never commit your `.env` file to git!**

Make sure `.env` is in your `.gitignore` file. The keys, especially `SUPABASE_SERVICE_ROLE_KEY`, give full database access!

