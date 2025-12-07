import { cacheService } from '../../../services/cacheService';
import { getXAIService } from '../../../services/xaiService';
import { generateAudioForTweets } from '../../../services/audioGenerationService';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for audio generation

export async function POST(request: Request) {
  // Verify internal secret
  const authHeader = request.headers.get('authorization');
  const expectedSecret = `Bearer ${process.env.INTERNAL_SECRET || 'dev-secret'}`;
  
  if (authHeader !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Parse interests from query parameters (if provided)
    const url = new URL(request.url);
    const interestsParam = url.searchParams.get('interests');
    const interests: string[] | undefined = interestsParam 
      ? interestsParam.split(',').map(i => i.trim()).filter(i => i.length > 0)
      : undefined;

    if (interests && interests.length > 0) {
      console.log(`🔄 Starting trending refresh with audio generation (interests: ${interests.join(", ")})...`);
    } else {
      console.log('🔄 Starting trending refresh with audio generation...');
    }
    
    const xaiService = getXAIService();
    if (!xaiService) {
      throw new Error('XAI service not configured');
    }
    
    // 1. Generate trending topics (with interests if provided)
    console.log('📰 Fetching trending topics...');
    const tweets = await xaiService.fetchTrending(undefined, undefined, interests);
    console.log(`✅ Fetched ${tweets.length} trending topics`);
    
    // 2. Pre-generate audio for all tweets
    console.log('🎤 Generating audio for all tweets...');
    const tweetsWithAudio = await generateAudioForTweets(tweets);
    console.log(`✅ Generated audio for ${tweetsWithAudio.length} tweets`);
    
    // 3. Store with audio URLs
    await cacheService.saveTrending(tweetsWithAudio);
    console.log('💾 Saved to cache');
    
    return new Response(JSON.stringify({
      success: true,
      count: tweetsWithAudio.length,
      audioGenerated: tweetsWithAudio.filter(t => t.audioUrl).length,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Error in refresh job:', error);
    return new Response(JSON.stringify({
      error: 'Refresh failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

