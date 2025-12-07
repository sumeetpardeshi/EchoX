import { Tweet, TopTweet } from "../types";
import { audioController } from "./audioService";

// Use proxy in development to avoid CORS, direct URL otherwise
// Check if we're in browser (has window) or Node.js
const isBrowser = typeof window !== 'undefined';
const isDev = isBrowser && (import.meta.env?.DEV || false);

const XAI_API_URL = isDev
  ? "/api/xai/v1/chat/completions"
  : "https://api.x.ai/v1/chat/completions";

const XAI_TTS_URL = isDev
  ? "/api/xai/v1/audio/speech"
  : "https://api.x.ai/v1/audio/speech";

const XAI_IMAGE_URL = isDev
  ? "/api/xai/v1/images/generations"
  : "https://api.x.ai/v1/images/generations";

// Available Grok voices
export type GrokVoice = "Ara" | "Rex" | "Sal" | "Eve" | "Una" | "Leo";

export interface TTSOptions {
  text: string;
  voice?: GrokVoice;
  responseFormat?: "mp3" | "wav" | "opus" | "flac" | "pcm";
}

interface XAISearchResponse {
  id: string;
  choices: {
    message: {
      content: string;
    };
    index: number;
  }[];
  citations?: Array<
    | {
        url?: string;
        title?: string;
      }
    | string
  >;
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

export interface SearchFilters {
  sources: ("x" | "web" | "news")[];
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

export const DEFAULT_FILTERS: SearchFilters = {
  sources: ["x"],
  fromDate: "",
  toDate: "",
  fromUsers: [],
  language: "",
  includeReplies: true,
  includeRetweets: true,
  minLikes: 0,
  minRetweets: 0,
  hashtags: [],
  mediaOnly: false,
  verified: false,
};

// Broadcast persona configuration
export interface BroadcastPersona {
  id: string;
  name: string;
  description: string;
  toneTraits: string[];
  avoidList: string[];
  wordCountRange: [number, number];
  exampleLine?: string;
}

export const NPR_BBC_PERSONA: BroadcastPersona = {
  id: "npr-bbc",
  name: "NPR/BBC Correspondent",
  description:
    "You are a seasoned broadcast journalist delivering a news briefing in the style of NPR's Morning Edition or BBC World Service.",
  toneTraits: ["measured", "authoritative", "precise", "clear"],
  avoidList: [
    "exclamation points",
    "slang",
    "filler words",
    "casual phrasing",
    "hyperbole",
  ],
  wordCountRange: [40, 60],
  exampleLine:
    "The development comes amid growing uncertainty in the sector, with analysts suggesting the impact could reshape industry dynamics in the months ahead.",
};

export const DEFAULT_PERSONA = NPR_BBC_PERSONA;

// Build podcast-style prompt with persona
interface PodcastPromptOptions {
  persona?: BroadcastPersona;
  interests?: string[];
  topic?: string;
  count?: number;
}

function buildPodcastPrompt(options: PodcastPromptOptions = {}): string {
  const { persona = DEFAULT_PERSONA, interests, topic, count = 5 } = options;

  // Determine search scope
  let searchScope: string;
  let topicList: string;

  if (topic) {
    searchScope = `the most significant stories and conversations about "${topic}"`;
    topicList = topic;
  } else if (interests && interests.length > 0) {
    searchScope = `the most significant stories and conversations in these areas: ${interests.join(
      ", "
    )}`;
    topicList = interests.join("|");
  } else {
    searchScope =
      "the most significant trending topics, stories, or conversations";
    topicList =
      "Tech|AI|Space|Crypto|Sports|Politics|Entertainment|Science|Business|Gaming|Breaking";
  }

  const toneDescription = persona.toneTraits.join(", ");
  const avoidDescription = persona.avoidList.join(", ");
  const [minWords, maxWords] = persona.wordCountRange;

  return `${persona.description}

Search X/Twitter for the TOP ${count} ${searchScope} happening RIGHT NOW.

For EACH story/topic, you MUST create:

1. A broadcast-ready script (2-3 sentences, ${minWords}-${maxWords} words) that:
   - Opens with context or a hook that frames the story
   - States the key facts clearly and precisely
   - Closes with why it matters or what comes next
   - Uses ${toneDescription} language throughout
   - Avoids ${avoidDescription}

2. An imagePrompt that VISUALLY REPRESENTS the story described in the podcastScript:
   - Read the podcastScript you wrote
   - Identify the MAIN SUBJECT, SETTING, or ACTION in that script
   - Create an imagePrompt that shows a concrete visual scene from that story
   - The imagePrompt MUST directly relate to what the podcastScript describes
   - Example: If podcastScript mentions "researchers analyzing data", imagePrompt should show "researchers examining data on a laptop in a modern laboratory"
   - Example: If podcastScript mentions "Capitol building discussions", imagePrompt should show "outside the Capitol building with people in business attire"
   
   Structure for imagePrompt:
   - SUBJECT: Extract the main visual element from your podcastScript (specific person, place, or object)
   - SETTING: Use the location or context mentioned in the podcastScript
   - STYLE: Always use "editorial news photo style, realistic lighting, natural colors"
   - COMPOSITION: "landscape orientation, minimal background clutter"
   - CONSTRAINTS: Always end with "no text in image, non-sensational, no identifiable real individuals"

CRITICAL: The imagePrompt must be a visual representation of the story in podcastScript. If the script talks about technology, show technology. If it talks about politics, show political settings. Make them match!

Also include 2-3 representative tweets from notable accounts.

Example: "Two researchers examining data on a laptop in a modern laboratory, editorial news photo style with realistic lighting and natural colors, landscape orientation, no text in image, non-sensational"

Return results in this EXACT JSON format:
{
  "trends": [
    {
      "trendTitle": "Short Story Title (3-5 words)",
      "topic": "${topicList}",
      "podcastScript": "Your broadcast script here. ${
        persona.toneTraits[0].charAt(0).toUpperCase() +
        persona.toneTraits[0].slice(1)
      } tone, precise language, suitable for audio.",
      "imagePrompt": "[Subject] in [setting], editorial news photo style with realistic lighting and natural colors, landscape orientation, no text in image, non-sensational, no identifiable real individuals",
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
- Find ACTUALLY trending/recent content (not generic)
- Include a diverse mix of stories if searching broadly
- Write scripts that sound polished and professional when read aloud
- Include real tweets from notable/verified accounts
- CRITICAL: imagePrompt MUST be a visual representation of the story in podcastScript
- imagePrompt must describe a CONCRETE visual scene that matches what the podcastScript describes
- If podcastScript mentions specific people/places/actions, imagePrompt should show those visually
- Do NOT create generic or abstract imagePrompts - they must match the story content
- Return ONLY valid JSON, no markdown or explanations`;
}

// Build enhanced search query with X-style operators
function buildSearchQuery(query: string, filters: SearchFilters): string {
  let enhancedQuery = query;
  const queryParts: string[] = [];

  // Add user filters
  if (filters.fromUsers && filters.fromUsers.length > 0) {
    const userFilter = filters.fromUsers.map((u) => `from:${u}`).join(" OR ");
    queryParts.push(`(${userFilter})`);
  }

  // Add hashtag filters
  if (filters.hashtags && filters.hashtags.length > 0) {
    const hashtagFilter = filters.hashtags.map((h) => `#${h}`).join(" OR ");
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
    queryParts.push("-filter:replies");
  }
  if (!filters.includeRetweets) {
    queryParts.push("-filter:retweets");
  }
  if (filters.mediaOnly) {
    queryParts.push("filter:media");
  }
  if (filters.verified) {
    queryParts.push("filter:verified");
  }

  // Add language filter
  if (filters.language) {
    queryParts.push(`lang:${filters.language}`);
  }

  // Combine everything
  if (queryParts.length > 0) {
    enhancedQuery = `${query} ${queryParts.join(" ")}`;
  }

  return enhancedQuery;
}

// Build system prompt based on filters
function buildSystemPrompt(filters: SearchFilters): string {
  let systemPrompt = `You are Grok, a helpful assistant with access to real-time X/Twitter data.
When searching, provide relevant results and summarize the key points clearly.
IMPORTANT: You MUST return results in valid JSON format.`;

  if (filters.sources.includes("x")) {
    systemPrompt += `

When showing X/Twitter results, include:
- The tweet content (exact text)
- Author name and @handle
- The topic/category of the tweet`;
  }

  if (filters.verified) {
    systemPrompt += "\nFocus on verified accounts and authoritative sources.";
  }

  if (filters.minLikes > 0 || filters.minRetweets > 0) {
    systemPrompt +=
      "\nPrioritize highly-engaged content with many likes and retweets.";
  }

  return systemPrompt;
}

export class XAIService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate an image prompt from a podcast script
   * Uses XAI to create a visual description based on the script content
   */
  async generateImagePromptFromScript(podcastScript: string): Promise<string | null> {
    if (!this.apiKey) {
      console.error("XAI API key not available for image prompt generation");
      return null;
    }

    console.log(`🎨 Generating image prompt from podcast script...`);
    console.log(`  Script: ${podcastScript.substring(0, 100)}...`);

    try {
      const apiUrl = typeof process !== 'undefined' && process.env.XAI_API_URL
        ? process.env.XAI_API_URL
        : XAI_API_URL;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-2",
          messages: [
            {
              role: "system",
              content: `You are an expert at creating visual image prompts. Your task is to read a podcast script and create a detailed image prompt that visually represents the story described in the script.`
            },
            {
              role: "user",
              content: `Read this podcast script and create an image prompt that visually represents the story:

"${podcastScript}"

Create an image prompt that:
- Shows a CONCRETE visual scene from the story (not abstract)
- Uses the main subject, setting, or action mentioned in the script
- Follows this format: "[Subject] in [setting], editorial news photo style with realistic lighting and natural colors, landscape orientation, no text in image, non-sensational, no identifiable real individuals"

Example: If the script mentions "holiday gift trends with tech gadgets and cozy home essentials", the prompt should be: "A modern living room with tech gadgets and cozy home essentials arranged on a coffee table, editorial news photo style with realistic lighting and natural colors, landscape orientation, no text in image, non-sensational, no identifiable real individuals"

Return ONLY the image prompt text, nothing else.`
            }
          ],
          temperature: 0.7,
          max_tokens: 200
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Image prompt API Error: ${response.status} - ${errorText}`);
        return null;
      }

      const data = await response.json();
      const promptText = data.choices?.[0]?.message?.content?.trim();

      if (promptText) {
        // Clean up the response (remove quotes, markdown, etc.)
        let cleanPrompt = promptText.replace(/^["']|["']$/g, '').replace(/```/g, '').trim();
        console.log(`✅ Generated image prompt: ${cleanPrompt.substring(0, 80)}...`);
        return cleanPrompt;
      }

      console.error("No prompt text in response:", data);
      return null;
    } catch (error) {
      console.error("Image prompt generation error:", error);
      return null;
    }
  }

  /**
   * Generate an image using Grok's image generation API
   * Returns the URL of the generated image
   */
  async generateImage(prompt: string): Promise<string | null> {
    if (!this.apiKey) {
      console.error("XAI API key not available for image generation");
      return null;
    }

    console.log(`🎨 Generating image with Grok...`);
    console.log(
      `  Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`
    );

    try {
      // Use process.env for Node.js, import.meta.env for browser
      const imageUrl = typeof process !== 'undefined' && process.env.XAI_IMAGE_URL
        ? process.env.XAI_IMAGE_URL
        : XAI_IMAGE_URL;

      const response = await fetch(imageUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-2-image",
          prompt: prompt,
          n: 1,
          response_format: "url",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Image API Error: ${response.status} - ${errorText}`);
        return null;
      }

      const data = await response.json();
      const imageUrlResult = data.data?.[0]?.url;

      if (imageUrlResult) {
        console.log(`✅ Image generated successfully`);
        return imageUrlResult;
      }

      console.error("No image URL in response:", data);
      return null;
    } catch (error) {
      console.error("Image generation error:", error);
      return null;
    }
  }

  /**
   * Generate speech from text using Grok TTS
   * Returns an AudioBuffer ready for playback
   */
  async textToSpeech({
    text,
    voice = "Ara",
    responseFormat = "wav",
  }: TTSOptions): Promise<AudioBuffer | null> {
    if (!this.apiKey) {
      console.error("XAI API key not available for TTS");
      return null;
    }

    console.log(`🎤 Generating Grok TTS...`);
    console.log(`  Voice: ${voice}`);
    console.log(
      `  Text: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`
    );

    try {
      const response = await fetch(XAI_TTS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
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

      // Only decode audio in browser environment
      if (typeof window === 'undefined') {
        console.warn('⚠️  Cannot decode audio in Node.js environment. Use textToSpeechRaw() instead.');
        return null;
      }

      if (!audioController) {
        console.error('❌ AudioController not available');
        return null;
      }

      try {
        // Decode the audio using Web Audio API
        const audioContext = audioController.getContext();
        
        if (!audioContext) {
          console.error('❌ AudioContext not available');
          return null;
        }

        // For WAV/PCM formats, we may need manual decoding
        // For MP3/other compressed formats, use native decodeAudioData
        if (responseFormat === "pcm") {
          // PCM is raw 16-bit signed little-endian at 24kHz mono
          return this.decodePCM(arrayBuffer, audioContext);
        } else {
          // Let browser decode MP3/WAV/etc
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          console.log(`✅ Audio decoded: ${audioBuffer.duration.toFixed(2)}s`);
          return audioBuffer;
        }
      } catch (decodeError) {
        console.error('❌ Error decoding audio:', decodeError);
        return null;
      }
    } catch (error) {
      console.error("TTS Error:", error);
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

  /**
   * Generate speech and return as ArrayBuffer (for server-side use)
   * Returns raw audio data that can be uploaded to storage
   */
  async textToSpeechRaw({
    text,
    voice = "Ara",
    responseFormat = "mp3",
  }: TTSOptions): Promise<ArrayBuffer | null> {
    if (!this.apiKey) {
      console.error("XAI API key not available for TTS");
      return null;
    }

    console.log(`🎤 Generating Grok TTS (raw)...`);
    console.log(`  Voice: ${voice}`);
    console.log(
      `  Text: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`
    );

    try {
      const response = await fetch(XAI_TTS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
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

      // Return raw ArrayBuffer for server-side use
      const arrayBuffer = await response.arrayBuffer();
      console.log(`✅ Received raw audio data: ${arrayBuffer.byteLength} bytes`);
      return arrayBuffer;
    } catch (error) {
      console.error("TTS Error:", error);
      return null;
    }
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
      mode: "on",
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
      model: "grok-4",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: enhancedQuery,
        },
      ],
      search_parameters: searchParams,
    };

    console.log("xAI Request URL:", XAI_API_URL);
    console.log("xAI Request Body:", JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(XAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log("xAI Response Status:", response.status);
      console.log("xAI Response:", responseText.substring(0, 1000));

      if (!response.ok) {
        console.error("xAI API error:", response.status, responseText);
        return null;
      }

      const jsonResponse = JSON.parse(responseText);

      // Log citations if available
      if (jsonResponse.citations) {
        console.log(
          "Citations:",
          jsonResponse.citations.length,
          "sources found"
        );
      }

      return jsonResponse;
    } catch (error) {
      console.error("xAI search error:", error);
      return null;
    }
  }

  private parseResponseToTweets(
    response: XAISearchResponse,
    startId: number = 0
  ): Tweet[] {
    try {
      const content = response.choices[0]?.message?.content;
      console.log("Parsing content:", content?.substring(0, 500));

      if (!content) {
        console.error("No content in response");
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

      console.log("JSON to parse:", jsonStr.substring(0, 300));

      const parsed = JSON.parse(jsonStr);
      const tweets: ParsedTweet[] = parsed.tweets || [];

      console.log(`Parsed ${tweets.length} tweets successfully`);

      return tweets.map(
        (tweet, index): Tweet => ({
          id: `xai-${startId + index}-${Date.now()}`,
          user: {
            id: `user-${startId + index}`,
            name: tweet.author || "Unknown",
            handle: tweet.handle?.startsWith("@")
              ? tweet.handle
              : `@${tweet.handle || "unknown"}`,
            avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
              tweet.author || "U"
            )}&backgroundColor=1d9bf0`,
          },
          content: tweet.content || "",
          timestamp: "Just now",
          likes: Math.floor(Math.random() * 50000) + 1000,
          retweets: Math.floor(Math.random() * 10000) + 500,
          topic: tweet.topic || "Trending",
          imageUrl: this.getTopicImage(tweet.topic || "Trending"),
        })
      );
    } catch (error) {
      console.error("Error parsing xAI response:", error);
      console.error(
        "Raw content was:",
        response.choices[0]?.message?.content?.substring(0, 500)
      );
      return [];
    }
  }

  private getTopicImage(topic: string): string {
    const topicSeeds: Record<string, string> = {
      Tech: "technology,computer",
      AI: "artificial-intelligence,robot",
      Space: "space,rocket,stars",
      Crypto: "bitcoin,blockchain",
      Sports: "sports,stadium",
      Politics: "government,capitol",
      Entertainment: "entertainment,movie",
      Science: "science,laboratory",
      Gaming: "gaming,video-game",
      Music: "music,concert",
      Business: "business,office",
      Health: "health,medical",
    };

    const seed = topicSeeds[topic] || topic.toLowerCase();
    return `https://picsum.photos/seed/${seed}/600/400`;
  }

  /**
   * Generate a gradient placeholder based on topic
   * Returns a data URL for an SVG gradient
   */
  static getGradientPlaceholder(topic: string): string {
    const gradients: Record<string, [string, string]> = {
      Tech: ["#667eea", "#764ba2"],
      AI: ["#f093fb", "#f5576c"],
      Space: ["#4facfe", "#00f2fe"],
      Crypto: ["#fa709a", "#fee140"],
      Sports: ["#a8edea", "#fed6e3"],
      Politics: ["#d299c2", "#fef9d7"],
      Entertainment: ["#fddb92", "#d1fdff"],
      Science: ["#96fbc4", "#f9f586"],
      Gaming: ["#cd9cf2", "#f6f3ff"],
      Music: ["#e0c3fc", "#8ec5fc"],
      Business: ["#c1dfc4", "#deecdd"],
      Health: ["#84fab0", "#8fd3f4"],
      Breaking: ["#ff0844", "#ffb199"],
      Trending: ["#667eea", "#764ba2"],
    };

    const [color1, color2] = gradients[topic] || gradients["Trending"];

    return `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)"/>
      </svg>
    `)}`;
  }

  // Fetch trending topics from X with podcast-style narration
  async fetchTrending(
    userFilters?: Partial<SearchFilters>,
    persona?: BroadcastPersona,
    interests?: string[]
  ): Promise<Tweet[]> {
    console.log("🎙️ Fetching trending topics from X for podcast...");
    console.log("📋 User filters:", userFilters);
    console.log("📋 User interests:", interests);

    const prompt = buildPodcastPrompt({ persona, interests });

    // Merge user filters with defaults for trending
    const mergedFilters: Partial<SearchFilters> = {
      sources: ["x"],
      verified: true,
      ...userFilters,
    };

    const response = await this.searchX(prompt, mergedFilters);

    if (!response) {
      console.log("No response from xAI for trending");
      return [];
    }
    return this.parsePodcastResponse(response, 0);
  }

  // Parse podcast-style response
  private parsePodcastResponse(
    response: XAISearchResponse,
    startId: number = 0
  ): Tweet[] {
    try {
      const content = response.choices[0]?.message?.content;
      console.log("🎙️ Parsing podcast content:", content?.substring(0, 500));

      if (!content) {
        console.error("No content in response");
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

      console.log("JSON to parse:", jsonStr.substring(0, 300));

      const parsed = JSON.parse(jsonStr);
      const trends = parsed.trends || [];

      console.log(`🎙️ Parsed ${trends.length} trending topics`);

      return trends.map(
        (
          trend: {
            trendTitle?: string;
            topic?: string;
            podcastScript?: string;
            imagePrompt?: string;
            topTweets?: Array<{
              author?: string;
              handle?: string;
              content?: string;
              engagement?: string;
            }>;
          },
          index: number
        ): Tweet => {
          const topicValue = trend.topic || "Trending";
          return {
            id: `trend-${startId + index}-${Date.now()}`,
            user: {
              id: `trend-user-${startId + index}`,
              name: trend.trendTitle || "Trending",
              handle: `@trending`,
              avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(
                trend.trendTitle || "trend"
              )}&backgroundColor=1d9bf0`,
            },
            content: trend.podcastScript || "",
            timestamp: "Trending Now",
            likes: Math.floor(Math.random() * 100000) + 10000,
            retweets: Math.floor(Math.random() * 50000) + 5000,
            topic: topicValue,
            // Use gradient placeholder initially, AI image will be loaded async or from cache
            imageUrl: XAIService.getGradientPlaceholder(topicValue),
            isImageLoading: !!trend.imagePrompt,
            // Podcast-specific fields
            trendTitle: trend.trendTitle,
            podcastScript: trend.podcastScript,
            imagePrompt: trend.imagePrompt,
            topTweets: trend.topTweets?.map((t) => ({
              author: t.author || "Unknown",
              handle: t.handle || "@unknown",
              content: t.content || "",
              engagement: t.engagement,
            })),
          };
        }
      );
    } catch (error) {
      console.error("Error parsing podcast response:", error);
      console.error(
        "Raw content was:",
        response.choices[0]?.message?.content?.substring(0, 500)
      );
      // Fall back to regular tweet parsing
      return this.parseResponseToTweets(response, startId);
    }
  }

  // Fetch tweets about a specific topic with podcast-style narration
  async fetchByTopic(
    topic: string,
    persona?: BroadcastPersona
  ): Promise<Tweet[]> {
    console.log(`Fetching tweets about: ${topic}`);

    const prompt = buildPodcastPrompt({ topic, persona });

    const response = await this.searchX(prompt, {
      sources: ["x"],
      hashtags: [topic.toLowerCase().replace(/\s+/g, "")],
    });

    if (!response) {
      console.log("No response from xAI for topic:", topic);
      return [];
    }
    return this.parsePodcastResponse(response, 100);
  }

  // Fetch personalized feed with podcast-style narration based on interests
  async fetchPersonalizedFeed(
    interests: string[] = ["AI", "Tech", "Science"],
    userFilters?: Partial<SearchFilters>,
    persona?: BroadcastPersona
  ): Promise<Tweet[]> {
    console.log("🎙️ Fetching personalized podcast feed for:", interests);
    console.log("📋 User filters:", userFilters);

    const prompt = buildPodcastPrompt({ interests, persona });

    // Merge user filters with defaults for personalized feed
    const mergedFilters: Partial<SearchFilters> = {
      sources: ["x"],
      verified: true,
      ...userFilters,
    };

    const response = await this.searchX(prompt, mergedFilters);

    if (!response) {
      console.log("No response from xAI for personalized feed");
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
  // If no instance exists, try to create one from environment variable (for server-side)
  if (!xaiServiceInstance && typeof process !== 'undefined' && process.env.XAI_API_KEY) {
    xaiServiceInstance = new XAIService(process.env.XAI_API_KEY);
  }
  return xaiServiceInstance;
}
