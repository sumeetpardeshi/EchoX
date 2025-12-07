/**
 * Enhanced hook that can read from Supabase cache directly in local dev
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Tweet } from '../types';
import { XAIService, initXAIService, SearchFilters } from '../services/xaiService';
import { createClient } from '@supabase/supabase-js';

interface UseXAITweetsOptions {
  xaiApiKey: string | null;
  filters?: Partial<SearchFilters>;
  interests?: string[];
}

interface UseXAITweetsReturn {
  trendingTweets: Tweet[];
  myFeedTweets: Tweet[];
  isLoading: boolean;
  error: string | null;
  refetchTrending: () => Promise<void>;
  refetchMyFeed: () => Promise<void>;
  isUsingLiveData: boolean;
  isUsingCache: boolean;
}

export function useXAITweetsWithCache(
  xaiApiKeyOrOptions: string | null | UseXAITweetsOptions
): UseXAITweetsReturn {
  const options: UseXAITweetsOptions = typeof xaiApiKeyOrOptions === 'object' && xaiApiKeyOrOptions !== null
    ? xaiApiKeyOrOptions
    : { xaiApiKey: xaiApiKeyOrOptions };
  
  const { xaiApiKey, filters, interests = ['AI', 'Tech', 'Science', 'Startups'] } = options;
  const [trendingTweets, setTrendingTweets] = useState<Tweet[]>([]);
  const [myFeedTweets, setMyFeedTweets] = useState<Tweet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [xaiService, setXaiService] = useState<XAIService | null>(null);
  const [isUsingLiveData, setIsUsingLiveData] = useState(false);
  const [isUsingCache, setIsUsingCache] = useState(false);
  
  const filtersRef = useRef(filters);
  const interestsRef = useRef(interests);
  
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  
  useEffect(() => {
    interestsRef.current = interests;
  }, [interests]);

  // Initialize xAI service
  useEffect(() => {
    if (xaiApiKey) {
      const service = initXAIService(xaiApiKey);
      setXaiService(service);
    } else {
      setIsLoading(false);
      setError('XAI API key not configured');
    }
  }, [xaiApiKey]);

  // Try to read from Supabase cache directly (for local dev)
  const readFromCache = useCallback(async (): Promise<Tweet[] | null> => {
    try {
      // Try VITE_ prefixed first (for Vite), then NEXT_PUBLIC_ (for Next.js), then regular
      let supabaseUrl = import.meta.env.VITE_SUPABASE_URL 
        || import.meta.env.NEXT_PUBLIC_SUPABASE_URL 
        || import.meta.env.SUPABASE_URL;
      
      let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY 
        || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      // If URL is MCP endpoint, extract project ref and build proper URL
      if (supabaseUrl && supabaseUrl.includes('mcp.supabase.com')) {
        const projectRefMatch = supabaseUrl.match(/project_ref=([^&]+)/);
        if (projectRefMatch) {
          supabaseUrl = `https://${projectRefMatch[1]}.supabase.co`;
        }
      }
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.log('Cache read skipped: Missing Supabase credentials');
        return null;
      }

      console.log('📖 Reading from Supabase cache...');
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      // Try new table structure first (trending_topics_v2 - one row per trend)
      const { data: latestBatch, error: batchError } = await supabase
        .from('trending_topics_v2')
        .select('generated_at')
        .gt('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!batchError && latestBatch) {
        // Get all tweets from this batch (new structure)
        const { data: tweets, error } = await supabase
          .from('trending_topics_v2')
          .select('tweet_data')
          .eq('generated_at', latestBatch.generated_at)
          .gt('expires_at', new Date().toISOString())
          .order('id', { ascending: true });

        if (!error && tweets && tweets.length > 0) {
          const allTweets = tweets.map(row => row.tweet_data as Tweet);
          
          // Filter by interests if provided
          if (interestsRef.current && interestsRef.current.length > 0) {
            const filtered = filterTweetsByInterests(allTweets, interestsRef.current);
            console.log(`✅ Found ${allTweets.length} trends, filtered to ${filtered.length} matching interests: ${interestsRef.current.join(", ")}`);
            return filtered;
          }
          
          console.log(`✅ Found ${allTweets.length} trends with audio from cache (v2)`);
          return allTweets;
        }
      }

      // If no valid entries, try expired entries (stale data)
      const { data: expiredBatch, error: expiredBatchError } = await supabase
        .from('trending_topics_v2')
        .select('generated_at')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!expiredBatchError && expiredBatch) {
        // Get all tweets from this batch (even if expired)
        const { data: tweets, error } = await supabase
          .from('trending_topics_v2')
          .select('tweet_data')
          .eq('generated_at', expiredBatch.generated_at)
          .order('id', { ascending: true });

        if (!error && tweets && tweets.length > 0) {
          const allTweets = tweets.map(row => row.tweet_data as Tweet);
          console.log(`⚠️ Found ${allTweets.length} expired trends (using stale data)`);
          
          // Filter by interests if provided
          if (interestsRef.current && interestsRef.current.length > 0) {
            console.log('🔍 Filtering results by interests:', interestsRef.current);
            console.log('   Available topics:', [...new Set(allTweets.map(t => t.topic))].join(', '));
            
            const filtered = filterTweetsByInterests(allTweets, interestsRef.current);
            console.log(`✅ Filtered from ${allTweets.length} to ${filtered.length} matching items`);
            
            if (filtered.length === 0) {
              console.warn('⚠️ All items were filtered out! Returning original list as fallback.');
              return allTweets;
            }
            return filtered;
          }
          
          return allTweets;
        }
      }

      // Fallback to old table structure (backward compatibility)
      // Try non-expired first
      const { data, error } = await supabase
        .from('trending_topics')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const tweets = data.tweets as Tweet[];
        
        // Filter by interests if provided
        if (interestsRef.current && interestsRef.current.length > 0) {
          console.log('🔍 Filtering legacy results by interests:', interestsRef.current);
          const filtered = filterTweetsByInterests(tweets, interestsRef.current);
          
          if (filtered.length > 0) {
             return filtered;
          }
          console.warn('⚠️ All items were filtered out! Returning original list as fallback.');
        }
        
        return tweets;
      }

      // Try expired entries from old table
      const { data: expiredData, error: expiredError } = await supabase
        .from('trending_topics')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!expiredError && expiredData) {
        const tweets = expiredData.tweets as Tweet[];
        console.log(`⚠️ Found ${tweets.length} expired trends from legacy table (using stale data)`);
        
        // Filter by interests if provided
        if (interestsRef.current && interestsRef.current.length > 0) {
          return filterTweetsByInterests(tweets, interestsRef.current);
        }
        
        return tweets;
      }

      return null;

      const tweets = data.tweets as Tweet[];
      
      // Filter by interests if provided
      if (interestsRef.current && interestsRef.current.length > 0) {
        console.log('🔍 Filtering fresh results by interests:', interestsRef.current);
        const filtered = filterTweetsByInterests(tweets, interestsRef.current);
        
        if (filtered.length > 0) {
           return filtered;
        }
        console.warn('⚠️ All items were filtered out! Returning original list as fallback.');
      }
      
      return tweets;
    } catch (err) {
      console.warn('Error reading from cache:', err);
      return null;
    }
  }, []);

  // Helper function to filter tweets by interests
  const filterTweetsByInterests = (tweets: Tweet[], interests: string[]): Tweet[] => {
    if (!interests || interests.length === 0) {
      return tweets;
    }

    // Normalize interests to match topic values (case-insensitive)
    const normalizedInterests = interests.map(i => i.toLowerCase());
    
    return tweets.filter(tweet => {
      const topic = (tweet.topic || '').toLowerCase();
      // Check if topic matches any interest, or if interests include common variations
      return normalizedInterests.some(interest => {
        // Direct match
        if (topic === interest) return true;
        // Partial match (e.g., "Tech" matches "Technology")
        if (topic.includes(interest) || interest.includes(topic)) return true;
        // Special cases
        if (interest === 'tech' && (topic === 'ai' || topic === 'technology')) return true;
        if (interest === 'crypto' && (topic === 'cryptocurrency' || topic === 'blockchain')) return true;
        return false;
      });
    });
  };

  // Fetch trending topics
  const refetchTrending = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🎙️ Fetching trending topics...');
      
      // Strategy 1: Try API endpoint first (always prefer cache via API)
      try {
        // Build URL with interests query parameter
        const interestsParam = interestsRef.current && interestsRef.current.length > 0
          ? `?interests=${interestsRef.current.join(',')}`
          : '';
        const response = await fetch(`/api/trending${interestsParam}`);
        if (response.ok) {
          const data = await response.json();
          // Accept cached data (even if empty - means cache is being populated)
          if (data.tweets) {
            console.log('📦 API response:', data.tweets.length, 'tweets');
            console.log('🔍 Cached:', data.cached, 'Stale:', data.stale || false);
            if (data.tweets.length > 0) {
              console.log('🔍 First tweet audioUrl:', data.tweets[0]?.audioUrl || 'MISSING');
            }
            if (interestsRef.current && interestsRef.current.length > 0) {
              console.log(`🎯 Filtered by interests: ${interestsRef.current.join(", ")}`);
            }
            setTrendingTweets(data.tweets);
            setIsUsingLiveData(false); // Always from cache when using API
            setIsUsingCache(data.cached || false);
            if (data.empty) {
              console.log('⏳ Cache empty, background refresh triggered. Please wait...');
            } else if (data.stale) {
              console.log('🔄 Using stale cache, refresh in progress...');
            } else {
              console.log(`✅ Got ${data.tweets.length} topics from cache`);
            }
            setIsLoading(false);
            return;
          }
        }
      } catch (apiError) {
        console.warn('API unavailable, trying direct cache read...', apiError);
      }

      // Strategy 2: Try reading from Supabase directly (local dev fallback)
      const cachedTweets = await readFromCache();
      if (cachedTweets && cachedTweets.length > 0) {
        console.log('📦 Cached tweets retrieved directly:', cachedTweets.length);
        console.log('🔍 First tweet audioUrl:', cachedTweets[0]?.audioUrl || 'MISSING');
        setTrendingTweets(cachedTweets);
        setIsUsingLiveData(false);
        setIsUsingCache(true);
        console.log(`✅ Got ${cachedTweets.length} topics from cache (direct read)`);
        setIsLoading(false);
        return;
      }

      // Strategy 3: No cache available - show message instead of fetching live
      console.warn('⚠️ No cached data available. Cache should be populated by background jobs.');
      setTrendingTweets([]);
      setIsUsingLiveData(false);
      setIsUsingCache(false);
      setError('No cached data available. Please wait for background refresh or run populate-db script.');
    } catch (err) {
      console.error('❌ Error fetching trending:', err);
      setError('Failed to fetch trending content');
    } finally {
      setIsLoading(false);
    }
  }, [xaiService, readFromCache]);

  // Fetch personalized feed (unchanged - still uses direct calls)
  const refetchMyFeed = useCallback(async () => {
    if (!xaiService) return;

    setIsLoading(true);
    setError(null);

    try {
      const tweets = await xaiService.fetchPersonalizedFeed(
        interestsRef.current,
        filtersRef.current
      );
      if (tweets.length > 0) {
        setMyFeedTweets(tweets);
        setIsUsingLiveData(true);
        setIsUsingCache(false);
      } else {
        setError('No content found for your interests');
      }
    } catch (err) {
      console.error('❌ Error fetching feed:', err);
      setError('Failed to fetch feed content');
    } finally {
      setIsLoading(false);
    }
  }, [xaiService]);

  // Auto-fetch when service becomes available
  useEffect(() => {
    if (xaiService && !isUsingLiveData) {
      refetchTrending().catch(console.error);
    }
  }, [xaiService, isUsingLiveData, refetchTrending]);

  return {
    trendingTweets,
    myFeedTweets,
    isLoading,
    error,
    refetchTrending,
    refetchMyFeed,
    isUsingLiveData,
    isUsingCache,
  };
}

