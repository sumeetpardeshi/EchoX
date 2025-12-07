/**
 * Standalone script to populate database with trending topics
 * Bypasses browser-dependent services
 */

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envLocalPath = join(__dirname, '..', '.env.local');
const envPath = join(__dirname, '..', '.env');

if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Direct XAI API call (no service dependencies)
async function fetchTrendingFromXAI(interests?: string[], seenTitles: Set<string> = new Set()): Promise<any[]> {
  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) {
    throw new Error('XAI_API_KEY not found');
  }

  // Define sub-angles to force diversity if specific interest is provided
  const ANGLES: Record<string, string[]> = {
    'Tech': ['Startups & VC', 'Consumer Gadgets', 'Software & Apps', 'Big Tech Policy', 'Developer Tools'],
    'AI': ['LLM Breakthroughs', 'AI Ethics & Safety', 'New AI Product Launches', 'Robotics & Hardware', 'Generative Art'],
    'Space': ['Commercial Spaceflight', 'Astronomy Discoveries', 'Mars & Moon Missions', 'Satellite Technology'],
    'Crypto': ['DeFi & Web3', 'Regulatory News', 'Market Movements', 'NFTs & Gaming', 'Infrastructure'],
    'Sports': ['Major League Games', 'Athlete News', 'Trade Rumors', 'Tournament Updates'],
    'Politics': ['Policy Changes', 'Elections & Campaigns', 'International Relations', 'Domestic Issues'],
    'Entertainment': ['Movie Releases', 'Music Industry', 'Celebrity News', 'Streaming Trends'],
    'Science': ['Biology & Medicine', 'Physics Breakthroughs', 'Climate & Environment', 'Archaeology'],
    'Business': ['Market Trends', 'Company Earnings', 'Economic Indicators', 'Mergers & Acquisitions'],
    'Gaming': ['New Game Releases', 'Esports', 'Console Updates', 'Indie Games'],
    'Breaking': ['Global Events', 'Major Announcements', 'Emerging Stories']
  };

  // Build search scope based on interests (matching xaiService.ts logic)
  let searchScope: string;
  let topicList: string;
  
  if (interests && interests.length > 0) {
    // If a single interest is provided, try to pick a random angle to ensure variety
    const interest = interests[0];
    const subAngles = ANGLES[interest];
    const angle = subAngles ? subAngles[Math.floor(Math.random() * subAngles.length)] : '';
    
    searchScope = `the most significant stories in ${interest}${angle ? ` specifically focusing on ${angle}` : ''}`;
    topicList = interests.join("|");
  } else {
    searchScope = "the most significant trending topics, stories, or conversations happening today";
    topicList = "Tech|AI|Space|Crypto|Sports|Politics|Entertainment|Science|Business|Gaming|Breaking";
  }

  const prompt = `You are a podcast host creating short audio snippets about what's trending on X/Twitter RIGHT NOW.
    
Search across X/Twitter to find the TOP 15 ${searchScope}.

For EACH trending topic, create a podcast-style narration (2-3 sentences) that:
- Explains what the trend is about in an engaging, conversational tone
- Mentions key facts, numbers, or notable people involved
- Sounds natural when read aloud

Also include 2-3 example tweets that represent this trend.

For the imagePrompt field, follow this structure:
- SUBJECT: One concrete visual (specific person, place, or object) — NOT an abstract concept
- SETTING: Ground it in a recognizable location
- STYLE: Always use "editorial news photo style, realistic lighting, natural colors"
- COMPOSITION: "landscape orientation, minimal background clutter"
- CONSTRAINTS: Always end with "no text in image, non-sensational, no identifiable real individuals"

The imagePrompt should visually represent the key subject or setting of the story described in podcastScript. Make it relevant and concrete.

Return the results in this EXACT JSON format:
{
  "trends": [
    {
      "trendTitle": "Short Trend Title (3-5 words)",
      "topic": "${topicList}",
      "podcastScript": "[Engaging podcast narration about this trend - 2-3 sentences that explain what's happening and why it matters. Make it sound natural and conversational.]",
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
- Find ACTUALLY trending topics right now (not generic content)
${interests && interests.length > 0 ? `- Focus ONLY on topics related to: ${interests.join(", ")}` : "- Include a diverse mix of categories (tech, politics, sports, entertainment, etc.)"}
- DIVERSITY IS KEY: Ensure the stories cover different sub-topics.
- NO REPETITION: Do not output stories about the same event.
- The podcastScript should be engaging and informative, suitable for audio
- imagePrompt must visually represent the story in podcastScript
- Include real tweets from notable/verified accounts
- Return ONLY valid JSON, no markdown or explanations`;

  console.log('📡 Calling XAI API...');
  
  // Retry logic for API calls
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`   Retry attempt ${attempt}/${maxRetries}...`);
        // Exponential backoff: wait 2^attempt seconds
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
      
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${xaiKey}`,
        },
        body: JSON.stringify({
          model: 'grok-4',
          messages: [
            {
              role: 'system',
              content: 'You are Grok, a helpful assistant with access to real-time X/Twitter data. You MUST return results in valid JSON format.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          search_parameters: {
            mode: 'on',
            sources: [{ type: 'x' }],
            return_citations: true,
            fromDate: '2025-12-06',
        toDate: '2025-12-07',
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`XAI API error: ${response.status} - ${errorText}`);
        
        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          throw error;
        }
        
        // Retry on 5xx errors (server errors)
        if (response.status >= 500 && attempt < maxRetries) {
          lastError = error;
          console.warn(`   Server error (${response.status}), will retry...`);
          continue;
        }
        
        throw error;
      }
      
      // Success - break out of retry loop
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in XAI response');
      }

      // Parse JSON from response
      let jsonStr = content.trim();
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const jsonObjectMatch = jsonStr.match(/\{[\s\S]*"trends"[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonStr = jsonObjectMatch[0];
      }

      const parsed = JSON.parse(jsonStr);
      const trends = parsed.trends || [];

      // Convert to Tweet format
      return trends.map((trend: any, index: number) => ({
        id: `trend-${index}-${Date.now()}`,
        user: {
          id: `trend-user-${index}`,
          name: trend.trendTitle || 'Trending',
          handle: '@trending',
          avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(trend.trendTitle || 'trend')}&backgroundColor=1d9bf0`,
        },
        content: trend.podcastScript || '',
        timestamp: 'Trending Now',
        likes: Math.floor(Math.random() * 100000) + 10000,
        retweets: Math.floor(Math.random() * 50000) + 5000,
        topic: trend.topic || 'Trending',
        imageUrl: `https://picsum.photos/seed/${trend.topic || 'trend'}/600/400`,
        trendTitle: trend.trendTitle,
        podcastScript: trend.podcastScript,
        imagePrompt: trend.imagePrompt,
        topTweets: trend.topTweets?.map((t: any) => ({
          author: t.author || 'Unknown',
          handle: t.handle || '@unknown',
          content: t.content || '',
          engagement: t.engagement,
        })),
      }));
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Continue to next retry
      continue;
    }
  }
  
  // Should never reach here, but just in case
  throw lastError || new Error('Failed to fetch trending topics after retries');
}

// Generate audio and images for tweets (using podcastScript and imagePrompt from XAI)
async function generateAudioAndImagesForTweets(
  tweets: any[],
  xaiKey: string,
  supabase: any
): Promise<any[]> {
  const xaiServiceModule = await import('../services/xaiService.js');
  const xaiService = xaiServiceModule.initXAIService(xaiKey);
  // Grok voices - using string literals since we're in Node.js
  const GROK_VOICES = ['Ara', 'Rex', 'Sal', 'Eve', 'Una', 'Leo'] as const;

  const tweetsWithMedia = await Promise.all(
    tweets.map(async (tweet, index) => {
      try {
        let updatedTweet = { ...tweet };
        
        // 1. Generate audio if podcastScript is available
        const textForAudio = tweet.podcastScript || tweet.content || '';
        
        if (textForAudio && textForAudio.length >= 10) {
          // Generate audio using XAI TTS
          const voice = GROK_VOICES[index % GROK_VOICES.length] as 'Ara' | 'Rex' | 'Sal' | 'Eve' | 'Una' | 'Leo';
          console.log(`   [${index + 1}/${tweets.length}] 🎤 Generating audio (${voice})...`);
          
          const audioArrayBuffer = await xaiService.textToSpeechRaw({
            text: textForAudio,
            voice,
            responseFormat: 'mp3',
          });
          
          if (audioArrayBuffer) {
            // Upload to Supabase Storage
            const audioFilename = `${tweet.id}-${Date.now()}.mp3`;
            const audioFilePath = `trending/${audioFilename}`;
            const audioBlob = new Blob([audioArrayBuffer], { type: 'audio/mpeg' });
            
            const { error: audioUploadError } = await supabase.storage
              .from('trending-audio')
              .upload(audioFilePath, audioBlob, {
                contentType: 'audio/mpeg',
                upsert: false,
              });

            if (!audioUploadError) {
              // Get public URL
              const { data: { publicUrl: audioUrl } } = supabase.storage
                .from('trending-audio')
                .getPublicUrl(audioFilePath);

              console.log(`   ✅ Audio generated: ${audioUrl.substring(0, 60)}...`);
              
              updatedTweet = {
                ...updatedTweet,
                audioUrl,
                summary: textForAudio,
                voice,
              };
            } else {
              console.warn(`   ⚠️  Audio upload failed: ${audioUploadError.message}`);
            }
          }
        }
        
        // 2. Generate image - use podcastScript to create better imagePrompt if needed
        let imagePrompt = tweet.imagePrompt;
        const podcastScript = tweet.podcastScript || tweet.content || '';
        
        // If no imagePrompt or it seems generic, generate one from podcastScript
        if (!imagePrompt || imagePrompt.length < 20 || podcastScript.length > 10) {
          // Generate imagePrompt from podcastScript using XAI
          if (podcastScript && podcastScript.length > 10) {
            console.log(`   [${index + 1}/${tweets.length}] 🎨 Creating image prompt from podcast script...`);
            
            try {
              const imagePromptResponse = await xaiService.generateImagePromptFromScript(podcastScript);
              if (imagePromptResponse && imagePromptResponse.length > 20) {
                imagePrompt = imagePromptResponse;
                console.log(`      Generated prompt: ${imagePrompt.substring(0, 80)}...`);
              } else if (tweet.imagePrompt && tweet.imagePrompt.length > 10) {
                // Fallback to original if generation fails
                imagePrompt = tweet.imagePrompt;
                console.log(`      Using original prompt: ${imagePrompt.substring(0, 80)}...`);
              }
            } catch (promptError) {
              console.warn(`   ⚠️  Failed to generate image prompt: ${promptError instanceof Error ? promptError.message : promptError}`);
              if (tweet.imagePrompt && tweet.imagePrompt.length > 10) {
                imagePrompt = tweet.imagePrompt;
              }
            }
          }
        }
        
        if (imagePrompt && imagePrompt.length > 10) {
          console.log(`   [${index + 1}/${tweets.length}] 🎨 Generating image...`);
          console.log(`      Final prompt: ${imagePrompt.substring(0, 80)}...`);
          
          try {
            // Generate image using XAI
            const imageUrl = await xaiService.generateImage(imagePrompt);
            
            if (imageUrl) {
              // Download the image and upload to Supabase Storage
              const imageResponse = await fetch(imageUrl);
              if (imageResponse.ok) {
                const imageBlob = await imageResponse.blob();
                const imageFilename = `${tweet.id}-${Date.now()}.${imageBlob.type.includes('png') ? 'png' : 'jpg'}`;
                const imageFilePath = `trending/${imageFilename}`;
                
                const { error: imageUploadError } = await supabase.storage
                  .from('trending-images')
                  .upload(imageFilePath, imageBlob, {
                    contentType: imageBlob.type,
                    upsert: false,
                  });

                if (!imageUploadError) {
                  // Get public URL
                  const { data: { publicUrl: storedImageUrl } } = supabase.storage
                    .from('trending-images')
                    .getPublicUrl(imageFilePath);

                  console.log(`   ✅ Image generated and stored: ${storedImageUrl.substring(0, 60)}...`);
                  
                  updatedTweet = {
                    ...updatedTweet,
                    imageUrl: storedImageUrl,
                    isImageLoading: false,
                  };
                } else {
                  console.warn(`   ⚠️  Image upload failed: ${imageUploadError.message}`);
                  // Fallback: use the direct URL from XAI (temporary)
                  updatedTweet = {
                    ...updatedTweet,
                    imageUrl,
                    isImageLoading: false,
                  };
                }
              } else {
                console.warn(`   ⚠️  Failed to download generated image`);
              }
            } else {
              console.warn(`   ⚠️  Image generation failed`);
            }
          } catch (imageError) {
            console.error(`   ❌ Image generation error:`, imageError instanceof Error ? imageError.message : imageError);
          }
        } else {
          console.log(`   [${index + 1}/${tweets.length}] ⏭️  Skipping image (no prompt)`);
        }
        
        return updatedTweet;
      } catch (error) {
        console.error(`   ❌ Error for tweet ${tweet.id}:`, error instanceof Error ? error.message : error);
        // Return tweet without media (fallback)
        return tweet;
      }
    })
  );
  
  return tweetsWithMedia;
}

async function main() {
  console.log('🚀 Populating database with trending topics...\n');

  // Define Categories to iterate over
  const CATEGORIES = [
    'Tech', 'AI', 'Space', 'Crypto', 'Sports', 
    'Politics', 'Entertainment', 'Science', 'Business', 'Gaming'
  ];

  // Parse interests from command line args or environment variable
  // Usage: npm run populate-db -- --interests Tech,Crypto
  // Or: INTERESTS=Tech,Crypto npm run populate-db
  const args = process.argv.slice(2);
  let targetCategories: string[] = CATEGORIES;
  
  const interestsIndex = args.indexOf('--interests');
  if (interestsIndex !== -1 && args[interestsIndex + 1]) {
    targetCategories = args[interestsIndex + 1].split(',').map(i => i.trim()).filter(i => i.length > 0);
  } else if (process.env.INTERESTS) {
    targetCategories = process.env.INTERESTS.split(',').map(i => i.trim()).filter(i => i.length > 0);
  }

  console.log(`🎯 Targeting categories: ${targetCategories.join(", ")}\n`);

  // Check environment
  const xaiKey = process.env.XAI_API_KEY;
  let supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!xaiKey) {
    console.error('❌ XAI_API_KEY not found');
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found');
    console.error('   Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  // Fix MCP URL if needed
  if (supabaseUrl.includes('mcp.supabase.com')) {
    const projectRefMatch = supabaseUrl.match(/project_ref=([^&]+)/);
    if (projectRefMatch) {
      supabaseUrl = `https://${projectRefMatch[1]}.supabase.co`;
      console.log(`📍 Detected MCP URL, using: ${supabaseUrl}\n`);
    }
  }

  console.log(`🔗 Using Supabase URL: ${supabaseUrl}\n`);

  try {
    // Initialize Supabase
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const seenTitles = new Set<string>();
    let totalSaved = 0;

    // Iterate through each category
    for (const category of targetCategories) {
      console.log(`\n==========================================`);
      console.log(`📂 Processing Category: ${category}`);
      console.log(`==========================================\n`);

      try {
        console.log(`📰 Fetching trends for ${category}...`);
        
        // Pass the single category (as array) and the seen set
        let tweets = await fetchTrendingFromXAI([category], seenTitles);
        
        // Filter out duplicates based on title similarity
        tweets = tweets.filter(t => {
          // Create a simplified key: lowercase, first 20 chars
          const key = (t.trendTitle || t.content || '').toLowerCase().substring(0, 20);
          if (seenTitles.has(key)) {
            console.log(`   ⚠️ Skipping duplicate: "${t.trendTitle}"`);
            return false;
          }
          seenTitles.add(key);
          return true;
        });

        // Limit to top 10 unique stories per category
        tweets = tweets.slice(0, 10);
        console.log(`✅ Found ${tweets.length} unique trends for ${category}`);

        if (tweets.length === 0) {
          console.warn(`⚠️ No new unique trends found for ${category}, skipping...`);
          continue;
        }

        // Generate Audio & Images
        console.log(`🎤 Generating media for ${category}...`);
        tweets = await generateAudioAndImagesForTweets(tweets, xaiKey, supabase);
        
        // Save to DB
        console.log(`💾 Saving ${tweets.length} stories to database...`);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48); // 48 hour expiry for bulk content
        const generatedAt = new Date().toISOString();

        const records = tweets.map(tweet => ({
          tweet_id: tweet.id,
          generated_at: generatedAt,
          expires_at: expiresAt.toISOString(),
          tweet_data: { ...tweet, topic: category }, // Ensure topic is set correctly
          version: 1
        }));

        const { error } = await supabase
          .from('trending_topics_v2')
          .insert(records);

        if (error) throw error;
        
        console.log(`✅ Saved ${records.length} stories for ${category}!`);
        totalSaved += records.length;

        // Small delay between categories to be nice to APIs
        if (targetCategories.indexOf(category) < targetCategories.length - 1) {
          console.log('⏳ Waiting 2 seconds before next category...');
          await new Promise(r => setTimeout(r, 2000));
        }

      } catch (catError) {
        console.error(`❌ Failed to process category ${category}:`, catError);
        // Continue to next category
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`🎉 COMPLETED! Total stories saved: ${totalSaved}`);
    console.log('='.repeat(50));
    console.log('\n💡 Next: Restart your dev server and check the feed!\n');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  }
}

main();

