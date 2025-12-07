import { supabase, supabaseClient } from '../lib/supabase';
import { Tweet } from '../types';

const CACHE_TTL_MINUTES = 30;
const TABLE_NAME = 'trending_topics_v2'; // Use new table structure (one row per trend)

// Get the appropriate Supabase client (server-side or client-side)
function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    // Browser: use client-side client with anon key
    return supabaseClient;
  } else {
    // Server: use service role client
    return supabase;
  }
}

export class CacheService {
  async getTrending(): Promise<{ 
    tweets: Tweet[]; 
    cached: boolean; 
    generatedAt: Date;
    expired?: boolean;
  } | null> {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('Supabase client not available');
      return null;
    }

    try {
      // First try to get non-expired entries
      const { data: latestBatch, error: batchError } = await client
        .from(TABLE_NAME)
        .select('generated_at')
        .gt('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!batchError && latestBatch) {
        // Get all tweets from this batch (non-expired)
        const { data: tweets, error } = await client
          .from(TABLE_NAME)
          .select('tweet_data, generated_at')
          .eq('generated_at', latestBatch.generated_at)
          .gt('expires_at', new Date().toISOString())
          .order('id', { ascending: true });

        if (!error && tweets && tweets.length > 0) {
          return {
            tweets: tweets.map(row => row.tweet_data as Tweet),
            cached: true,
            generatedAt: new Date(latestBatch.generated_at),
            expired: false
          };
        }
      }

      // If no valid entries, try to get expired entries (stale data)
      const { data: expiredBatch, error: expiredBatchError } = await client
        .from(TABLE_NAME)
        .select('generated_at')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (expiredBatchError || !expiredBatch) {
        // Fallback to old table structure for backward compatibility
        return this.getTrendingLegacy();
      }

      // Get all tweets from this batch (even if expired)
      const { data: tweets, error } = await client
        .from(TABLE_NAME)
        .select('tweet_data, generated_at, expires_at')
        .eq('generated_at', expiredBatch.generated_at)
        .order('id', { ascending: true });

      if (error || !tweets || tweets.length === 0) {
        // Fallback to legacy
        return this.getTrendingLegacy();
      }

      // Check if expired
      const isExpired = tweets[0]?.expires_at 
        ? new Date(tweets[0].expires_at) < new Date()
        : true;

      return {
        tweets: tweets.map(row => row.tweet_data as Tweet),
        cached: true,
        generatedAt: new Date(expiredBatch.generated_at),
        expired: isExpired
      };
    } catch (error) {
      console.error('Error fetching trending cache:', error);
      // Fallback to legacy
      return this.getTrendingLegacy();
    }
  }

  // Legacy method for backward compatibility with old table structure
  private async getTrendingLegacy(): Promise<{ 
    tweets: Tweet[]; 
    cached: boolean; 
    generatedAt: Date;
    expired?: boolean;
  } | null> {
    const client = getSupabaseClient();
    if (!client) {
      return null;
    }

    try {
      // Try non-expired first
      const { data, error } = await client
        .from('trending_topics')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          tweets: data.tweets as Tweet[],
          cached: true,
          generatedAt: new Date(data.generated_at),
          expired: false
        };
      }

      // Try expired entries
      const { data: expiredData, error: expiredError } = await client
        .from('trending_topics')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (expiredError || !expiredData) {
        return null;
      }

      const isExpired = new Date(expiredData.expires_at) < new Date();

      return {
        tweets: expiredData.tweets as Tweet[],
        cached: true,
        generatedAt: new Date(expiredData.generated_at),
        expired: isExpired
      };
    } catch (error) {
      return null;
    }
  }

  async saveTrending(tweets: Tweet[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not available');
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + CACHE_TTL_MINUTES);
    const generatedAt = new Date().toISOString();

    // Insert each tweet as a separate row
    const records = tweets.map(tweet => ({
      tweet_id: tweet.id,
      generated_at: generatedAt,
      expires_at: expiresAt.toISOString(),
      tweet_data: tweet,
      version: 1
    }));

    const { error } = await client
      .from(TABLE_NAME)
      .insert(records);

    if (error) {
      console.error('Error saving trending cache:', error);
      throw error;
    }
  }

  // Clean up old entries (optional, can run periodically)
  async cleanupOldEntries(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) {
      return;
    }

    const { error } = await client
      .from(TABLE_NAME)
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error cleaning up old entries:', error);
    }
  }

  // Get a single trend by ID (returns expired entries too, like getTrending)
  async getTrendById(tweetId: string): Promise<Tweet | null> {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('Supabase client not available');
      return null;
    }

    try {
      // First try to get non-expired entry
      const { data, error } = await client
        .from(TABLE_NAME)
        .select('tweet_data')
        .eq('tweet_id', tweetId)
        .gt('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return data.tweet_data as Tweet;
      }

      // If not found or expired, try to get expired entry (stale data)
      const { data: expiredData, error: expiredError } = await client
        .from(TABLE_NAME)
        .select('tweet_data')
        .eq('tweet_id', tweetId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!expiredError && expiredData) {
        console.log('⚠️ Found expired story (using stale data)');
        return expiredData.tweet_data as Tweet;
      }

      return null;
    } catch (error) {
      console.error('Error fetching trend by ID:', error);
      return null;
    }
  }
}

export const cacheService = new CacheService();
