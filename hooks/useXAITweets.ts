import { useState, useEffect, useCallback } from 'react';
import { Tweet } from '../types';
import { XAIService, initXAIService } from '../services/xaiService';
import { XProfile, initTwitterService, TwitterService } from '../services/twitterService';

interface UseXAITweetsReturn {
  trendingTweets: Tweet[];
  myFeedTweets: Tweet[];
  isLoading: boolean;
  error: string | null;
  refetchTrending: () => Promise<void>;
  refetchMyFeed: () => Promise<void>;
  isUsingLiveData: boolean;
  isUsingAuthedFeed: boolean;
  xProfile: XProfile | null;
  xAuthError: string | null;
}

export function useXAITweets(
  xaiApiKey: string | null,
  twitterBearerToken: string | null = null,
): UseXAITweetsReturn {
  // Start with empty arrays - we fetch everything live
  const [trendingTweets, setTrendingTweets] = useState<Tweet[]>([]);
  const [myFeedTweets, setMyFeedTweets] = useState<Tweet[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start loading immediately
  const [error, setError] = useState<string | null>(null);
  const [xaiService, setXaiService] = useState<XAIService | null>(null);
  const [isUsingLiveData, setIsUsingLiveData] = useState(false);
  const [isUsingAuthedFeed, setIsUsingAuthedFeed] = useState(false);
  const [xProfile, setXProfile] = useState<XProfile | null>(null);
  const [xAuthError, setXAuthError] = useState<string | null>(null);
  const [twitterService, setTwitterService] = useState<TwitterService | null>(null);

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

  // Initialize Twitter service when bearer token is provided
  useEffect(() => {
    const connect = async () => {
      if (!twitterBearerToken) {
        setTwitterService(null);
        setXProfile(null);
        setIsUsingAuthedFeed(false);
        setXAuthError(null);
        return;
      }

      try {
        const service = initTwitterService(twitterBearerToken);
        const profile = await service.fetchCurrentUser();
        setTwitterService(service);
        setXProfile(profile);
        setIsUsingAuthedFeed(true);
        setIsUsingLiveData(true);
        setXAuthError(null);
      } catch (err) {
        console.error('❌ X auth failed', err);
        setTwitterService(null);
        setXProfile(null);
        setIsUsingAuthedFeed(false);
        setXAuthError(err instanceof Error ? err.message : 'Could not verify X token');
      }
    };

    connect();
  }, [twitterBearerToken]);

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
    // Prefer the authenticated X feed when available
    if (twitterService && xProfile) {
      setIsLoading(true);
      setError(null);

      try {
        const tweets = await twitterService.fetchHomeTimeline(xProfile.id, 20);
        if (tweets.length > 0) {
          setMyFeedTweets(tweets);
          setIsUsingLiveData(true);
          setIsUsingAuthedFeed(true);
          console.log(`✅ Loaded ${tweets.length} posts from X home timeline`);
        } else {
          setError('No posts found in your X home timeline');
          setIsUsingAuthedFeed(true);
        }
      } catch (err) {
        console.error('❌ Error fetching X home timeline:', err);
        setError('Failed to fetch your X feed');
      } finally {
        setIsLoading(false);
      }
      return;
    }

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
  }, [xaiService, twitterService, xProfile]);

  // Auto-fetch when service becomes available
  useEffect(() => {
    if (xaiService) {
      Promise.all([
        refetchTrending(),
        refetchMyFeed(),
      ]).catch(console.error);
    }
  }, [xaiService, refetchTrending, refetchMyFeed]);

  // Fetch real X feed as soon as auth succeeds
  useEffect(() => {
    if (twitterService && xProfile) {
      refetchMyFeed().catch(console.error);
    }
  }, [twitterService, xProfile, refetchMyFeed]);

  return {
    trendingTweets,
    myFeedTweets,
    isLoading,
    error,
    refetchTrending,
    refetchMyFeed,
    isUsingLiveData,
    isUsingAuthedFeed,
    xProfile,
    xAuthError,
  };
}
