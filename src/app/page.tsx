import { AppShell } from "@/components/layout/AppShell";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import {
  SupabaseError,
  SupabaseNotConfigured,
  requireSupabase,
} from "@/components/layout/SupabaseGuard";
import { getActivities, getProfile } from "@/lib/actions/data";

export default async function DashboardPage() {
  if (!requireSupabase()) return <SupabaseNotConfigured />;

  try {
    const [activities, profile] = await Promise.all([
      getActivities(),
      getProfile(),
    ]);

    return (
      <AppShell>
        <DashboardClient activities={activities} profile={profile} />
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
