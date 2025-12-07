import { Tweet } from '../types';

export interface XProfile {
  id: string;
  name: string;
  username: string;
  profileImageUrl?: string;
}

interface TimelineTweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
  };
  attachments?: {
    media_keys?: string[];
  };
}

interface TimelineResponse {
  data?: TimelineTweet[];
  includes?: {
    users?: Array<{
      id: string;
      name: string;
      username: string;
      profile_image_url?: string;
      verified?: boolean;
    }>;
    media?: Array<{
      media_key: string;
      url?: string;
      preview_image_url?: string;
    }>;
  };
}

const TWITTER_API_BASE = import.meta.env.DEV
  ? '/api/twitter/2'
  : 'https://api.x.com/2';

interface FollowingResponse {
  data?: Array<{
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
    verified?: boolean;
    public_metrics?: { followers_count?: number };
  }>;
  meta?: { next_token?: string };
}

export class TwitterService {
  private bearerToken: string;

  constructor(bearerToken: string) {
    this.bearerToken = bearerToken;
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.bearerToken}`,
      'Content-Type': 'application/json',
    };
  }

  private mapTweetToModel(
    tweet: TimelineTweet,
    userMap: Map<string, { id: string; name: string; username: string; profile_image_url?: string }>,
    defaultTopic: string = 'Following',
  ): Tweet {
    const author = tweet.author_id ? userMap.get(tweet.author_id) : undefined;
    return {
      id: `x-${tweet.id}`,
      user: {
        id: author?.id || tweet.author_id || tweet.id,
        name: author?.name || 'Unknown',
        handle: author?.username ? `@${author.username}` : '@unknown',
        avatar: author?.profile_image_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${tweet.author_id || tweet.id}`,
      },
      content: tweet.text,
      timestamp: tweet.created_at ? new Date(tweet.created_at).toLocaleString() : 'Just now',
      likes: tweet.public_metrics?.like_count ?? 0,
      retweets: tweet.public_metrics?.retweet_count ?? 0,
      imageUrl: undefined,
      topic: defaultTopic,
    };
  }

  async fetchCurrentUser(): Promise<XProfile> {
    const url = `${TWITTER_API_BASE}/users/me?user.fields=profile_image_url,username,name`;
    const res = await fetch(url, { headers: this.getHeaders() });

    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body?.detail || body?.title || '';
      } catch {
        detail = await res.text();
      }
      if (res.status === 403 && detail.toLowerCase().includes('authentication')) {
        throw new Error('X token must be USER context (OAuth 1.0a or OAuth 2.0 user). App-only bearer tokens are rejected for timelines.');
      }
      throw new Error(`Failed to verify X token: ${res.status} ${detail}`);
    }

    const body = await res.json();
    const user = body.data;
    if (!user?.id) {
      throw new Error('No X user returned');
    }

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      profileImageUrl: user.profile_image_url,
    };
  }

  async fetchHomeTimeline(userId: string, maxResults: number = 20): Promise<Tweet[]> {
    const url = new URL(`${TWITTER_API_BASE}/users/${userId}/timelines/reverse_chronological`);
    url.searchParams.set('max_results', String(maxResults));
    url.searchParams.set('expansions', 'author_id,attachments.media_keys');
    url.searchParams.set('tweet.fields', 'created_at,public_metrics,attachments');
    url.searchParams.set('user.fields', 'name,username,profile_image_url,verified');
    url.searchParams.set('media.fields', 'url,preview_image_url');

    const res = await fetch(url.toString(), { headers: this.getHeaders() });
    const resText = await res.text();

    if (!res.ok) {
      throw new Error(`Failed to load home timeline: ${res.status} ${resText}`);
    }

    let json: TimelineResponse;
    try {
      json = JSON.parse(resText);
    } catch (e) {
      throw new Error('Could not parse X timeline response');
    }

    const mediaMap = new Map<string, { url?: string; preview_image_url?: string }>();
    json.includes?.media?.forEach((m) => mediaMap.set(m.media_key, m));

    const userMap = new Map<string, { id: string; name: string; username: string; profile_image_url?: string; verified?: boolean }>();
    json.includes?.users?.forEach((u) => userMap.set(u.id, u));

    const tweets = json.data || [];
    return tweets.map((tweet): Tweet => {
      const author = tweet.author_id ? userMap.get(tweet.author_id) : undefined;
      const mediaKey = tweet.attachments?.media_keys?.[0];
      const media = mediaKey ? mediaMap.get(mediaKey) : undefined;

      return {
        id: `x-${tweet.id}`,
        user: {
          id: author?.id || tweet.author_id || tweet.id,
          name: author?.name || 'Unknown',
          handle: author?.username ? `@${author.username}` : '@unknown',
          avatar: author?.profile_image_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${tweet.author_id || tweet.id}`,
        },
        content: tweet.text,
        timestamp: tweet.created_at ? new Date(tweet.created_at).toLocaleString() : 'Just now',
        likes: tweet.public_metrics?.like_count ?? 0,
        retweets: tweet.public_metrics?.retweet_count ?? 0,
        imageUrl: media?.url || media?.preview_image_url,
        topic: 'Following',
      };
    });
  }

  async fetchFollowing(userId: string, maxToFetch: number = 400): Promise<FollowingResponse['data']> {
    let nextToken: string | undefined;
    const collected: FollowingResponse['data'] = [];

    while (collected.length < maxToFetch) {
      const url = new URL(`${TWITTER_API_BASE}/users/${userId}/following`);
      url.searchParams.set('max_results', '1000'); // API caps at 1000 per page
      url.searchParams.set('user.fields', 'profile_image_url,verified,public_metrics');
      if (nextToken) url.searchParams.set('pagination_token', nextToken);

      const res = await fetch(url.toString(), { headers: this.getHeaders() });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Failed to fetch following: ${res.status} ${text}`);
      }
      const json: FollowingResponse = JSON.parse(text);
      if (json.data) {
        collected.push(...json.data);
      }
      nextToken = json.meta?.next_token;
      if (!nextToken) break;
    }

    return collected.slice(0, maxToFetch);
  }

  async fetchUserTweets(userId: string, sinceISO: string, maxResults: number = 50): Promise<Tweet[]> {
    const url = new URL(`${TWITTER_API_BASE}/users/${userId}/tweets`);
    url.searchParams.set('max_results', String(Math.min(100, maxResults)));
    url.searchParams.set('start_time', sinceISO);
    url.searchParams.set('tweet.fields', 'created_at,public_metrics');
    url.searchParams.set('expansions', 'author_id');
    url.searchParams.set('user.fields', 'name,username,profile_image_url');

    const res = await fetch(url.toString(), { headers: this.getHeaders() });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Failed to fetch user tweets: ${res.status} ${text}`);
    }
    const json: TimelineResponse = JSON.parse(text);

    const userMap = new Map<string, { id: string; name: string; username: string; profile_image_url?: string }>();
    json.includes?.users?.forEach((u) => userMap.set(u.id, u));

    return (json.data || []).map((t) => this.mapTweetToModel(t, userMap, 'Following'));
  }

  /**
   * Build a synthetic feed:
   * - If following > 200: sample up to sampleSize accounts randomly to keep it efficient
   * - If following <= 200: sort by follower count descending and take top sampleSize accounts
   * - Pull posts from last `lookbackDays` days
   */
  async fetchSyntheticFeed(userId: string, sampleSize: number = 200, lookbackDays: number = 3): Promise<Tweet[]> {
    const following = await this.fetchFollowing(userId, 1000);
    const followCount = following?.length || 0;
    const threeDaysAgo = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    let selected = following || [];
    if (followCount > sampleSize) {
      // Reservoir/partial Fisher-Yates sampling for efficiency
      const arr = [...selected];
      for (let i = arr.length - 1; i > arr.length - sampleSize - 1; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      selected = arr.slice(arr.length - sampleSize);
    } else if (followCount > 0) {
      selected = [...selected].sort((a, b) => (b?.public_metrics?.followers_count || 0) - (a?.public_metrics?.followers_count || 0)).slice(0, sampleSize);
    }

    const tweets: Tweet[] = [];
    for (const user of selected) {
      const userTweets = await this.fetchUserTweets(user.id, threeDaysAgo, 10);
      tweets.push(...userTweets);
    }

    // Sort newest first
    return tweets.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

export function initTwitterService(bearerToken: string): TwitterService {
  return new TwitterService(bearerToken);
}
