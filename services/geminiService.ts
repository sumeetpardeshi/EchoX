import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT_SUMMARY } from "../constants";
import { getXAIService, GrokVoice } from "./xaiService";

interface CacheEntry {
  summary: string;
  audioBuffer: AudioBuffer;
}

export class GeminiService {
  private ai: GoogleGenAI;
  private cache: Map<string, CacheEntry>;
  private ttsVoice: GrokVoice = 'Ara';

  constructor(apiKey: string) {
    console.log('Initializing GeminiService with API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');
    this.ai = new GoogleGenAI({ apiKey });
    this.cache = new Map();
  }

  // Set the Grok voice to use for TTS
  setVoice(voice: GrokVoice) {
    this.ttsVoice = voice;
    console.log(`🎤 TTS voice set to: ${voice}`);
  }

  // Check if we have data for this tweet ID
  getCachedData(tweetId: string): CacheEntry | undefined {
    return this.cache.get(tweetId);
  }

  // Step 1: Summarize the tweet text
  async summarizeTweet(tweetContent: string): Promise<string> {
    console.log('Summarizing tweet:', tweetContent.substring(0, 50));
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Original Post: "${tweetContent}". \n\nInstruction: ${SYSTEM_PROMPT_SUMMARY}`,
      });
      const summary = response.text || "Could not generate summary.";
      console.log('Summary generated:', summary.substring(0, 50));
      return summary;
    } catch (error) {
      console.error("Summarization error:", error);
      return "Error generating summary.";
    }
  }

  // Step 2: Generate Audio from the summary using Grok TTS (xAI)
  async generateAudio(text: string): Promise<AudioBuffer | null> {
    console.log('🎤 Generating audio with Grok TTS for:', text.substring(0, 50));
    
    const xaiService = getXAIService();
    
    if (!xaiService) {
      console.error('xAI service not available for TTS - check XAI_API_KEY');
      return null;
    }

    try {
      const audioBuffer = await xaiService.textToSpeech({
        text,
        voice: this.ttsVoice,
        responseFormat: 'wav', // WAV works well with Web Audio API
      });

      if (audioBuffer) {
        console.log('✅ Grok TTS audio buffer created, duration:', audioBuffer.duration.toFixed(2) + 's');
      }
      
      return audioBuffer;
    } catch (error) {
      console.error("Grok TTS error:", error);
      return null;
    }
  }

  /**
   * Process a tweet/trend for audio playback
   * @param tweetId - Unique ID for caching
   * @param content - The raw content (used if no podcastScript)
   * @param podcastScript - Pre-written podcast narration (skips summarization if provided)
   */
  async processTweet(tweetId: string, content: string, podcastScript?: string): Promise<CacheEntry | null> {
    console.log('🎙️ Processing content:', tweetId);
    
    if (this.cache.has(tweetId)) {
      console.log('✅ Returning cached data for:', tweetId);
      return this.cache.get(tweetId)!;
    }

    // Use podcast script directly if available, otherwise summarize
    let textForAudio: string;
    
    if (podcastScript && podcastScript.length > 10) {
      console.log('🎙️ Using pre-written podcast script');
      textForAudio = podcastScript;
    } else {
      console.log('📝 No podcast script, generating summary...');
      textForAudio = await this.summarizeTweet(content);
    }

    const audioBuffer = await this.generateAudio(textForAudio);

    if (textForAudio && audioBuffer) {
      console.log('✅ Successfully processed:', tweetId);
      const entry = { summary: textForAudio, audioBuffer };
      this.cache.set(tweetId, entry);
      return entry;
    }
    
    console.error('❌ Failed to process:', tweetId, 'text:', !!textForAudio, 'audio:', !!audioBuffer);
    return null;
  }
}