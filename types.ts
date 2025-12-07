export interface User {
  id: string;
  name: string;
  handle: string;
  avatar: string;
}

export interface TopTweet {
  author: string;
  handle: string;
  content: string;
  engagement?: string;
}

export interface Tweet {
  id: string;
  user: User;
  content: string;
  timestamp: string;
  likes: number;
  retweets: number;
  imageUrl?: string;
  topic?: string;
  // Podcast-style fields
  podcastScript?: string;      // The podcast narration for this trend
  trendTitle?: string;         // Short title of the trend
  topTweets?: TopTweet[];      // Sample tweets driving this trend
}

export interface AudioState {
  isPlaying: boolean;
  isLoading: boolean;
  progress: number; // 0 to 100
  duration: number;
  error?: string;
}

export enum Tab {
  Trending = 'TRENDING',
  MyFeed = 'MY_FEED',
  Search = 'SEARCH'
}

export interface SummaryResult {
  text: string;
  audioBuffer?: AudioBuffer;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  image?: string;
}