/**
 * Test script to verify Supabase and API setup
 * Run with: npx tsx test-setup.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try .env.local first (Vite default), then .env
const envLocalPath = join(__dirname, '.env.local');
const envPath = join(__dirname, '.env');

let envLoaded = false;
if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log('✅ Loaded .env.local file\n');
  envLoaded = true;
} else if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('✅ Loaded .env file\n');
  envLoaded = true;
} else {
  console.log('⚠️  No .env or .env.local file found. Using environment variables from system.\n');
  // Try to load from process.env (might be set in system)
  dotenv.config();
}

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL not found in environment variables');
    return false;
  }

  if (!supabaseKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
    return false;
  }

  console.log(`✅ Found Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
  console.log(`✅ Found Service Role Key: ${supabaseKey.substring(0, 20)}...\n`);

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test 1: Check if table exists
    console.log('📊 Test 1: Checking if trending_topics table exists...');
    const { data: tableData, error: tableError } = await supabase
      .from('trending_topics')
      .select('id')
      .limit(1);

    if (tableError) {
      if (tableError.code === 'PGRST116' || tableError.message.includes('does not exist')) {
        console.error('❌ Table "trending_topics" does not exist!');
        console.log('   → Run the SQL from supabase/schema.sql in Supabase SQL Editor\n');
        return false;
      }
      throw tableError;
    }

    console.log('✅ Table exists!\n');

    // Test 2: Check storage bucket
    console.log('📦 Test 2: Checking if trending-audio bucket exists...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
      throw bucketError;
    }

    const audioBucket = buckets?.find(b => b.name === 'trending-audio');
    if (!audioBucket) {
      console.error('❌ Storage bucket "trending-audio" not found!');
      console.log('   → Create it in Supabase Dashboard → Storage\n');
      return false;
    }

    console.log('✅ Storage bucket exists!');
    console.log(`   → Public: ${audioBucket.public ? 'Yes ✅' : 'No ❌ (should be public!)'}\n`);

    // Test 3: Try to insert a test record (then delete it)
    console.log('💾 Test 3: Testing database write access...');
    const testExpiresAt = new Date();
    testExpiresAt.setMinutes(testExpiresAt.getMinutes() + 30);

    const { data: insertData, error: insertError } = await supabase
      .from('trending_topics')
      .insert({
        tweets: [],
        expires_at: testExpiresAt.toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log('✅ Write access works!');

    // Clean up test record
    if (insertData?.id) {
      await supabase
        .from('trending_topics')
        .delete()
        .eq('id', insertData.id);
      console.log('✅ Cleaned up test record\n');
    }

    // Test 4: Check storage write access
    console.log('📤 Test 4: Testing storage write access...');
    const testBlob = new Blob(['test'], { type: 'text/plain' });
    const testFileName = `test-${Date.now()}.txt`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('trending-audio')
      .upload(testFileName, testBlob, {
        contentType: 'text/plain'
      });

    if (uploadError) {
      console.error('❌ Storage write failed:', uploadError.message);
      return false;
    }

    console.log('✅ Storage write access works!');

    // Clean up test file
    if (uploadData?.path) {
      await supabase.storage
        .from('trending-audio')
        .remove([testFileName]);
      console.log('✅ Cleaned up test file\n');
    }

    console.log('🎉 All Supabase tests passed!\n');
    return true;

  } catch (error) {
    console.error('❌ Error testing Supabase:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    return false;
  }
}

async function testAPIKeys() {
  console.log('🔑 Testing API Keys...\n');

  const xaiKey = process.env.XAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const internalSecret = process.env.INTERNAL_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  const checks = [
    { name: 'XAI_API_KEY', value: xaiKey, required: true },
    { name: 'GEMINI_API_KEY', value: geminiKey, required: true },
    { name: 'INTERNAL_SECRET', value: internalSecret, required: true },
    { name: 'CRON_SECRET', value: cronSecret, required: true },
  ];

  let allPresent = true;
  for (const check of checks) {
    if (check.value) {
      console.log(`✅ ${check.name}: Present`);
    } else {
      console.log(`❌ ${check.name}: Missing${check.required ? ' (REQUIRED)' : ''}`);
      if (check.required) allPresent = false;
    }
  }

  console.log('');
  return allPresent;
}

async function main() {
  console.log('🚀 Testing EchoX Setup\n');
  console.log('=' .repeat(50) + '\n');

  // Test API Keys
  const apiKeysOk = await testAPIKeys();
  if (!apiKeysOk) {
    console.log('⚠️  Some API keys are missing. Please check your .env file.\n');
  }

  // Test Supabase
  const supabaseOk = await testSupabaseConnection();

  console.log('=' .repeat(50) + '\n');

  if (apiKeysOk && supabaseOk) {
    console.log('✅ All tests passed! Your setup is ready.\n');
    console.log('Next steps:');
    console.log('1. Deploy to Vercel or use "vercel dev" to test API routes');
    console.log('2. The cron job will automatically generate trending topics + audio');
    console.log('3. Users will get instant audio playback from cached data\n');
  } else {
    console.log('❌ Some tests failed. Please fix the issues above.\n');
    process.exit(1);
  }
}

main().catch(console.error);

