<div align="center">
  <img src="public/favicon.svg" width="100" height="100" alt="EchoX Logo" />
  <h1>EchoX</h1>
  <p><strong>Listen to the pulse of X. Live trending stories, transformed into audio.</strong></p>
</div>

---

EchoX is an AI-powered audio news feed that turns real-time trending topics from X (formerly Twitter) into engaging, podcast-style audio snippets. By combining live data from **Grok (xAI)** with advanced text-to-speech and image generation, EchoX creates an immersive listening experience for staying up to date with the world.

## 🚀 Features

### 🎧 AI Audio Feed
- **Instant Podcasts:** Converts complex trending topics into natural, conversational audio summaries (2-3 sentences).
- **Grok Voices:** Utilizes high-quality, expressive AI voices (Ara, Rex, Sal, Eve, Una, Leo) for narration.
- **Continuous Playback:** Spotify-style audio player with auto-advance, skip, and progress tracking.

### ⚡ Real-Time & Live
- **Live X Data:** Fetches the absolute latest trends using xAI's Grok API.
- **Smart Caching:** leverages **Supabase** to cache generated audio and images for instant, latency-free playback on subsequent visits.
- **Source Transparency:** View the actual "Top Tweets" and sources driving the trend on detailed story pages.

### 🎨 Immersive UI/UX
- **Visual Storytelling:** Generates contextual AI images for every story to accompany the audio.
- **Mobile-First Design:** A sleek, app-like experience optimized for mobile devices (iOS/Android).
- **Dark Mode:** Cinematic dark interface with subtle animations and "echo" ripple effects.

### 🔍 Discovery (Beta)
- **Categorized Trends:** Browse stories by topics like Tech, AI, Space, Crypto, Sports, and more.
- **Search & Personalization:** (Coming Soon) Filter feeds based on your specific interests.

## 🛠️ Tech Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **AI & Data:** xAI API (Grok-2/Grok-beta)
- **Backend/Storage:** Supabase (PostgreSQL, Storage Buckets)
- **Analytics:** Vercel Analytics
- **Deployment:** Vercel

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase Account
- xAI API Key
- Gemini API Key (Optional fallback)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/echox.git
   cd echox
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` or `.env.local` file with your keys:
   ```env
   # AI Services
   XAI_API_KEY=your_xai_key_here
   GEMINI_API_KEY=your_gemini_key_here

   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Run Locally**
   ```bash
   npm run dev
   ```

### 📦 Populating Content
To pre-generate a batch of stories (useful for demos or filling the cache): 
```bash
# Generates 10 stories for each category (Tech, AI, Space, etc.)
npm run populate-db
```
the plan is to have this running as cron powered by intelligent recommendation engine 

## 📄 License

MIT License. Built for the xAI Hackathon.
