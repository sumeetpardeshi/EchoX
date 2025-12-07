import { supabase } from '../lib/supabase';
import { Tweet } from '../types';

const CACHE_TTL_MINUTES = 30;
const TABLE_NAME = 'trending_topics_v2'; // Use new table structure (one row per trend)

export class CacheService {
  async getTrending(): Promise<{ 
    tweets: Tweet[]; 
    cached: boolean; 
    generatedAt: Date 
  } | null> {
    try {
      // Get the latest generation batch (all tweets with same generated_at)
      const { data: latestBatch, error: batchError } = await supabase
        .from(TABLE_NAME)
        .select('generated_at')
        .gt('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (batchError || !latestBatch) {
        // Fallback to old table structure for backward compatibility
        return this.getTrendingLegacy();
      }

      // Get all tweets from this batch
      const { data: tweets, error } = await supabase
        .from(TABLE_NAME)
        .select('tweet_data, generated_at')
        .eq('generated_at', latestBatch.generated_at)
        .gt('expires_at', new Date().toISOString())
        .order('id', { ascending: true });

      if (error || !tweets || tweets.length === 0) {
        return null;
      }

      return {
        tweets: tweets.map(row => row.tweet_data as Tweet),
        cached: true,
        generatedAt: new Date(latestBatch.generated_at)
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
    generatedAt: Date 
  } | null> {
    try {
      const { data, error } = await supabase
        .from('trending_topics')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return {
        tweets: data.tweets as Tweet[],
        cached: true,
        generatedAt: new Date(data.generated_at)
      };
    } catch (error) {
      return null;
    }
  }

  async saveTrending(tweets: Tweet[]): Promise<void> {
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

    const { error } = await supabase
      .from(TABLE_NAME)
      .insert(records);

    if (error) {
      console.error('Error saving trending cache:', error);
      throw error;
    }
  }

  // Clean up old entries (optional, can run periodically)
  async cleanupOldEntries(): Promise<void> {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error cleaning up old entries:', error);
    }
  }

  // Get a single trend by ID
  async getTrendById(tweetId: string): Promise<Tweet | null> {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('tweet_data')
        .eq('tweet_id', tweetId)
        .gt('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data.tweet_data as Tweet;
    } catch (error) {
      console.error('Error fetching trend by ID:', error);
      return null;
    }
  }
}

export const cacheService = new CacheService();
