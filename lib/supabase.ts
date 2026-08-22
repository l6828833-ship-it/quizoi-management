import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/**
 * Returns the browser-safe Supabase client when the public Fly build values
 * are present. The publishable key is safe in the client because database
 * access is protected by Supabase Auth and Row Level Security policies.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    client = null;
    return client;
  }

  client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}

export const quizioOwnerEmail = process.env.EXPO_PUBLIC_QUIZIO_OWNER_EMAIL?.toLowerCase() ?? "";
