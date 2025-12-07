import React, { useState, useMemo } from 'react';
import Navbar from './components/Navbar';
import Feed from './components/Feed';
import Search from './components/Search';
import ProfileSettings from './components/ProfileSettings';
import { Tab } from './types';
import { GeminiService } from './services/geminiService';
import { audioController } from './services/audioService';
import { useXAITweets } from './hooks/useXAITweets';
import { useXAITweetsWithCache } from './hooks/useXAITweetsWithCache';
import { useUserFilters } from './hooks/useUserFilters';
import { Menu, X, Settings, Info, Volume2, Zap, RefreshCw, Play, Filter } from 'lucide-react';

// Get API keys from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const XAI_API_KEY = process.env.XAI_API_KEY || '';

// Debug: Log API key status on load
console.log('API Keys loaded:', {
  gemini: GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 10)}...` : 'MISSING',
  xai: XAI_API_KEY ? `${XAI_API_KEY.substring(0, 10)}...` : 'MISSING',
});

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.Trending);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // User filters and interests (loaded from localStorage)
  const {
    filters,
    interests,
    activeFiltersCount,
    hasCustomFilters,
    updateFilters,
    updateInterests,
    resetFilters,
    addFromUser,
    removeFromUser,
    addHashtag,
    removeHashtag,
    toggleSource,
  } = useUserFilters();

  // Unlock audio on user interaction (required by browsers)
  const handleStartListening = async () => {
    console.log('🔊 Unlocking audio context...');
    await audioController.resumeContext();
    setIsAudioUnlocked(true);
    console.log('🔊 Audio unlocked! State:', audioController.getState());
  };

  // Initialize Gemini Service
  const geminiService = useMemo(() => {
    if (!GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not set in environment');
      return null;
    }
    return new GeminiService(GEMINI_API_KEY);
  }, []);

  // Use xAI for live tweets with user filters (with cache support)
  const { 
    trendingTweets, 
    myFeedTweets, 
    isLoading: isLoadingTweets, 
    refetchTrending,
    refetchMyFeed,
    isUsingLiveData,
    isUsingCache
  } = useXAITweetsWithCache({
    xaiApiKey: XAI_API_KEY || null,
    filters,
    interests,
  });

  // Show splash screen until audio is unlocked
  if (!isAudioUnlocked) {
    return (
      <div className="relative w-full h-[100dvh] bg-black text-white font-sans overflow-hidden flex flex-col items-center justify-center">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-8 px-8 text-center">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg shadow-white/20">
              <div className="w-5 h-5 bg-black rounded-full" />
            </div>
            <span className="font-bold text-3xl tracking-tight">EchoX</span>
          </div>

          {/* Tagline */}
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-white/90">Listen to X</h1>
            <p className="text-sm text-gray-400 max-w-xs">
              Live trending posts, transformed into audio with Grok AI voice
            </p>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartListening}
            className="group flex items-center gap-3 bg-white text-black font-bold px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-all duration-200 shadow-xl shadow-white/10"
          >
            <Play size={24} fill="currentColor" className="group-hover:scale-110 transition-transform" />
            <span className="text-lg">Start Listening</span>
          </button>

          {/* Info */}
          <p className="text-[10px] text-gray-500 mt-4">
            Powered by Grok TTS • {XAI_API_KEY ? '✓ Live Data' : 'Demo Mode'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] bg-black text-white font-sans overflow-hidden flex flex-col">
      
      {/* Top Header - Compact */}
      <header className="absolute top-0 left-0 w-full z-40 px-4 py-2 flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent pointer-events-none">
        {/* Logo / Brand (Left) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
            <div className="w-3 h-3 bg-black rounded-full" />
          </div>
          <span className="font-bold text-base tracking-tight">EchoX</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* <button className="bg-white text-black text-[10px] font-bold px-3 py-1.5 rounded-full hover:scale-105 transition-transform">
            Open App
          </button> */}
          <button 
            className="text-white p-1 hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Slide-out Menu Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Slide-out Menu Panel */}
      <div className={`fixed top-0 right-0 h-full w-72 bg-gray-900 z-50 transform transition-transform duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <span className="font-bold text-lg">Menu</span>
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Menu Items */}
          <div className="flex-1 py-2">
            {/* Live Data Status */}
            <div className="px-4 py-3 border-b border-white/5 mb-2">
              <div className="flex items-center gap-2">
                <Zap size={16} className={isUsingLiveData ? 'text-echo-green' : 'text-gray-500'} />
                <span className="text-xs font-medium text-gray-400">
                  {isUsingLiveData ? 'Live data from X' : 'Using demo content'}
                </span>
              </div>
              {isUsingLiveData && (
                <p className="text-[10px] text-gray-600 mt-1 ml-6">Powered by Grok Live Search</p>
              )}
            </div>

            {/* Refresh Button */}
            {XAI_API_KEY && (
              <button 
                onClick={async () => {
                  await Promise.all([refetchTrending(), refetchMyFeed()]);
                }}
                disabled={isLoadingTweets}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left disabled:opacity-50"
              >
                <RefreshCw size={20} className={`text-gray-400 ${isLoadingTweets ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">
                  {isLoadingTweets ? 'Refreshing...' : 'Refresh Feed'}
                </span>
              </button>
            )}

            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
              <Volume2 size={20} className="text-gray-400" />
              <span className="text-sm font-medium">Audio Settings</span>
            </button>
            <button 
              onClick={() => {
                setIsMenuOpen(false);
                setIsProfileOpen(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
            >
              <div className="relative">
                <Filter size={20} className="text-emerald-400" />
                {hasCustomFilters && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Search Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                      {activeFiltersCount} active
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500">
                  {hasCustomFilters ? '💾 Saved filters loaded' : 'Default settings'}
                  {filters.verified && ' • Verified'}
                  {filters.fromUsers.length > 0 && ` • ${filters.fromUsers.length} users`}
                </p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
              <Settings size={20} className="text-gray-400" />
              <span className="text-sm font-medium">Preferences</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
              <Info size={20} className="text-gray-400" />
              <span className="text-sm font-medium">About EchoX</span>
            </button>
          </div>

          {/* Menu Footer */}
          <div className="p-4 border-t border-white/10">
            <p className="text-[10px] text-gray-500 text-center">EchoX v1.0.0</p>
            <p className="text-[9px] text-gray-600 text-center mt-1">
              {GEMINI_API_KEY ? '✓ Gemini' : '✗ Gemini'} • {XAI_API_KEY ? '✓ xAI' : '✗ xAI'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full relative">
        {currentTab === Tab.Trending && (
          <Feed 
            tweets={trendingTweets} 
            geminiService={geminiService} 
            feedTitle={isUsingLiveData ? "Live Trending" : "Trending"}
          />
        )}
        
        {currentTab === Tab.MyFeed && (
          <Feed 
            tweets={myFeedTweets} 
            geminiService={geminiService} 
            feedTitle={isUsingLiveData ? "Live Feed" : "My Feed"}
          />
        )}
        
        {currentTab === Tab.Search && (
          <Search />
        )}
      </main>

      {/* Navigation */}
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Profile Settings Modal */}
      <ProfileSettings
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        filters={filters}
        interests={interests}
        updateFilters={updateFilters}
        updateInterests={updateInterests}
        resetFilters={resetFilters}
        addFromUser={addFromUser}
        removeFromUser={removeFromUser}
        addHashtag={addHashtag}
        removeHashtag={removeHashtag}
        toggleSource={toggleSource}
        onApplyAndRefresh={async () => {
          await Promise.all([refetchTrending(), refetchMyFeed()]);
        }}
        isRefreshing={isLoadingTweets}
      />
    </div>
  );
};

export default App;