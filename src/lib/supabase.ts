import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Connected Supabase Project Configuration
 * Verified project containing the 7 CipherID public tables:
 * profiles, conversations, conversation_participants, messages, blocks, reports, notifications
 */
const CONNECTED_SUPABASE_URL = 'https://pcjyhwwnamnlevaxuypu.supabase.co';
const CONNECTED_SUPABASE_ANON_KEY = 'sb_publishable_NhXavvoUzDyuumxLlP054g_OLoMREra';

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

const isPlaceholderOrStale = (val: string) =>
  !val ||
  val === 'https://your-project-ref.supabase.co' ||
  val === 'your-public-anon-key' ||
  val.includes('YOUR_SUPABASE') ||
  // Guard against stale container environment variable pointing to an old project ref
  val.includes('jkubmddvuhxzoixlsgkw');

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  isConfigured: boolean;
} {
  const useEnv = !isPlaceholderOrStale(envUrl) && !isPlaceholderOrStale(envAnonKey);
  const url = useEnv ? envUrl : CONNECTED_SUPABASE_URL;
  const anonKey = useEnv ? envAnonKey : CONNECTED_SUPABASE_ANON_KEY;
  const isConfigured = Boolean(url && anonKey && url.startsWith('http'));
  return { url, anonKey, isConfigured };
}

const config = getSupabaseConfig();

export const supabase: SupabaseClient = createClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'cipherid_supabase_auth_pcjyhwwnamnlevaxuypu',
  },
});

export const isSupabaseConfigured = config.isConfigured;
export const activeSupabaseUrl = config.url;
