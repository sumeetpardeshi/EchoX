import { useState, useEffect, useCallback } from 'react';
import { Tweet } from '../types';
import { XAIService, initXAIService } from '../services/xaiService';

interface UseXAITweetsReturn {
  trendingTweets: Tweet[];
  myFeedTweets: Tweet[];
  isLoading: boolean;
  error: string | null;
  refetchTrending: () => Promise<void>;
  refetchMyFeed: () => Promise<void>;
  isUsingLiveData: boolean;
}

export function useXAITweets(xaiApiKey: string | null): UseXAITweetsReturn {
  // Start with empty arrays - we fetch everything live
  const [trendingTweets, setTrendingTweets] = useState<Tweet[]>([]);
  const [myFeedTweets, setMyFeedTweets] = useState<Tweet[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start loading immediately
  const [error, setError] = useState<string | null>(null);
  const [xaiService, setXaiService] = useState<XAIService | null>(null);
  const [isUsingLiveData, setIsUsingLiveData] = useState(false);

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
    if (!xaiService) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🎙️ Fetching live trending topics...');
      const tweets = await xaiService.fetchTrending();
      if (tweets.length > 0) {
        setTrendingTweets(tweets);
        setIsUsingLiveData(true);
        console.log(`✅ Got ${tweets.length} trending topics`);
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
      const tweets = await xaiService.fetchPersonalizedFeed(['AI', 'Tech', 'Startups', 'Science']);
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

