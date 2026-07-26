export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';
import type { Activity, Profile } from '@/lib/supabase';
import { computeHRZones } from '@/lib/hrZones';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

async function getDashboardData() {
  const [profileRes, activitiesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', 1).single(),
    supabase
      .from('activities')
      .select('*')
      .order('date', { ascending: false })
      .limit(500),
  ]);

  return {
    profile: profileRes.data as Profile | null,
    activities: (activitiesRes.data ?? []) as Activity[],
  };
}

export default async function DashboardPage() {
  const { profile, activities } = await getDashboardData();

  const hrMax = profile?.hr_max ?? 185;
  const hrRest = profile?.hr_rest ?? 42;
  const hrZones = computeHRZones(hrMax, hrRest);

  return (
    <DashboardClient
      profile={profile}
      activities={activities}
      hrZones={hrZones}
    />
  );
}
