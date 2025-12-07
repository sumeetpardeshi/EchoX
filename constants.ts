import { Category } from './types';

// Categories for topic filtering
export const CATEGORIES: Category[] = [
  { id: '1', name: 'Technology', color: 'bg-blue-600' },
  { id: '2', name: 'Politics', color: 'bg-red-600' },
  { id: '3', name: 'Crypto', color: 'bg-yellow-600' },
  { id: '4', name: 'Sports', color: 'bg-green-600' },
  { id: '5', name: 'Entertainment', color: 'bg-purple-600' },
  { id: '6', name: 'Science', color: 'bg-indigo-600' },
  { id: '7', name: 'Business', color: 'bg-gray-600' },
  { id: '8', name: 'Art & Design', color: 'bg-pink-600' },
];

export const SYSTEM_PROMPT_SUMMARY = `
You are an expert editor for a "TikTok for Audio" app. 
Your goal is to summarize X (Twitter) posts into engaging, conversational scripts for Text-to-Speech.
Keep it under 30 words.
Make it sound like a news anchor or a podcaster giving a quick update.
Start directly with the core message.
`;