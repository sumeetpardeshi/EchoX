import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tweet } from '../types';
import { GeminiService } from '../services/geminiService';
import { audioController } from '../services/audioService';
import { Play, Pause, ArrowLeft, MessageCircle, ExternalLink } from 'lucide-react';
import { cacheService } from '../services/cacheService';
import { getXAIService } from '../services/xaiService';

// Helper to create X/Twitter profile URL from handle
function getTwitterProfileUrl(handle: string): string {
  const cleanHandle = handle.replace('@', '');
  return `https://x.com/${cleanHandle}`;
}

// Helper to create X/Twitter search URL for the tweet content
function getTwitterSearchUrl(content: string): string {
  // Encode the content for URL and limit length
  const searchQuery = encodeURIComponent(content.slice(0, 100));
  return `https://x.com/search?q=${searchQuery}&f=live`;
}

const StoryPage: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const [tweet, setTweet] = useState<Tweet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasAudio, setHasAudio] = useState(false); // Track if audio is loaded
  
  const progressInterval = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const currentAudioBuffer = useRef<AudioBuffer | null>(null);

  // Initialize Gemini Service
  const geminiService = React.useMemo(() => {
    const key = process.env.GEMINI_API_KEY || '';
    if (!key) return null;
    return new GeminiService(key);
  }, []);

  // Load story from cache or API
  useEffect(() => {
    const loadStory = async () => {
      if (!storyId) {
        setError('Invalid story ID');
        setIsLoading(false);
        return;
      }

      try {
        console.log('🔍 Loading story with ID:', storyId);
        
        // Try to get from cache first (includes expired entries)
        const cachedTweet = await cacheService.getTrendById(storyId);
        if (cachedTweet) {
          console.log('✅ Story found in cache:', {
            id: cachedTweet.id,
            title: cachedTweet.trendTitle,
            hasAudioUrl: !!cachedTweet.audioUrl,
            hasImageUrl: !!cachedTweet.imageUrl
          });
          setTweet(cachedTweet);
          setSummary(cachedTweet.summary || cachedTweet.content || null);
          setIsLoading(false);
          return;
        }

        console.warn('⚠️ Story not found in cache:', storyId);
        
        // If not in cache, try to fetch from XAI (for personalized feeds)
        // This is a fallback - ideally all shared stories should be in cache
        const xaiService = getXAIService();
        if (xaiService) {
          // You might need to implement a method to fetch a single tweet by ID
          // For now, show error
          setError('Story not found in cache. It may have expired or been deleted.');
        } else {
          setError('Story not found. The story may have expired or the cache is unavailable.');
        }
        setIsLoading(false);
      } catch (err) {
        console.error('❌ Error loading story:', err);
        setError(`Failed to load story: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    loadStory();
  }, [storyId]);

  const stopProgressLoop = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  }, []);

  const startProgressLoop = useCallback((trackDuration: number) => {
    stopProgressLoop();
    progressInterval.current = window.setInterval(() => {
      const ctx = audioController.getContext();
      const curr = ctx.currentTime - startTimeRef.current;
      
      if (curr >= trackDuration && trackDuration > 0) {
        setProgress(100);
        setIsPlaying(false);
        stopProgressLoop();
      } else {
        setCurrentTime(curr);
        setProgress((curr / trackDuration) * 100);
      }
    }, 100);
  }, [stopProgressLoop]);

  const handleTrackEnd = useCallback(() => {
    console.log('🔊 Track ended');
    stopProgressLoop();
    setIsPlaying(false);
    setProgress(100);
  }, [stopProgressLoop]);

  const playAudio = useCallback(async (buffer: AudioBuffer) => {
    startTimeRef.current = audioController.getContext().currentTime;
    console.log('▶️ Starting playback...');
    await audioController.play(buffer, handleTrackEnd);
    setIsPlaying(true);
    startProgressLoop(buffer.duration);
  }, [handleTrackEnd, startProgressLoop]);

  // Load and play audio when tweet is loaded
  useEffect(() => {
    if (!tweet) {
      setHasAudio(false);
      return;
    }

    // Reset audio state when tweet changes
    setHasAudio(false);
    currentAudioBuffer.current = null;
    setDuration(0);

    const loadAudio = async () => {
      try {
        // Check for pre-generated audio first (doesn't require geminiService)
        if (tweet.audioUrl) {
          console.log('🎵 Loading pre-generated audio:', tweet.audioUrl);
          try {
            const response = await fetch(tweet.audioUrl);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              const audioBuffer = await audioController.getContext().decodeAudioData(arrayBuffer);
              currentAudioBuffer.current = audioBuffer;
              setDuration(audioBuffer.duration);
              setHasAudio(true); // Trigger re-render
              console.log('✅ Audio loaded successfully, duration:', audioBuffer.duration.toFixed(2) + 's');
              return;
            } else {
              console.warn('⚠️ Failed to fetch audio, status:', response.status);
            }
          } catch (audioError) {
            console.error('❌ Error loading pre-generated audio:', audioError);
            // Fall through to client-side generation
          }
        }

        // Fallback: Generate client-side (only if geminiService is available)
        if (geminiService && (tweet.content || tweet.podcastScript)) {
          console.log('🎙️ Generating audio client-side...');
          const data = await geminiService.processTweet(
            tweet.id,
            tweet.content || '',
            tweet.podcastScript
          );
          if (data?.audioBuffer) {
            currentAudioBuffer.current = data.audioBuffer;
            setDuration(data.audioBuffer.duration);
            setHasAudio(true); // Trigger re-render
            console.log('✅ Audio generated successfully, duration:', data.audioBuffer.duration.toFixed(2) + 's');
          } else {
            console.warn('⚠️ No audio buffer returned from processTweet');
          }
        } else if (!tweet.audioUrl) {
          console.warn('⚠️ No audio URL and geminiService not available - audio cannot be loaded');
        }
      } catch (err) {
        console.error('❌ Error loading audio:', err);
      }
    };

    loadAudio();
  }, [tweet, geminiService]);

  const togglePlay = useCallback(async () => {
    if (!currentAudioBuffer.current) return;

    // Ensure audio context is resumed (required for browser autoplay policies)
    await audioController.resumeContext();

    if (isPlaying) {
      // Pause - suspend the audio context (source continues but context is suspended)
      await audioController.pause();
      setIsPlaying(false);
      stopProgressLoop();
      console.log('⏸️ Playback paused');
    } else {
      // Play/Resume - check if audio is already playing (context suspended) or needs to start
      const ctx = audioController.getContext();
      if (ctx.state === 'suspended' && currentTime > 0) {
        // Resume - context was suspended, resume it and continue progress tracking
        await audioController.resumeContext();
        setIsPlaying(true);
        startProgressLoop(duration);
        console.log('▶️ Playback resumed from', currentTime.toFixed(2), 's');
      } else {
        // Start - play from beginning or current position
        if (currentAudioBuffer.current) {
          await playAudio(currentAudioBuffer.current);
        }
      }
    }
  }, [isPlaying, playAudio, stopProgressLoop, startProgressLoop, duration, currentTime]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p>Loading story...</p>
        </div>
      </div>
    );
  }

  if (error || !tweet) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-2xl font-bold mb-4">Story Not Found</h1>
          <p className="text-gray-400 mb-6">{error || 'The story you\'re looking for doesn\'t exist or has expired.'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10 p-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
      </div>

      {/* Story Content - Scrollable area with fixed audio player */}
      <div className="flex flex-col h-[calc(100vh-64px)] max-w-2xl mx-auto w-full">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {/* Image */}
          {tweet.imageUrl && (
            <div className="mb-6 flex items-center justify-center">
              <div className="relative w-full max-w-sm max-h-[35vh] aspect-video shadow-2xl rounded-xl overflow-hidden border border-white/10 bg-gray-900">
                <img
                  src={tweet.imageUrl}
                  alt={tweet.trendTitle || 'Story image'}
                  className="w-full h-full object-cover"
                />
                {/* Topic Badge */}
                {tweet.topic && (
                  <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-medium text-white border border-white/10">
                    {tweet.topic}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audio Player */}
          <div className="mb-6">
            {tweet.audioUrl || hasAudio ? (
              <div className="bg-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={togglePlay}
                    className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!currentAudioBuffer.current}
                    title={currentAudioBuffer.current ? (isPlaying ? 'Pause' : 'Play') : 'Loading audio...'}
                  >
                    {isPlaying ? (
                      <Pause size={24} fill="currentColor" />
                    ) : (
                      <Play size={24} fill="currentColor" className="ml-1" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="text-sm text-gray-400 mb-1">
                      {currentAudioBuffer.current ? (
                        `${Math.floor(currentTime)}s / ${Math.floor(duration)}s`
                      ) : (
                        'Loading audio...'
                      )}
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div
                        className="bg-white h-1.5 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
                {!currentAudioBuffer.current && tweet.audioUrl && (
                  <p className="text-xs text-gray-500 mt-2">Audio is loading...</p>
                )}
              </div>
            ) : (
              <div className="bg-white/5 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-sm">Audio not available for this story</p>
              </div>
            )}
          </div>

          {/* Title */}
          {tweet.trendTitle && (
            <h1 className="text-3xl font-bold mb-4">{tweet.trendTitle}</h1>
          )}

          {/* Summary/Content - Scrollable */}
          <div className="mb-6">
            <p className="text-lg text-gray-300 leading-relaxed whitespace-pre-wrap">
              {summary || tweet.content || 'No content available'}
            </p>
          </div>

          {/* Metadata */}
          <div className="text-sm text-gray-500 space-y-2 mb-8">
            {tweet.topic && (
              <div>
                <span className="text-gray-400">Topic: </span>
                {tweet.topic}
              </div>
            )}
          </div>

          {/* Top Tweets / Sources */}
          {tweet.topTweets && tweet.topTweets.length > 0 && (
            <div className="mb-8 pt-6 border-t border-white/10">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <MessageCircle size={20} className="text-emerald-400" />
                <span>Sources & Top Tweets</span>
                <span className="text-xs font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                  {tweet.topTweets.length}
                </span>
              </h3>
              <div className="space-y-3">
                {tweet.topTweets.map((t, idx) => (
                  <a 
                    key={idx} 
                    href={getTwitterSearchUrl(t.content)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 hover:border-emerald-500/30 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-white">{t.author}</span>
                      <a 
                        href={getTwitterProfileUrl(t.handle)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-gray-500 hover:text-emerald-400 transition-colors"
                      >
                        {t.handle}
                      </a>
                      {t.engagement && (
                        <span className="text-[10px] text-emerald-400 ml-auto bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          {t.engagement}
                        </span>
                      )}
                      <ExternalLink size={12} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                    </div>
                    <p className="text-sm text-gray-300 group-hover:text-white transition-colors leading-relaxed">
                      {t.content}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryPage;

