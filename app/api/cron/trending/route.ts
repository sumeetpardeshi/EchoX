import { cacheService } from '../../../services/cacheService';
import { getXAIService } from '../../../services/xaiService';
import { generateAudioForTweets } from '../../../services/audioGenerationService';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
  // Vercel adds this header for cron jobs
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    console.log('⏰ Cron job: Refreshing trending topics with audio...');
    
    const xaiService = getXAIService();
    if (!xaiService) {
      throw new Error('XAI service not configured');
    }
    
    // Generate trending topics (cron generates all topics, not filtered by interests)
    // Individual users' interest filters are applied when they fetch from /api/trending
    const tweets = await xaiService.fetchTrending();
    
    // Pre-generate audio
    const tweetsWithAudio = await generateAudioForTweets(tweets);
    
    // Save to cache
    await cacheService.saveTrending(tweetsWithAudio);
    
    // Cleanup old entries
    await cacheService.cleanupOldEntries();
    
    console.log(`✅ Cron job completed: ${tweetsWithAudio.length} topics with audio`);
    
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
    console.error('❌ Cron job error:', error);
    return new Response(JSON.stringify({
      error: 'Cron job failed',
      details: error instanceof Error ? error.message : 'Unknown'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

