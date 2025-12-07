import React, { useState } from 'react';
import { Tweet } from '../types';
import { Loader2, ChevronDown, ChevronUp, MessageCircle, ExternalLink } from 'lucide-react';

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

interface AudioCardProps {
  tweet: Tweet;
  summary: string | null;
  isLoading: boolean;
  voice: GrokVoice;
}

const AudioCard: React.FC<AudioCardProps> = ({ tweet, summary, isLoading, voice }) => {
  const [showTopTweets, setShowTopTweets] = useState(false);
  
  // Use tweet image if available, otherwise high-res user avatar, otherwise standard avatar
  const displayImage = tweet.imageUrl || tweet.user.avatar;
  
  // Check if this is a podcast-style trend
  const isPodcastTrend = !!tweet.trendTitle || !!tweet.podcastScript;
  const hasTopTweets = tweet.topTweets && tweet.topTweets.length > 0;

  return (
    <div className="w-full h-full flex flex-col items-center px-6 relative overflow-hidden">
      
      {/* Background Ambience - blurred version of image */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div 
          className="w-full h-full bg-cover bg-center blur-3xl opacity-30 scale-125 transition-all duration-700"
          style={{ backgroundImage: `url(${displayImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black" />
      </div>

      {/* Main Content Wrapper */}
      <div className="z-10 w-full max-w-sm flex flex-col h-full py-1 overflow-hidden">
        
        {/* Image Container */}
        <div className="flex items-center justify-center py-1 shrink-0">
          <div className="relative w-full max-h-[35vh] aspect-video shadow-2xl rounded-xl overflow-hidden border border-white/10 bg-gray-900">
             <img 
              src={displayImage} 
              alt="Content" 
              className="w-full h-full object-cover"
            />
             {/* Topic Badge */}
            <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-medium text-white border border-white/10">
              {tweet.topic || 'Trending'}
            </div>
            {/* Podcast Badge */}
            {isPodcastTrend && (
              <div className="absolute top-2.5 right-2.5 bg-emerald-500/80 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold text-white">
                🎙️ LIVE
              </div>
            )}
          </div>
        </div>

        {/* Track Info & Summary */}
        <div className="shrink-0 space-y-2 pt-2">
          {/* Title */}
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-white leading-tight line-clamp-2">
              {tweet.trendTitle || tweet.user.name}
            </h2>
            {!isPodcastTrend && (
              <p className="text-gray-400 text-[11px] font-medium">{tweet.user.handle}</p>
            )}
            {isPodcastTrend && (
              <p className="text-emerald-400 text-[11px] font-medium">Trending on X • Now Playing</p>
            )}
            <p className="text-emerald-300 text-[10px] font-semibold">Voice: {voice}</p>
          </div>

          {/* Podcast Script / Summary */}
          <div className="relative">
             {isLoading ? (
               <div className="flex flex-col items-center justify-center h-14 gap-1.5 text-emerald-400 animate-pulse">
                 <Loader2 className="animate-spin w-5 h-5" />
                 <span className="text-[10px] font-medium tracking-wide uppercase">Generating Audio...</span>
               </div>
             ) : (
               <div className="space-y-2">
                 <p className="text-[13px] font-medium text-white/90 leading-snug line-clamp-3">
                   {summary || tweet.podcastScript || tweet.content}
                 </p>
               </div>
             )}
          </div>

          {/* Top Tweets Section (collapsible) */}
          {hasTopTweets && !isLoading && (
            <div className="pt-1">
              <button
                onClick={() => setShowTopTweets(!showTopTweets)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-white transition-colors"
              >
                <MessageCircle size={12} />
                <span>Top Tweets ({tweet.topTweets?.length})</span>
                {showTopTweets ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              
              {showTopTweets && (
                <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                  {tweet.topTweets?.slice(0, 3).map((t, idx) => (
                    <a 
                      key={idx} 
                      href={getTwitterSearchUrl(t.content)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white/5 rounded-lg p-2 border border-white/10 hover:bg-white/10 hover:border-emerald-500/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-semibold text-white">{t.author}</span>
                        <a 
                          href={getTwitterProfileUrl(t.handle)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[9px] text-gray-500 hover:text-emerald-400 transition-colors"
                        >
                          {t.handle}
                        </a>
                        {t.engagement && (
                          <span className="text-[8px] text-emerald-400 ml-auto">{t.engagement}</span>
                        )}
                        <ExternalLink size={10} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <p className="text-[10px] text-gray-300 line-clamp-2 group-hover:text-white transition-colors">{t.content}</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioCard;