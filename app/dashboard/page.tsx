export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';
import type { Activity, Profile, ActivityDetail } from '@/lib/supabase';
import { computeHRZones } from '@/lib/hrZones';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

async function getDashboardData() {
  const [userProfileRes, profileRes, activitiesRes, activityDetailsRes] = await Promise.all([
    supabase.from('user_profile').select('*').eq('id', 1).maybeSingle(),
    supabase.from('profiles').select('*').eq('id', 1).maybeSingle(),
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

  // Combine profile prioritizing user_profile table (Moph)
  const baseProfile = profileRes.data || {};
  const userProfile = userProfileRes.data || {};
  const mergedProfile = (userProfile.name || baseProfile.name)
    ? ({ ...baseProfile, ...userProfile } as Profile)
    : null;

  return {
    profile: mergedProfile,
    activities: (activitiesRes.data ?? []) as Activity[],
    activityDetails: (activityDetailsRes.data ?? []) as ActivityDetail[],
  };
}

export default async function DashboardPage() {
  const { profile, activities, activityDetails } = await getDashboardData();

  const hrMax = profile?.hr_max ?? 199;
  const hrRest = profile?.hr_rest ?? 65;
  const hrZones = computeHRZones(hrMax, hrRest, profile);

  return (
    <DashboardClient
      profile={profile}
      activities={activities}
      activityDetails={activityDetails}
      hrZones={hrZones}
    />
  );
}
