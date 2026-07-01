import { AppShell } from "@/components/layout/AppShell";
import { ProfileClient } from "@/components/profile/ProfileClient";
import {
  SupabaseError,
  SupabaseNotConfigured,
  requireSupabase,
} from "@/components/layout/SupabaseGuard";
import { getProfile } from "@/lib/actions/data";

export default async function ProfilePage() {
  if (!requireSupabase()) return <SupabaseNotConfigured />;

  try {
    const profile = await getProfile();
    return (
      <AppShell>
        <ProfileClient profile={profile} />
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
