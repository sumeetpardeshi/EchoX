import React, { useState, useMemo, useEffect } from 'react';
import Navbar from './components/Navbar';
import Feed from './components/Feed';
import Search from './components/Search';
import { Tab } from './types';
import { GeminiService } from './services/geminiService';
import { audioController } from './services/audioService';
import { useXAITweets } from './hooks/useXAITweets';
import { useXAuth } from './hooks/useXAuth';
import { Menu, X, Settings, Info, Volume2, Zap, RefreshCw, Play } from 'lucide-react';

// Get API keys from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const XAI_API_KEY = process.env.XAI_API_KEY || '';
const X_CLIENT_ID = process.env.X_CLIENT_ID || '';
const X_REDIRECT_URI = process.env.X_REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin : '');

// Debug: Log API key status on load
console.log('API Keys loaded:', {
  gemini: GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 10)}...` : 'MISSING',
  xai: XAI_API_KEY ? `${XAI_API_KEY.substring(0, 10)}...` : 'MISSING',
});

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.Trending);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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

  // X OAuth (PKCE) helper
  const { token: xBearerToken, isLoading: isAuthLoading, error: authError, startAuth, clearToken, setManualToken } = useXAuth({
    clientId: X_CLIENT_ID,
    redirectUri: X_REDIRECT_URI,
    scopes: ['tweet.read', 'users.read', 'follows.read', 'offline.access'],
  });
  const [manualTokenInput, setManualTokenInput] = useState('');

  useEffect(() => {
    if (xBearerToken) {
      setManualTokenInput(xBearerToken);
    }
  }, [xBearerToken]);

  // Use xAI for live tweets (falls back to mock data if no key)
  const { 
    trendingTweets, 
    myFeedTweets, 
    isLoading: isLoadingTweets, 
    refetchTrending,
    refetchMyFeed,
    isUsingLiveData,
    isUsingAuthedFeed,
    xProfile,
    xAuthError,
  } = useXAITweets(XAI_API_KEY || null, xBearerToken);

  const isSignedIn = !!xProfile;
  const myFeedTitle = isSignedIn 
    ? `@${xProfile?.username}'s Home Timeline` 
    : 'My Feed • Sign in to X';

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
          <button className="bg-white text-black text-[10px] font-bold px-3 py-1.5 rounded-full hover:scale-105 transition-transform">
            Open App
          </button>
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

            {/* X Sign-in */}
            <div className="px-4 py-3 border-b border-white/5 mb-2 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">My X Timeline</span>
                  <span className="text-[10px] text-gray-500">
                    {isSignedIn 
                      ? `Signed in as @${xProfile?.username}` 
                      : 'Paste your X bearer token to read your Home timeline aloud'}
                  </span>
                  {(xAuthError || authError) && (
                    <span className="text-[10px] text-red-400">{xAuthError || authError}</span>
                  )}
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="text-[11px] font-bold bg-white text-black px-3 py-1.5 rounded-full hover:scale-105 transition-transform"
                >
                  {isSignedIn ? 'Manage' : 'Connect'}
                </button>
              </div>
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
        {currentTab === Tab.MyFeed && !isSignedIn && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full shadow-lg">
              <span className="text-[11px] text-white">
                Connect X to stream your Home timeline with rotating voices
              </span>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="text-[11px] font-bold bg-white text-black px-3 py-1 rounded-full hover:scale-105 transition-transform"
              >
                Connect
              </button>
            </div>
          </div>
        )}

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
            feedTitle={myFeedTitle}
          />
        )}
        
        {currentTab === Tab.Search && (
          <Search />
        )}
      </main>

      {/* Navigation */}
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* X Sign-in Modal */}
      {isAuthModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setIsAuthModalOpen(false)}
        >
          <div 
            className="w-full max-w-xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Connect your X account</h3>
                <p className="text-[12px] text-gray-400">
                  Paste a user Bearer token (OAuth user context) so we can call the X Home Timeline endpoint and read it aloud with rotating voices.
                </p>
              </div>
              <button 
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                onClick={() => setIsAuthModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] text-gray-300 font-medium">Paste bearer token (optional)</label>
              <textarea
                value={manualTokenInput}
                onChange={(e) => setManualTokenInput(e.target.value)}
                placeholder="Paste your user bearer token (OAuth 2.0 user context)"
                className="w-full h-24 bg-black/40 border border-white/10 rounded-lg text-sm text-white p-3 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    if (manualTokenInput.trim()) {
                      setManualToken(manualTokenInput);
                      setIsAuthModalOpen(false);
                    }
                  }}
                  disabled={!manualTokenInput.trim()}
                  className="text-sm px-4 py-2 rounded-full bg-white text-black font-bold hover:scale-105 transition-transform disabled:opacity-60 disabled:hover:scale-100"
                >
                  Use pasted token
                </button>
                <span className="text-[11px] text-gray-500">Must be a user-context token (not app-only).</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={startAuth}
                disabled={!X_CLIENT_ID || !X_REDIRECT_URI || isAuthLoading}
                className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold px-4 py-3 rounded-lg hover:scale-105 transition-transform disabled:opacity-60 disabled:hover:scale-100"
              >
                {isAuthLoading ? 'Connecting…' : 'Sign in with X'}
              </button>
              <p className="text-[11px] text-gray-400">
                We use OAuth 2.0 Authorization Code with PKCE. Make sure <code className="font-mono">X_CLIENT_ID</code> and <code className="font-mono">X_REDIRECT_URI</code> are set in your env.
              </p>
            </div>
            {(xAuthError || authError) && (
              <p className="text-[12px] text-red-400">{xAuthError || authError}</p>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => { clearToken(); setIsAuthModalOpen(false); }}
                className="text-[12px] text-gray-300 hover:text-white underline disabled:opacity-50"
                disabled={!xBearerToken}
              >
                Disconnect
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAuthModalOpen(false)}
                  className="text-sm px-4 py-2 rounded-full border border-white/10 text-white hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500">
              We call the X Home Timeline endpoint directly from your browser. Remove the token anytime via Disconnect.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
