/**
 * Simple script to generate trending topics and save to database
 * (Without audio generation for faster testing)
 * Run with: npx tsx scripts/generate-trending-simple.ts
 */

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
import { cacheService } from '../services/cacheService.js';

async function main() {
  console.log('🚀 Generating trending topics (simple version - no audio)...\n');

  // Check environment variables
  const xaiKey = process.env.XAI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!xaiKey) {
    console.error('❌ XAI_API_KEY not found');
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found');
    console.error('   Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  try {
    // Initialize XAI service
    console.log('📦 Initializing XAI service...');
    const xaiService = initXAIService(xaiKey);
    console.log('✅ XAI Service initialized\n');

    // Fetch trending topics
    console.log('📰 Fetching trending topics from XAI...');
    console.log('   This may take 30-60 seconds...\n');
    
    const tweets = await xaiService.fetchTrending();
    console.log(`✅ Fetched ${tweets.length} trending topics\n`);

    if (tweets.length === 0) {
      console.error('❌ No trending topics found');
      process.exit(1);
    }

    // Display what we got
    console.log('📋 Topics fetched:');
    tweets.forEach((tweet, i) => {
      const title = tweet.trendTitle || tweet.content?.substring(0, 40) || 'Untitled';
      console.log(`   ${i + 1}. ${title}`);
    });
    console.log('');

    // Save to database
    console.log('💾 Saving to database...');
    await cacheService.saveTrending(tweets);
    console.log('✅ Saved to database!\n');

    // Verify it was saved
    console.log('🔍 Verifying database...');
    const cached = await cacheService.getTrending();
    if (cached) {
      console.log(`✅ Verified: ${cached.tweets.length} topics in cache`);
      console.log(`   Generated at: ${cached.generatedAt.toISOString()}\n`);
    }

    // Summary
    console.log('='.repeat(50));
    console.log('✅ Successfully cached trending topics!');
    console.log(`   - Topics: ${tweets.length}`);
    console.log('='.repeat(50));
    console.log('\n💡 Note: Audio generation will happen automatically');
    console.log('   when the cron job runs or when you call the refresh endpoint.\n');
    console.log('🎉 Done! The app should now load faster.\n');

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      if (error.stack) {
        console.error('   Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
      }
    }
    process.exit(1);
  }
}

main();

