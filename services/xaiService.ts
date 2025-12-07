import { Tweet, TopTweet } from '../types';
import { audioController } from './audioService';

// Use proxy in development to avoid CORS, direct URL otherwise
const XAI_API_URL = import.meta.env.DEV 
  ? '/api/xai/v1/chat/completions' 
  : 'https://api.x.ai/v1/chat/completions';

const XAI_TTS_URL = import.meta.env.DEV 
  ? '/api/xai/v1/audio/speech' 
  : 'https://api.x.ai/v1/audio/speech';

// Available Grok voices
export type GrokVoice = 'Ara' | 'Rex' | 'Sal' | 'Eve' | 'Una' | 'Leo';

export interface TTSOptions {
  text: string;
  voice?: GrokVoice;
  responseFormat?: 'mp3' | 'wav' | 'opus' | 'flac' | 'pcm';
}

interface XAISearchResponse {
  id: string;
  choices: {
    message: {
      content: string;
    };
    index: number;
  }[];
  citations?: Array<{
    url?: string;
    title?: string;
  } | string>;
}

// Podcast-style trend segment
interface PodcastTrend {
  trendTitle: string;
  topic: string;
  podcastScript: string;
  topTweets: Array<{
    author: string;
    handle: string;
    content: string;
    engagement?: string;
  }>;
}

interface ParsedTweet {
  author: string;
  handle: string;
  content: string;
  topic: string;
  engagement?: string;
  tweetId?: string;
}

interface SearchFilters {
  sources: ('x' | 'web' | 'news')[];
  fromDate: string;
  toDate: string;
  fromUsers: string[];
  language: string;
  includeReplies: boolean;
  includeRetweets: boolean;
  minLikes: number;
  minRetweets: number;
  hashtags: string[];
  mediaOnly: boolean;
  verified: boolean;
}

const DEFAULT_FILTERS: SearchFilters = {
  sources: ['x'],
  fromDate: '',
  toDate: '',
  fromUsers: [],
  language: '',
  includeReplies: true,
  includeRetweets: true,
  minLikes: 0,
  minRetweets: 0,
  hashtags: [],
  mediaOnly: false,
  verified: false,
};

// Build enhanced search query with X-style operators
function buildSearchQuery(query: string, filters: SearchFilters): string {
  let enhancedQuery = query;
  const queryParts: string[] = [];

  // Add user filters
  if (filters.fromUsers && filters.fromUsers.length > 0) {
    const userFilter = filters.fromUsers.map((u) => `from:${u}`).join(' OR ');
    queryParts.push(`(${userFilter})`);
  }

  // Add hashtag filters
  if (filters.hashtags && filters.hashtags.length > 0) {
    const hashtagFilter = filters.hashtags.map((h) => `#${h}`).join(' OR ');
    queryParts.push(`(${hashtagFilter})`);
  }

  // Add date filters
  if (filters.fromDate) {
    queryParts.push(`since:${filters.fromDate}`);
  }
  if (filters.toDate) {
    queryParts.push(`until:${filters.toDate}`);
  }

  // Add engagement filters
  if (filters.minLikes > 0) {
    queryParts.push(`min_faves:${filters.minLikes}`);
  }
  if (filters.minRetweets > 0) {
    queryParts.push(`min_retweets:${filters.minRetweets}`);
  }

  // Add content type filters
  if (!filters.includeReplies) {
    queryParts.push('-filter:replies');
  }
  if (!filters.includeRetweets) {
    queryParts.push('-filter:retweets');
  }
  if (filters.mediaOnly) {
    queryParts.push('filter:media');
  }
  if (filters.verified) {
    queryParts.push('filter:verified');
  }

  // Add language filter
  if (filters.language) {
    queryParts.push(`lang:${filters.language}`);
  }

  // Combine everything
  if (queryParts.length > 0) {
    enhancedQuery = `${query} ${queryParts.join(' ')}`;
  }

  return enhancedQuery;
}

// Build system prompt based on filters
function buildSystemPrompt(filters: SearchFilters): string {
  let systemPrompt = `You are Grok, a helpful assistant with access to real-time X/Twitter data.
When searching, provide relevant results and summarize the key points clearly.
IMPORTANT: You MUST return results in valid JSON format.`;

  if (filters.sources.includes('x')) {
    systemPrompt += `

When showing X/Twitter results, include:
- The tweet content (exact text)
- Author name and @handle
- The topic/category of the tweet`;
  }

  if (filters.verified) {
    systemPrompt += '\nFocus on verified accounts and authoritative sources.';
  }

  if (filters.minLikes > 0 || filters.minRetweets > 0) {
    systemPrompt += '\nPrioritize highly-engaged content with many likes and retweets.';
  }

  return systemPrompt;
}

export class XAIService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate speech from text using Grok TTS
   * Returns an AudioBuffer ready for playback
   */
  async textToSpeech({
    text,
    voice = 'Ara',
    responseFormat = 'wav',
  }: TTSOptions): Promise<AudioBuffer | null> {
    if (!this.apiKey) {
      console.error('XAI API key not available for TTS');
      return null;
    }

    console.log(`🎤 Generating Grok TTS...`);
    console.log(`  Voice: ${voice}`);
    console.log(`  Text: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);

    try {
      const response = await fetch(XAI_TTS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          voice: voice,
          response_format: responseFormat,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`TTS API Error: ${response.status} - ${errorText}`);
        return null;
      }

      // Get audio data as ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();
      console.log(`✅ Received audio data: ${arrayBuffer.byteLength} bytes`);

      // Decode the audio using Web Audio API
      const audioContext = audioController.getContext();
      
      // For WAV/PCM formats, we may need manual decoding
      // For MP3/other compressed formats, use native decodeAudioData
      if (responseFormat === 'pcm') {
        // PCM is raw 16-bit signed little-endian at 24kHz mono
        return this.decodePCM(arrayBuffer, audioContext);
      } else {
        // Let browser decode MP3/WAV/etc
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log(`✅ Audio decoded: ${audioBuffer.duration.toFixed(2)}s`);
        return audioBuffer;
      }
    } catch (error) {
      console.error('TTS Error:', error);
      return null;
    }
  }

  /**
   * Decode raw PCM data (16-bit signed LE, 24kHz mono) to AudioBuffer
   */
  private decodePCM(arrayBuffer: ArrayBuffer, ctx: AudioContext): AudioBuffer {
    const dataView = new DataView(arrayBuffer);
    const numSamples = arrayBuffer.byteLength / 2; // 16-bit = 2 bytes per sample
    const sampleRate = 24000;
    
    const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < numSamples; i++) {
      // Read 16-bit signed little-endian and normalize to -1.0 to 1.0
      const sample = dataView.getInt16(i * 2, true);
      channelData[i] = sample / 32768.0;
    }
    
    console.log(`✅ PCM decoded: ${audioBuffer.duration.toFixed(2)}s`);
    return audioBuffer;
  }

  private async searchX(
    userPrompt: string, 
    filters: Partial<SearchFilters> = {}
  ): Promise<XAISearchResponse | null> {
    const appliedFilters = { ...DEFAULT_FILTERS, ...filters };
    
    // Build enhanced query with X-style operators
    const enhancedQuery = buildSearchQuery(userPrompt, appliedFilters);
    
    // Build sources array for xAI API - format: [{ type: "x" }]
    const sources = appliedFilters.sources.map((source) => ({ type: source }));

    // Build system prompt
    const systemPrompt = buildSystemPrompt(appliedFilters);

    // Build search parameters
    const searchParams: Record<string, unknown> = {
      mode: 'on',
      sources: sources,
      return_citations: true,
    };

    // Add date filters if provided
    if (appliedFilters.fromDate) {
      searchParams.from_date = appliedFilters.fromDate;
    }
    if (appliedFilters.toDate) {
      searchParams.to_date = appliedFilters.toDate;
    }

    const requestBody = {
      model: 'grok-4',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: enhancedQuery,
        },
      ],
      search_parameters: searchParams,
    };

    console.log('xAI Request URL:', XAI_API_URL);
    console.log('xAI Request Body:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(XAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log('xAI Response Status:', response.status);
      console.log('xAI Response:', responseText.substring(0, 1000));

      if (!response.ok) {
        console.error('xAI API error:', response.status, responseText);
        return null;
      }

      const jsonResponse = JSON.parse(responseText);
      
      // Log citations if available
      if (jsonResponse.citations) {
        console.log('Citations:', jsonResponse.citations.length, 'sources found');
      }

      return jsonResponse;
    } catch (error) {
      console.error('xAI search error:', error);
      return null;
    }
  }

  private parseResponseToTweets(response: XAISearchResponse, startId: number = 0): Tweet[] {
    try {
      const content = response.choices[0]?.message?.content;
      console.log('Parsing content:', content?.substring(0, 500));
      
      if (!content) {
        console.error('No content in response');
        return [];
      }

      // Try to extract JSON from the response
      let jsonStr = content.trim();
      
      // Handle markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Try to find JSON object in the content
      const jsonObjectMatch = jsonStr.match(/\{[\s\S]*"tweets"[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonStr = jsonObjectMatch[0];
      }

      console.log('JSON to parse:', jsonStr.substring(0, 300));

      const parsed = JSON.parse(jsonStr);
      const tweets: ParsedTweet[] = parsed.tweets || [];

      console.log(`Parsed ${tweets.length} tweets successfully`);

      return tweets.map((tweet, index): Tweet => ({
        id: `xai-${startId + index}-${Date.now()}`,
        user: {
          id: `user-${startId + index}`,
          name: tweet.author || 'Unknown',
          handle: tweet.handle?.startsWith('@') ? tweet.handle : `@${tweet.handle || 'unknown'}`,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(tweet.author || 'U')}&backgroundColor=1d9bf0`,
        },
        content: tweet.content || '',
        timestamp: 'Just now',
        likes: Math.floor(Math.random() * 50000) + 1000,
        retweets: Math.floor(Math.random() * 10000) + 500,
        topic: tweet.topic || 'Trending',
        imageUrl: this.getTopicImage(tweet.topic || 'Trending'),
      }));
    } catch (error) {
      console.error('Error parsing xAI response:', error);
      console.error('Raw content was:', response.choices[0]?.message?.content?.substring(0, 500));
      return [];
    }
  }

  private getTopicImage(topic: string): string {
    const topicSeeds: Record<string, string> = {
      'Tech': 'technology,computer',
      'AI': 'artificial-intelligence,robot',
      'Space': 'space,rocket,stars',
      'Crypto': 'bitcoin,blockchain',
      'Sports': 'sports,stadium',
      'Politics': 'government,capitol',
      'Entertainment': 'entertainment,movie',
      'Science': 'science,laboratory',
      'Gaming': 'gaming,video-game',
      'Music': 'music,concert',
      'Business': 'business,office',
      'Health': 'health,medical',
    };
    
    const seed = topicSeeds[topic] || topic.toLowerCase();
    return `https://picsum.photos/seed/${seed}/600/400`;
  }

  // Fetch trending topics from X with podcast-style narration
  async fetchTrending(): Promise<Tweet[]> {
    console.log('🎙️ Fetching trending topics from X for podcast...');
    
    const prompt = `You are a podcast host creating short audio snippets about what's trending on X/Twitter RIGHT NOW.

Search across ALL of X/Twitter to find the TOP 5 most significant trending topics, stories, or conversations happening today.

For EACH trending topic, create a podcast-style narration (2-3 sentences) that:
- Explains what the trend is about in an engaging, conversational tone
- Mentions key facts, numbers, or notable people involved
- Sounds natural when read aloud

Also include 2-3 example tweets that represent this trend.

Return the results in this EXACT JSON format:
{
  "trends": [
    {
      "trendTitle": "Short Trend Title (3-5 words)",
      "topic": "Tech|AI|Space|Crypto|Sports|Politics|Entertainment|Science|Business|Gaming|Breaking",
      "podcastScript": "Hey everyone! [Engaging podcast narration about this trend - 2-3 sentences that explain what's happening and why it matters. Make it sound natural and conversational.]",
      "topTweets": [
        {
          "author": "Display Name",
          "handle": "@username",
          "content": "Exact tweet text",
          "engagement": "10K likes"
        }
      ]
    }
  ]
}

Requirements:
- Find ACTUALLY trending topics right now (not generic content)
- Include a diverse mix of categories (tech, politics, sports, entertainment, etc.)
- The podcastScript should be engaging and informative, suitable for audio
- Include real tweets from notable/verified accounts
- Return ONLY valid JSON, no markdown or explanations`;

    const response = await this.searchX(prompt, {
      sources: ['x'], // 'news', 'web'
      verified: true,
      
    });
    
    if (!response) {
      console.log('No response from xAI for trending');
      return [];
    }
    return this.parsePodcastResponse(response, 0);
  }

  // Parse podcast-style response
  private parsePodcastResponse(response: XAISearchResponse, startId: number = 0): Tweet[] {
    try {
      const content = response.choices[0]?.message?.content;
      console.log('🎙️ Parsing podcast content:', content?.substring(0, 500));
      
      if (!content) {
        console.error('No content in response');
        return [];
      }

      // Try to extract JSON from the response
      let jsonStr = content.trim();
      
      // Handle markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Try to find JSON object with trends
      const jsonObjectMatch = jsonStr.match(/\{[\s\S]*"trends"[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonStr = jsonObjectMatch[0];
      }

      console.log('JSON to parse:', jsonStr.substring(0, 300));

      const parsed = JSON.parse(jsonStr);
      const trends = parsed.trends || [];

      console.log(`🎙️ Parsed ${trends.length} trending topics`);

      return trends.map((trend: {
        trendTitle?: string;
        topic?: string;
        podcastScript?: string;
        topTweets?: Array<{
          author?: string;
          handle?: string;
          content?: string;
          engagement?: string;
        }>;
      }, index: number): Tweet => {
        const topTweet = trend.topTweets?.[0];
        return {
          id: `trend-${startId + index}-${Date.now()}`,
          user: {
            id: `trend-user-${startId + index}`,
            name: trend.trendTitle || 'Trending',
            handle: `@trending`,
            avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(trend.trendTitle || 'trend')}&backgroundColor=1d9bf0`,
          },
          content: trend.podcastScript || '',
          timestamp: 'Trending Now',
          likes: Math.floor(Math.random() * 100000) + 10000,
          retweets: Math.floor(Math.random() * 50000) + 5000,
          topic: trend.topic || 'Trending',
          imageUrl: this.getTopicImage(trend.topic || 'Trending'),
          // Podcast-specific fields
          trendTitle: trend.trendTitle,
          podcastScript: trend.podcastScript,
          topTweets: trend.topTweets?.map(t => ({
            author: t.author || 'Unknown',
            handle: t.handle || '@unknown',
            content: t.content || '',
            engagement: t.engagement,
          })),
        };
      });
    } catch (error) {
      console.error('Error parsing podcast response:', error);
      console.error('Raw content was:', response.choices[0]?.message?.content?.substring(0, 500));
      // Fall back to regular tweet parsing
      return this.parseResponseToTweets(response, startId);
    }
  }

  // Fetch tweets about a specific topic
  async fetchByTopic(topic: string): Promise<Tweet[]> {
    console.log(`Fetching tweets about: ${topic}`);
    
    const prompt = `Search X/Twitter for the top 5 most engaging posts about "${topic}" from today.

Return results in this exact JSON format:
{
  "tweets": [
    {
      "author": "Author Display Name",
      "handle": "@username",
      "content": "The exact tweet text",
      "topic": "${topic}"
    }
  ]
}

Focus on posts with high engagement from notable accounts.
Return ONLY valid JSON, no markdown code blocks or explanations.`;

    const response = await this.searchX(prompt, {
      sources: ['x'],
      hashtags: [topic.toLowerCase().replace(/\s+/g, '')],
    });
    
    if (!response) {
      console.log('No response from xAI for topic:', topic);
      return [];
    }
    return this.parseResponseToTweets(response, 100);
  }

  // Fetch personalized feed with podcast-style narration based on interests
  async fetchPersonalizedFeed(interests: string[] = ['AI', 'Tech', 'Science']): Promise<Tweet[]> {
    console.log('🎙️ Fetching personalized podcast feed for:', interests);
    
    const prompt = `You are a podcast host creating personalized audio snippets about trending topics on X/Twitter.

Search X/Twitter for the TOP 5 most significant stories and conversations happening RIGHT NOW in these areas: ${interests.join(', ')}.

For EACH story/topic, create a podcast-style narration (2-3 sentences) that:
- Explains the latest developments in an engaging, conversational tone
- Mentions key facts, numbers, or notable people involved
- Sounds natural when read aloud

Also include 2-3 example tweets that represent each story.

Return the results in this EXACT JSON format:
{
  "trends": [
    {
      "trendTitle": "Short Story Title (3-5 words)",
      "topic": "${interests[0]}|${interests[1] || interests[0]}|${interests[2] || interests[0]}",
      "podcastScript": "Here's what's happening in [topic]! [Engaging podcast narration - 2-3 sentences explaining the story and why it matters.]",
      "topTweets": [
        {
          "author": "Display Name",
          "handle": "@username", 
          "content": "Exact tweet text",
          "engagement": "5K likes"
        }
      ]
    }
  ]
}

Requirements:
- Focus on BREAKING or RECENT news in ${interests.join(', ')}
- The podcastScript should be engaging and suitable for audio playback
- Include real tweets from notable/verified accounts in these fields
- Return ONLY valid JSON, no markdown or explanations`;

    const response = await this.searchX(prompt, {
      sources: ['x'], //'news', 'web'
      verified: true,
    });
    
    if (!response) {
      console.log('No response from xAI for personalized feed');
      return [];
    }
    return this.parsePodcastResponse(response, 200);
  }
}

// Singleton instance - will be initialized when API key is available
let xaiServiceInstance: XAIService | null = null;

export function initXAIService(apiKey: string): XAIService {
  xaiServiceInstance = new XAIService(apiKey);
  return xaiServiceInstance;
}

export function getXAIService(): XAIService | null {
  return xaiServiceInstance;
}
