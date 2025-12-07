import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

// Get environment variables (support both Vite and Node.js)
function getEnvVar(key: string): string {
  if (typeof window !== 'undefined') {
    // Browser: use Vite env vars
    return import.meta.env[key] || '';
  } else {
    // Node.js: use process.env
    return process.env[key] || '';
  }
}

// Server-side client (uses service role key for admin operations)
let supabaseUrl = getEnvVar('SUPABASE_URL') || getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL') || '';
supabaseUrl = supabaseUrl ? getSupabaseUrl(supabaseUrl) : '';
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || '';

// Only create client if we have the required credentials
export const supabase: SupabaseClient | null = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Client-side client (uses anon key for public operations)
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || '';
const supabaseClientUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || '';

export const supabaseClient: SupabaseClient | null = typeof window !== 'undefined' && supabaseClientUrl && supabaseAnonKey
  ? createClient(
      getSupabaseUrl(supabaseClientUrl),
      supabaseAnonKey
    )
  : null;

