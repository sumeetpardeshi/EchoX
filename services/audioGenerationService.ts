import { Tweet } from '../types';
import { getXAIService, GrokVoice } from './xaiService';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT_SUMMARY } from '../constants';
import { supabase } from '../lib/supabase';

const GROK_VOICES: GrokVoice[] = ['Ara', 'Rex', 'Sal', 'Eve', 'Una', 'Leo'];

export async function generateAudioForTweets(
  tweets: Tweet[]
): Promise<Tweet[]> {
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const xaiService = getXAIService();
  
  if (!xaiService) {
    throw new Error('XAI service not available');
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const tweetsWithAudio = await Promise.all(
    tweets.map(async (tweet, index) => {
      try {
        // 1. Get text for audio (use podcastScript if available)
        let textForAudio: string;
        
        if (tweet.podcastScript && tweet.podcastScript.length > 10) {
          console.log(`🎙️ Using podcast script for tweet ${tweet.id}`);
          textForAudio = tweet.podcastScript;
        } else {
          // Summarize using Gemini
          console.log(`📝 Summarizing tweet ${tweet.id}...`);
          const response = await gemini.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Original Post: "${tweet.content}". \n\nInstruction: ${SYSTEM_PROMPT_SUMMARY}`,
          });
          textForAudio = response.text || tweet.content;
        }
        
        // 2. Generate audio using XAI TTS (raw format for server-side)
        const voice = GROK_VOICES[index % GROK_VOICES.length];
        console.log(`🎤 Generating audio for tweet ${tweet.id} with voice ${voice}...`);
        
        const audioArrayBuffer = await xaiService.textToSpeechRaw({
          text: textForAudio,
          voice,
          responseFormat: 'mp3', // Use MP3 for smaller file size
        });
        
        if (!audioArrayBuffer) {
          throw new Error('Failed to generate audio');
        }
        
        // 3. Upload to Supabase Storage
        const audioUrl = await uploadAudioToSupabase(tweet.id, audioArrayBuffer);
        
        console.log(`✅ Generated audio for tweet ${tweet.id}: ${audioUrl}`);
        
        // 4. Return tweet with audio URL and summary
        return {
          ...tweet,
          audioUrl, // Pre-generated audio URL
          summary: textForAudio, // Pre-generated summary
          voice, // Voice used
        };
      } catch (error) {
        console.error(`❌ Error generating audio for tweet ${tweet.id}:`, error);
        // Return tweet without audio (fallback)
        return tweet;
      }
    })
  );
  
  return tweetsWithAudio;
}

// Upload audio to Supabase Storage
async function uploadAudioToSupabase(
  tweetId: string,
  audioArrayBuffer: ArrayBuffer
): Promise<string> {
  const filename = `${tweetId}-${Date.now()}.mp3`;
  const filePath = `trending/${filename}`;
  
  // Convert ArrayBuffer to Blob
  const audioBlob = new Blob([audioArrayBuffer], { type: 'audio/mpeg' });
  
  const { data, error } = await supabase.storage
    .from('trending-audio')
    .upload(filePath, audioBlob, {
      contentType: 'audio/mpeg',
      upsert: false, // Don't overwrite existing files
    });

  if (error) {
    throw new Error(`Failed to upload audio: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('trending-audio')
    .getPublicUrl(filePath);

  return publicUrl;
}

