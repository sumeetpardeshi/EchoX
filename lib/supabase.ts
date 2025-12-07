import { createClient } from '@supabase/supabase-js';

// Helper to convert MCP URL to proper Supabase URL
function getSupabaseUrl(url: string): string {
  if (url.includes('mcp.supabase.com')) {
    const projectRefMatch = url.match(/project_ref=([^&]+)/);
    if (projectRefMatch) {
      return `https://${projectRefMatch[1]}.supabase.co`;
    }
  }
  return url;
}

// Server-side client (uses service role key for admin operations)
let supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
supabaseUrl = supabaseUrl ? getSupabaseUrl(supabaseUrl) : '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Only create client if we have the required credentials
export const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null as any; // Will throw error if used without credentials

// Client-side client (uses anon key for public operations)
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabaseClient = typeof window !== 'undefined' 
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey
    )
  : null;

