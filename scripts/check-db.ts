/**
 * Script to check what's in the database
 */

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

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

async function main() {
  console.log('🔍 Checking database contents...\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found');
    console.error('   SUPABASE_URL:', supabaseUrl ? 'Found' : 'Missing');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Found' : 'Missing');
    process.exit(1);
  }

  // Fix MCP URL if needed
  let actualUrl = supabaseUrl;
  if (supabaseUrl.includes('mcp.supabase.com')) {
    const projectRefMatch = supabaseUrl.match(/project_ref=([^&]+)/);
    if (projectRefMatch) {
      actualUrl = `https://${projectRefMatch[1]}.supabase.co`;
      console.log(`📍 Detected MCP URL, using: ${actualUrl}\n`);
    }
  }

  try {
    const supabase = createClient(actualUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if table exists (try new structure first)
    console.log('📊 Checking table...');
    let allData: any[] | null = null;
    let listError: any = null;
    
    // Try new table structure first
    const { data: newData, error: newError } = await supabase
      .from('trending_topics_v2')
      .select('id, tweet_id, generated_at, expires_at, version')
      .order('generated_at', { ascending: false });

    if (!newError && newData) {
      allData = newData;
      console.log('✅ Using new table structure (trending_topics_v2)\n');
    } else {
      // Fallback to old structure
      const { data: oldData, error: oldError } = await supabase
        .from('trending_topics')
        .select('id, generated_at, expires_at, version')
        .order('generated_at', { ascending: false });
      
      allData = oldData;
      listError = oldError;
      if (!oldError) {
        console.log('✅ Using legacy table structure (trending_topics)\n');
      }
    }

    if (listError) {
      if (listError.code === 'PGRST116' || listError.message.includes('does not exist')) {
        console.error('❌ Tables do not exist!');
        console.error('   → Run the SQL from supabase/schema-v2.sql in Supabase SQL Editor\n');
        process.exit(1);
      }
      throw listError;
    }

    console.log(`✅ Table exists\n`);
    console.log(`📦 Total records: ${allData?.length || 0}\n`);

    if (!allData || allData.length === 0) {
      console.log('⚠️  No records found in database\n');
      console.log('💡 Run: npm run populate-db\n');
      process.exit(0);
    }

    // Group by generation batch
    const batches = new Map<string, any[]>();
    allData?.forEach((record) => {
      const batchKey = record.generated_at;
      if (!batches.has(batchKey)) {
        batches.set(batchKey, []);
      }
      batches.get(batchKey)!.push(record);
    });

    // Show all batches
    console.log('📋 Generation batches:');
    Array.from(batches.entries()).forEach(([batchTime, records], batchIndex) => {
      const generatedAt = new Date(batchTime);
      const firstRecord = records[0];
      const expiresAt = new Date(firstRecord.expires_at);
      const now = new Date();
      const isExpired = expiresAt < now;
      
      console.log(`\n   Batch ${batchIndex + 1}: ${records.length} trends`);
      console.log(`      Generated: ${generatedAt.toLocaleString()}`);
      console.log(`      Expires: ${expiresAt.toLocaleString()}`);
      console.log(`      Status: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`);
    });

    // Get the latest valid batch
    console.log('\n🔍 Latest valid batch:');
    const latestBatchTime = Array.from(batches.keys()).sort().reverse()[0];
    const latestBatch = batches.get(latestBatchTime);
    
    if (latestBatch && latestBatch.length > 0) {
      const firstRecord = latestBatch[0];
      const expiresAt = new Date(firstRecord.expires_at);
      const now = new Date();
      
      if (expiresAt > now) {
        // Fetch full tweet data for this batch
        const { data: tweetsData, error: tweetsError } = await supabase
          .from('trending_topics_v2')
          .select('tweet_data')
          .eq('generated_at', latestBatchTime)
          .gt('expires_at', new Date().toISOString())
          .order('id', { ascending: true });

        if (!tweetsError && tweetsData) {
          console.log(`   ✅ Found valid cache`);
          console.log(`   📰 Topics: ${tweetsData.length}`);
          console.log(`   📅 Generated: ${new Date(latestBatchTime).toLocaleString()}`);
          
          if (tweetsData.length > 0) {
            console.log('\n   Topics:');
            tweetsData.forEach((row, i) => {
              const tweet = row.tweet_data as any;
              const title = tweet.trendTitle || tweet.content?.substring(0, 40) || 'Untitled';
              const hasAudio = tweet.audioUrl ? '✅' : '❌';
              console.log(`      ${i + 1}. ${title} ${hasAudio} audio`);
              if (tweet.audioUrl) {
                console.log(`         URL: ${tweet.audioUrl.substring(0, 80)}...`);
              }
            });
          }
        }
      } else {
        console.log('   ⚠️  Latest batch is expired');
        console.log('   💡 Run: npm run populate-db\n');
      }
    } else {
      console.log('   ⚠️  No valid (non-expired) records found');
      console.log('   💡 Run: npm run populate-db\n');
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Database check complete\n');

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

