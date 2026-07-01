const PLACEHOLDER_MARKERS = [
  "your-project",
  "your-anon-key",
  "your-service-role-key",
  "xxxxxxxx",
];

function isRealValue(value: string | undefined): boolean {
  if (!value || value.trim().length < 10) return false;
  const lower = value.toLowerCase();
  return !PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return isRealValue(url) && isRealValue(key);
}

export function getSupabaseSetupMessage(): string {
  if (!isSupabaseConfigured()) {
    return "Edit .env.local with your real Supabase URL and API keys from Project Settings → API, then restart the dev server.";
  }
  return "";
}

export function formatSupabaseError(error: { message: string }): string {
  const msg = error.message;

  if (msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
    return "Cannot connect to Supabase. Check NEXT_PUBLIC_SUPABASE_URL in .env.local (must be your real project URL, e.g. https://abcdefgh.supabase.co).";
  }
  if (msg.includes("Invalid API key") || msg.includes("JWT")) {
    return "Invalid API key. Check SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.";
  }
  if (msg.includes("does not exist") && msg.includes("relation")) {
    return "Database tables not found. Run supabase/migrations/001_initial_schema.sql in the Supabase SQL Editor.";
  }
  if (msg.includes("column") && msg.includes("does not exist")) {
    return "Database schema mismatch (legacy dr tables detected). Open Supabase → SQL Editor, run supabase/migrations/002_migrate_legacy_to_dr2.sql, then refresh this page. Old data is kept in *_legacy tables.";
  }
  if (
    msg.includes("Could not find the table") ||
    msg.includes("PGRST205") ||
    msg.includes("schema cache")
  ) {
    return "Database tables not found. Open Supabase → SQL Editor, run supabase/migrations/002_migrate_legacy_to_dr2.sql (or 001_initial_schema.sql for a fresh project), then refresh this page.";
  }

  return msg;
}
