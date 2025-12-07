import { useState, useEffect, useCallback } from 'react';
import { SearchFilters, DEFAULT_FILTERS } from '../services/xaiService';

const STORAGE_KEY = 'echox-user-filters';
const INTERESTS_KEY = 'echox-user-interests';

// Available languages supported by X search
export const LANGUAGES = [
  { code: '', label: 'Any Language' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ru', label: 'Russian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
] as const;

// Interest categories for personalized feed
export const INTEREST_OPTIONS = [
  'AI',
  'Tech',
  'Science',
  'Startups',
  'Crypto',
  'Space',
  'Gaming',
  'Music',
  'Sports',
  'Politics',
  'Business',
  'Entertainment',
  'Health',
  'Finance',
  'Art',
  'Education',
] as const;

export type InterestCategory = typeof INTEREST_OPTIONS[number];

interface UseUserFiltersReturn {
  filters: SearchFilters;
  interests: string[];
  activeFiltersCount: number;
  hasCustomFilters: boolean;
  updateFilters: (updates: Partial<SearchFilters>) => void;
  updateInterests: (interests: string[]) => void;
  resetFilters: () => void;
  addFromUser: (handle: string) => void;
  removeFromUser: (handle: string) => void;
  addHashtag: (tag: string) => void;
  removeHashtag: (tag: string) => void;
  toggleSource: (source: 'x' | 'web' | 'news') => void;
}

// Helper to count active (non-default) filters
function countActiveFilters(filters: SearchFilters): number {
  let count = 0;
  if (filters.fromUsers.length > 0) count++;
  if (filters.hashtags.length > 0) count++;
  if (filters.language) count++;
  if (filters.fromDate) count++;
  if (filters.toDate) count++;
  if (filters.minLikes > 0) count++;
  if (filters.minRetweets > 0) count++;
  if (!filters.includeReplies) count++;
  if (!filters.includeRetweets) count++;
  if (filters.mediaOnly) count++;
  if (filters.verified) count++;
  if (filters.sources.length !== 1 || !filters.sources.includes('x')) count++;
  return count;
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as T;
      console.log(`💾 Loaded ${key} from localStorage:`, parsed);
      return parsed;
    }
    console.log(`💾 No saved ${key} found, using defaults`);
  } catch (e) {
    console.error('Error loading from localStorage:', e);
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
}

export function useUserFilters(): UseUserFiltersReturn {
  const [filters, setFilters] = useState<SearchFilters>(() => 
    loadFromStorage(STORAGE_KEY, DEFAULT_FILTERS)
  );
  
  const [interests, setInterests] = useState<string[]>(() => 
    loadFromStorage(INTERESTS_KEY, [...INTEREST_OPTIONS])
  );

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    saveToStorage(STORAGE_KEY, filters);
  }, [filters]);

  // Persist interests to localStorage whenever they change
  useEffect(() => {
    saveToStorage(INTERESTS_KEY, interests);
  }, [interests]);

  const updateFilters = useCallback((updates: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateInterests = useCallback((newInterests: string[]) => {
    setInterests(newInterests);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setInterests([...INTEREST_OPTIONS]);
  }, []);

  const addFromUser = useCallback((handle: string) => {
    const cleanHandle = handle.replace('@', '').trim();
    if (cleanHandle && !filters.fromUsers.includes(cleanHandle)) {
      setFilters((prev) => ({
        ...prev,
        fromUsers: [...prev.fromUsers, cleanHandle],
      }));
    }
  }, [filters.fromUsers]);

  const removeFromUser = useCallback((handle: string) => {
    setFilters((prev) => ({
      ...prev,
      fromUsers: prev.fromUsers.filter((u) => u !== handle),
    }));
  }, []);

  const addHashtag = useCallback((tag: string) => {
    const cleanTag = tag.replace('#', '').trim();
    if (cleanTag && !filters.hashtags.includes(cleanTag)) {
      setFilters((prev) => ({
        ...prev,
        hashtags: [...prev.hashtags, cleanTag],
      }));
    }
  }, [filters.hashtags]);

  const removeHashtag = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      hashtags: prev.hashtags.filter((h) => h !== tag),
    }));
  }, []);

  const toggleSource = useCallback((source: 'x' | 'web' | 'news') => {
    setFilters((prev) => {
      const currentSources = prev.sources;
      if (currentSources.includes(source)) {
        // Don't allow removing the last source
        if (currentSources.length === 1) return prev;
        return {
          ...prev,
          sources: currentSources.filter((s) => s !== source),
        };
      } else {
        return {
          ...prev,
          sources: [...currentSources, source],
        };
      }
    });
  }, []);

  const activeFiltersCount = countActiveFilters(filters);
  const hasCustomFilters = activeFiltersCount > 0 || interests.length !== INTEREST_OPTIONS.length;

  return {
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
  };
}

