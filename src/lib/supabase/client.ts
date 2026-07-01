import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./config";

let serverClient: SupabaseClient | null = null;

export { isSupabaseConfigured, getSupabaseSetupMessage, formatSupabaseError } from "./config";

export function createServerSupabase(): SupabaseClient {
  if (serverClient) return serverClient;

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Edit .env.local with your real project URL and API keys."
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  serverClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serverClient;
}

export function createBrowserSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }

  return createClient(url, key);
}
