import { AppShell } from "@/components/layout/AppShell";
import { TrainingPlanClient } from "@/components/training/TrainingPlanClient";
import {
  SupabaseError,
  SupabaseNotConfigured,
  requireSupabase,
} from "@/components/layout/SupabaseGuard";
import { getTrainingPlan, getProfile } from "@/lib/actions/data";

export default async function TrainingPlanPage() {
  if (!requireSupabase()) return <SupabaseNotConfigured />;

  try {
    const [entries, profile] = await Promise.all([
      getTrainingPlan(),
      getProfile(),
    ]);

    return (
      <AppShell>
        <TrainingPlanClient entries={entries} profile={profile} />
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
