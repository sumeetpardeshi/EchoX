import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tweet } from '../types';
import { GeminiService } from '../services/geminiService';
import { audioController } from '../services/audioService';
import AudioCard from './AudioCard';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat } from 'lucide-react';
import { GrokVoice } from '../services/xaiService';

interface FeedProps {
  tweets: Tweet[];
  geminiService: GeminiService | null;
  feedTitle: string;
}

const Feed: React.FC<FeedProps> = ({ tweets, geminiService, feedTitle }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track Data
  const [summary, setSummary] = useState<string | null>(null);
  
  // Progress
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const progressInterval = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Track the current request to prevent race conditions
  const currentRequestId = useRef<string | null>(null);
  const lastLoadedTweetId = useRef<string | null>(null);
  
  // Track if user manually skipped (to prevent auto-play when paused)
  const userSkippedWhilePaused = useRef<boolean>(false);
  // Store the current audio buffer for replay
  const currentAudioBuffer = useRef<AudioBuffer | null>(null);

  const GROK_VOICES: GrokVoice[] = ['Ara', 'Rex', 'Sal', 'Eve', 'Una', 'Leo'];

  // Get current tweet safely
  const currentTweet = tweets[currentIndex];
  const currentTweetId = currentTweet?.id;
  const currentVoice = GROK_VOICES[currentIndex % GROK_VOICES.length];

  // Define callbacks first (before useEffect)
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
      } else {
        setCurrentTime(curr);
        setProgress((curr / trackDuration) * 100);
      }
    }, 100);
  }, [stopProgressLoop]);

  const handleNext = useCallback(() => {
    // Track if user is skipping while paused (to not auto-play)
    const wasPaused = !isPlaying && !isLoading;
    userSkippedWhilePaused.current = wasPaused;
    
    console.log('⏭️ Skip to next, wasPaused:', wasPaused);
    
    setCurrentIndex((prev) => (prev + 1) % tweets.length);
    // Reset last loaded so the new track loads
    lastLoadedTweetId.current = null;
  }, [tweets.length, isPlaying, isLoading]);

  const handleTrackEnd = useCallback(() => {
    console.log('🔊 Track ended naturally, advancing...');
    stopProgressLoop();
    setIsPlaying(false);
    setProgress(100);
    // Auto-advance to next track (this is natural playback end, so always auto-play)
    userSkippedWhilePaused.current = false;
    handleNext();
  }, [stopProgressLoop, handleNext]);

  const playAudio = useCallback(async (buffer: AudioBuffer) => {
    // Set start time to now
    startTimeRef.current = audioController.getContext().currentTime;
    
    console.log('▶️ Starting playback...');
    await audioController.play(buffer, handleTrackEnd);
    
    setIsPlaying(true);
    startProgressLoop(buffer.duration);
  }, [handleTrackEnd, startProgressLoop]);

  // Load current track data when the displayed tweet changes
  useEffect(() => {
    // Skip if no tweet or same tweet already loaded
    // Explicit check for both currentTweet and currentTweetId
    if (!currentTweet || !currentTweetId) return;
    if (lastLoadedTweetId.current === currentTweetId) {
      console.log('⏭️ Skipping - already loaded:', currentTweetId);
      return;
    }

    // Generate unique request ID
    const requestId = `${currentTweetId}-${Date.now()}`;
    currentRequestId.current = requestId;
    
    const loadTrack = async () => {
      // Check if geminiService is available
      if (!geminiService) {
        console.error('Gemini service not available - check GEMINI_API_KEY');
        setError('Audio unavailable - Gemini API key not configured');
        setSummary(currentTweet.content || null);
        setIsLoading(false);
        return;
      }

      const displayTitle = currentTweet.trendTitle || currentTweet.content?.substring(0, 40) || 'Unknown';
      console.log('🎵 Loading track:', currentTweetId, displayTitle);
      
      setIsLoading(true);
      setSummary(null);
      setError(null);
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
      
      // Stop any currently playing track
      audioController.stop();
      stopProgressLoop();
      setIsPlaying(false);

      try {
        // Pass podcastScript if available (skips summarization for pre-written content)
        const data = await geminiService.processTweet(
          currentTweetId, 
          currentTweet.content || '',
          currentTweet.podcastScript
        );
        
        // Check if this request is still current (not superseded by another)
        if (currentRequestId.current !== requestId) {
          console.log('⏭️ Request superseded, skipping playback:', currentTweetId);
          return;
        }
        
        if (data) {
          console.log('✅ Track ready:', currentTweetId, 'duration:', data.audioBuffer.duration.toFixed(2) + 's');
          lastLoadedTweetId.current = currentTweetId;
          currentAudioBuffer.current = data.audioBuffer;
          setSummary(data.summary);
          setDuration(data.audioBuffer.duration);
          setIsLoading(false);
          
          // Auto-play only if:
          // 1. Still the current request
          // 2. User didn't skip while paused
          if (currentRequestId.current === requestId) {
            if (userSkippedWhilePaused.current) {
              console.log('⏸️ User skipped while paused - not auto-playing');
              userSkippedWhilePaused.current = false; // Reset the flag
            } else {
              await playAudio(data.audioBuffer);
            }
          }
        } else {
          console.error('❌ No data returned');
          setError('Failed to generate audio');
          setSummary(currentTweet.content || null);
          setIsLoading(false);
        }
      } catch (e) {
        console.error("❌ Error loading track:", e);
        if (currentRequestId.current === requestId) {
          setError('Error generating audio');
          setSummary(currentTweet.content || null);
          setIsLoading(false);
        }
      }
    };

    loadTrack();

    return () => {
      // Cleanup: invalidate this request
      if (currentRequestId.current === requestId) {
        currentRequestId.current = null;
      }
      stopProgressLoop();
      audioController.stop();
    };
  }, [currentTweetId, currentTweet, geminiService, stopProgressLoop, playAudio, currentVoice]);

  const togglePlay = async () => {
    if (isLoading) return;

    if (isPlaying) {
      // Pause - suspend the audio context
      await audioController.pause();
      setIsPlaying(false);
      stopProgressLoop();
      console.log('⏸️ Playback paused');
    } else {
      // Resume - if we have a buffer loaded but context is suspended
      await audioController.resumeContext();
      setIsPlaying(true);
      startProgressLoop(duration);
      console.log('▶️ Playback resumed');
    }
  };

  const handlePrev = () => {
    // Track if user is skipping while paused (to not auto-play)
    const wasPaused = !isPlaying && !isLoading;
    userSkippedWhilePaused.current = wasPaused;
    
    console.log('⏮️ Skip to previous, wasPaused:', wasPaused);
    
    setCurrentIndex((prev) => (prev - 1 + tweets.length) % tweets.length);
    // Reset last loaded so the new track loads
    lastLoadedTweetId.current = null;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show loading state when no tweets yet
  if (!tweets || tweets.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black text-white pb-[72px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Fetching Live Trends</h3>
            <p className="text-sm text-gray-400">Searching X for what's trending...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-900 to-black text-white pb-[72px] relative">
      {/* Feed Header - Compact */}
      <div className="pt-12 px-6 pb-1 shrink-0 z-10">
        <h3 className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Playing From {feedTitle}</h3>
      </div>

      {/* Main Card Area - min-h-0 allows it to shrink */}
      <div className="flex-1 min-h-0 w-full">
        <AudioCard
          tweet={tweets[currentIndex]}
          summary={summary}
          isLoading={isLoading}
          voice={currentVoice}
        />
      </div>

      {/* Player Controls - Spotify Style */}
      <div className="px-6 pb-2 pt-1 shrink-0 space-y-2 z-20">
        
        {/* Progress Bar */}
        <div className="w-full space-y-1 group">
          <div className="relative w-full h-1 bg-gray-600 rounded-full overflow-hidden">
             <div 
               className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-100 ease-linear group-hover:bg-echo-green"
               style={{ width: `${Math.min(progress, 100)}%` }}
             />
          </div>
          <div className="flex justify-between text-[10px] font-medium text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between px-2">
          <button className="text-gray-400 hover:text-white transition-colors">
            <Shuffle size={18} />
          </button>
          
          <div className="flex items-center gap-5">
            <button 
              onClick={handlePrev}
              className="text-white hover:scale-110 transition-transform"
            >
              <SkipBack size={24} fill="currentColor" />
            </button>

            <button 
              onClick={togglePlay}
              className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-lg shadow-white/10"
              disabled={isLoading}
            >
               {isLoading ? (
                 <div className="w-5 h-5 border-4 border-gray-300 border-t-black rounded-full animate-spin" />
               ) : isPlaying ? (
                 <Pause size={26} fill="currentColor" />
               ) : (
                 <Play size={26} fill="currentColor" className="ml-1" />
               )}
            </button>

            <button 
              onClick={handleNext}
              className="text-white hover:scale-110 transition-transform"
            >
              <SkipForward size={24} fill="currentColor" />
            </button>
          </div>

          <button className="text-gray-400 hover:text-white transition-colors">
            <Repeat size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Feed;