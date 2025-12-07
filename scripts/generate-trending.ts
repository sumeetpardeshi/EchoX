/**
 * Script to manually generate trending topics with audio and save to database
 * Run with: npx tsx scripts/generate-trending.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envLocalPath = join(__dirname, '..', '.env.local');
const envPath = join(__dirname, '..', '.env');

if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Import services
import { initXAIService } from '../services/xaiService.js';
import { generateAudioForTweets } from '../services/audioGenerationService.js';
import { cacheService } from '../services/cacheService.js';

async function main() {
  console.log('🚀 Starting trending topics generation with audio...\n');

  // Check environment variables
  const xaiKey = process.env.XAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!xaiKey) {
    console.error('❌ XAI_API_KEY not found');
    process.exit(1);
  }

  if (!geminiKey) {
    console.error('❌ GEMINI_API_KEY not found');
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found');
    console.error('   Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  try {
    // Initialize services
    console.log('📦 Initializing services...');
    const xaiService = initXAIService(xaiKey);
    console.log('✅ XAI Service initialized\n');

    // Step 1: Fetch trending topics
    console.log('📰 Step 1: Fetching trending topics from XAI...');
    const tweets = await xaiService.fetchTrending();
    console.log(`✅ Fetched ${tweets.length} trending topics\n`);

    if (tweets.length === 0) {
      console.error('❌ No trending topics found');
      process.exit(1);
    }

    // Step 2: Generate audio for all tweets
    console.log('🎤 Step 2: Generating audio for all tweets...');
    console.log('   This may take a few minutes...\n');
    
    const tweetsWithAudio = await generateAudioForTweets(tweets);
    
    const audioCount = tweetsWithAudio.filter(t => t.audioUrl).length;
    console.log(`✅ Generated audio for ${audioCount}/${tweetsWithAudio.length} tweets\n`);

    // Step 3: Save to database
    console.log('💾 Step 3: Saving to database...');
    await cacheService.saveTrending(tweetsWithAudio);
    console.log('✅ Saved to database!\n');

    // Summary
    console.log('='.repeat(50));
    console.log('✅ Successfully generated and cached trending topics!');
    console.log(`   - Topics: ${tweetsWithAudio.length}`);
    console.log(`   - With audio: ${audioCount}`);
    console.log('='.repeat(50));
    console.log('\n🎉 Done! Users can now get instant audio playback.\n');

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();

