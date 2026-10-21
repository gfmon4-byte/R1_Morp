export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';
import type { Activity, Profile, ActivityDetail } from '@/lib/supabase';
import { computeHRZones } from '@/lib/hrZones';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

async function getDashboardData() {
  const [profileRes, activitiesRes, activityDetailsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', 1).single(),
    supabase
      .from('activities')
      .select('*')
      .order('date', { ascending: false })
      .limit(500),
    supabase
      .from('activity_details')
      .select('activity_id, session_date, details')
      .order('session_date', { ascending: false })
      .limit(500),
  ]);

  return {
    profile: profileRes.data as Profile | null,
    activities: (activitiesRes.data ?? []) as Activity[],
    activityDetails: (activityDetailsRes.data ?? []) as ActivityDetail[],
  };
}

export default async function DashboardPage() {
  const { profile, activities, activityDetails } = await getDashboardData();

  const hrMax = profile?.hr_max ?? 185;
  const hrRest = profile?.hr_rest ?? 42;
  const hrZones = computeHRZones(hrMax, hrRest);

  return (
    <DashboardClient
      profile={profile}
      activities={activities}
      activityDetails={activityDetails}
      hrZones={hrZones}
    />
  );
}

