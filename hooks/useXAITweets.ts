import { useState, useEffect, useCallback, useRef } from 'react';
import { Tweet } from '../types';
import { XAIService, initXAIService, SearchFilters } from '../services/xaiService';

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
}

export function useXAITweets(
  xaiApiKeyOrOptions: string | null | UseXAITweetsOptions
): UseXAITweetsReturn {
  // Handle both old API (just api key) and new API (options object)
  const options: UseXAITweetsOptions = typeof xaiApiKeyOrOptions === 'object' && xaiApiKeyOrOptions !== null
    ? xaiApiKeyOrOptions
    : { xaiApiKey: xaiApiKeyOrOptions };
  
  const { xaiApiKey, filters, interests = ['AI', 'Tech', 'Science', 'Startups'] } = options;
  // Start with empty arrays - we fetch everything live
  const [trendingTweets, setTrendingTweets] = useState<Tweet[]>([]);
  const [myFeedTweets, setMyFeedTweets] = useState<Tweet[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start loading immediately
  const [error, setError] = useState<string | null>(null);
  const [xaiService, setXaiService] = useState<XAIService | null>(null);
  const [isUsingLiveData, setIsUsingLiveData] = useState(false);
  
  // Store current filters and interests for use in callbacks
  const filtersRef = useRef(filters);
  const interestsRef = useRef(interests);
  
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  
  useEffect(() => {
    interestsRef.current = interests;
  }, [interests]);

  // Initialize xAI service when API key is available
  useEffect(() => {
    if (xaiApiKey) {
      const service = initXAIService(xaiApiKey);
      setXaiService(service);
    } else {
      setIsLoading(false);
      setError('XAI API key not configured');
    }
  }, [xaiApiKey]);

  // Fetch trending topics
  const refetchTrending = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🎙️ Fetching trending topics from backend...');
      console.log('📋 Using filters:', filtersRef.current);
      
      // Try backend API first (only in production or when using vercel dev)
      // In local dev without vercel dev, this will fail and fall back to direct calls
      if (import.meta.env.PROD || import.meta.env.VITE_USE_API === 'true') {
        try {
          const response = await fetch('/api/trending');
          if (response.ok) {
            const data = await response.json();
            if (data.tweets && data.tweets.length > 0) {
              setTrendingTweets(data.tweets);
              setIsUsingLiveData(true);
              console.log(`✅ Got ${data.tweets.length} trending topics from cache (cached: ${data.cached})`);
              setIsLoading(false);
              return;
            }
          }
        } catch (apiError) {
          console.warn('Backend API unavailable, falling back to direct call:', apiError);
        }
      } else {
        console.log('📝 Local dev mode: Using direct XAI calls (use "vercel dev" for API routes)');
      }
      
      // Fallback to direct XAI call if backend unavailable
      if (!xaiService) {
        setError('XAI service not configured');
        setIsLoading(false);
        return;
      }
      
      const tweets = await xaiService.fetchTrending(filtersRef.current);
      if (tweets.length > 0) {
        setTrendingTweets(tweets);
        setIsUsingLiveData(true);
        console.log(`✅ Got ${tweets.length} trending topics (direct)`);
      } else {
        setError('No trending topics found');
      }
    } catch (err) {
      console.error('❌ Error fetching trending:', err);
      setError('Failed to fetch trending content');
    } finally {
      setIsLoading(false);
    }
  }, [xaiService]);

  // Fetch personalized feed
  const refetchMyFeed = useCallback(async () => {
    if (!xaiService) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🎙️ Fetching personalized feed...');
      console.log('📋 Using interests:', interestsRef.current);
      console.log('📋 Using filters:', filtersRef.current);
      const tweets = await xaiService.fetchPersonalizedFeed(
        interestsRef.current,
        filtersRef.current
      );
      if (tweets.length > 0) {
        setMyFeedTweets(tweets);
        setIsUsingLiveData(true);
        console.log(`✅ Got ${tweets.length} personalized topics`);
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
      // Fetch both feeds in parallel
      Promise.all([
        refetchTrending(),
        refetchMyFeed(),
      ]).catch(console.error);
    }
  }, [xaiService, isUsingLiveData, refetchTrending, refetchMyFeed]);

  return {
    trendingTweets,
    myFeedTweets,
    isLoading,
    error,
    refetchTrending,
    refetchMyFeed,
    isUsingLiveData,
  };
}

