import { cacheService } from '../../../services/cacheService';
import { getXAIService } from '../../../services/xaiService';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    // Parse interests from query parameters
    const url = new URL(request.url);
    const interestsParam = url.searchParams.get('interests');
    const interests: string[] | undefined = interestsParam 
      ? interestsParam.split(',').map(i => i.trim()).filter(i => i.length > 0)
      : undefined;

    if (interests && interests.length > 0) {
      console.log(`🎯 Filtering by interests: ${interests.join(", ")}`);
    }

    // Check cache first
    const cached = await cacheService.getTrending();
    
    if (cached && !isExpired(cached.generatedAt)) {
      // Filter cached results by interests if provided
      let filteredTweets = cached.tweets;
      if (interests && interests.length > 0) {
        filteredTweets = filterTweetsByInterests(cached.tweets, interests);
        console.log(`📊 Filtered ${cached.tweets.length} cached tweets to ${filteredTweets.length} matching interests`);
      }
      
      return new Response(JSON.stringify({
        tweets: filteredTweets,
        cached: true,
        generatedAt: cached.generatedAt.toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Cache expired or missing
    if (cached) {
      // Filter stale data by interests if provided
      let filteredTweets = cached.tweets;
      if (interests && interests.length > 0) {
        filteredTweets = filterTweetsByInterests(cached.tweets, interests);
      }
      
      // Return stale data immediately, refresh in background
      refreshTrendingInBackground(interests);
      return new Response(JSON.stringify({
        tweets: filteredTweets,
        cached: true,
        stale: true,
        generatedAt: cached.generatedAt.toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // No cache - generate now (first request) with interests
    const xaiService = getXAIService();
    if (!xaiService) {
      return new Response(JSON.stringify({ error: 'XAI service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const tweets = await xaiService.fetchTrending(undefined, undefined, interests);
    await cacheService.saveTrending(tweets);
    
    return new Response(JSON.stringify({
      tweets,
      cached: false,
      generatedAt: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching trending:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch trending topics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Filter tweets by interests (match topic field)
function filterTweetsByInterests(tweets: any[], interests: string[]): any[] {
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
}

function isExpired(generatedAt: Date): boolean {
  const age = Date.now() - generatedAt.getTime();
  return age > 30 * 60 * 1000; // 30 minutes
}

async function refreshTrendingInBackground(interests?: string[]) {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  const url = interests && interests.length > 0
    ? `${baseUrl}/api/refresh/trending?interests=${interests.join(',')}`
    : `${baseUrl}/api/refresh/trending`;
    
  fetch(url, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${process.env.INTERNAL_SECRET || 'dev-secret'}` 
    }
  }).catch(console.error);
}

