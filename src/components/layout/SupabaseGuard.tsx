import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/Badge";
import {
  getSupabaseSetupMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export function SupabaseNotConfigured() {
  return (
    <AppShell>
      <EmptyState
        title="Supabase not configured"
        description={
          getSupabaseSetupMessage() ||
          "Edit .env.local with your Supabase credentials, then restart the dev server."
        }
      />
    </AppShell>
  );
}

export function SupabaseError({ message }: { message: string }) {
  const isMigration =
    message.includes("Database tables not found") ||
    message.includes("Database schema mismatch") ||
    message.includes("001_initial_schema") ||
    message.includes("002_migrate_legacy_to_dr2");
  return (
    <AppShell>
      <EmptyState
        title={isMigration ? "Database not set up" : "Connection error"}
        description={message}
      />
    </AppShell>
  );
}

export function requireSupabase() {
  return isSupabaseConfigured();
}
