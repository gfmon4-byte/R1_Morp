import { AppShell } from "@/components/layout/AppShell";
import { RunsClient } from "@/components/runs/RunsClient";
import {
  SupabaseError,
  SupabaseNotConfigured,
  requireSupabase,
} from "@/components/layout/SupabaseGuard";
import { getActivities, getProfile } from "@/lib/actions/data";

type SearchParams = Promise<{ prefill?: string }>;

export default async function RunsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!requireSupabase()) return <SupabaseNotConfigured />;

  const params = await searchParams;
  let prefill = null;
  if (params.prefill) {
    try {
      prefill = JSON.parse(decodeURIComponent(params.prefill));
    } catch {
      prefill = null;
    }
  }

  try {
    const [activities, profile] = await Promise.all([
      getActivities(),
      getProfile(),
    ]);

    return (
      <AppShell>
        <RunsClient activities={activities} profile={profile} prefill={prefill} />
      </AppShell>
    );
  } catch (e) {
    return (
      <SupabaseError
        message={
          e instanceof Error ? e.message : "Check your Supabase connection."
        }
      />
    );
  }
}
