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

      // Fallback to old table structure (backward compatibility)
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

      const tweets = data.tweets as Tweet[];
      
      // Filter by interests if provided
      if (interestsRef.current && interestsRef.current.length > 0) {
        return filterTweetsByInterests(tweets, interestsRef.current);
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
      
      // Strategy 1: Try API endpoint (production)
      if (import.meta.env.PROD || import.meta.env.VITE_USE_API === 'true') {
        try {
          // Build URL with interests query parameter
          const interestsParam = interestsRef.current && interestsRef.current.length > 0
            ? `?interests=${interestsRef.current.join(',')}`
            : '';
          const response = await fetch(`/api/trending${interestsParam}`);
          if (response.ok) {
            const data = await response.json();
            if (data.tweets && data.tweets.length > 0) {
              console.log('📦 API tweets retrieved:', data.tweets.length);
              console.log('🔍 First tweet audioUrl:', data.tweets[0]?.audioUrl || 'MISSING');
              if (interestsRef.current && interestsRef.current.length > 0) {
                console.log(`🎯 Filtered by interests: ${interestsRef.current.join(", ")}`);
              }
              setTrendingTweets(data.tweets);
              setIsUsingLiveData(true);
              setIsUsingCache(data.cached || false);
              console.log(`✅ Got ${data.tweets.length} topics from API (cached: ${data.cached})`);
              setIsLoading(false);
              return;
            }
          }
        } catch (apiError) {
          console.warn('API unavailable, trying cache...', apiError);
        }
      }

      // Strategy 2: Try reading from Supabase directly (local dev)
      const cachedTweets = await readFromCache();
      if (cachedTweets && cachedTweets.length > 0) {
        console.log('📦 Cached tweets retrieved:', cachedTweets.length);
        console.log('🔍 First tweet audioUrl:', cachedTweets[0]?.audioUrl || 'MISSING');
        setTrendingTweets(cachedTweets);
        setIsUsingLiveData(true);
        setIsUsingCache(true);
        console.log(`✅ Got ${cachedTweets.length} topics from cache (direct read)`);
        setIsLoading(false);
        return;
      }

      // Strategy 3: Fallback to direct XAI call
      if (!xaiService) {
        setError('XAI service not configured');
        setIsLoading(false);
        return;
      }
      
      console.log('📡 Fetching directly from XAI (no cache available)...');
      if (interestsRef.current && interestsRef.current.length > 0) {
        console.log(`🎯 Using interests: ${interestsRef.current.join(", ")}`);
      }
      const tweets = await xaiService.fetchTrending(filtersRef.current, undefined, interestsRef.current);
      if (tweets.length > 0) {
        setTrendingTweets(tweets);
        setIsUsingLiveData(true);
        setIsUsingCache(false);
        console.log(`✅ Got ${tweets.length} topics (direct)`);
      } else {
        setError('No trending topics found');
      }
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

