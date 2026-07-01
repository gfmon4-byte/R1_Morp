"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, formatSupabaseError } from "@/lib/supabase/client";
import type { Activity, HRZoneBreakdown, Profile, TrainingPlanEntry } from "@/lib/types";

function db() {
  return createServerSupabase();
}

export async function getProfile(): Promise<Profile | null> {
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  return data as Profile | null;
}

export async function upsertProfile(
  profile: Omit<Profile, "id" | "updated_at"> & { id?: string }
): Promise<Profile> {
  const existing = await getProfile();
  const payload = {
    ...profile,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await db()
      .from("profiles")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(formatSupabaseError(error));
    revalidatePath("/", "layout");
    return data as Profile;
  }

  const { data, error } = await db()
    .from("profiles")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  revalidatePath("/", "layout");
  return data as Profile;
}

export async function getActivities(): Promise<Activity[]> {
  const { data, error } = await db()
    .from("activities")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as Activity[];
}

export async function getActivity(id: string): Promise<Activity | null> {
  const { data, error } = await db()
    .from("activities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  return data as Activity | null;
}

export type ActivityInput = {
  date: string;
  session_type: string;
  distance_km: number | null;
  duration_seconds: number;
  avg_pace_sec_per_km: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  hr_zone_breakdown: HRZoneBreakdown | null;
  elevation_gain_m: number | null;
  rpe: number | null;
  notes: string | null;
  route_name: string | null;
};

export async function createActivity(input: ActivityInput): Promise<Activity> {
  const { data, error } = await db()
    .from("activities")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  revalidatePath("/", "layout");
  return data as Activity;
}

export async function updateActivity(
  id: string,
  input: ActivityInput
): Promise<Activity> {
  const { data, error } = await db()
    .from("activities")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  revalidatePath("/", "layout");
  return data as Activity;
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await db().from("activities").delete().eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
  revalidatePath("/", "layout");
}

export async function getTrainingPlan(): Promise<TrainingPlanEntry[]> {
  const { data, error } = await db()
    .from("training_plan")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as TrainingPlanEntry[];
}

export type TrainingPlanInput = {
  date: string;
  day_of_week: string | null;
  phase: string | null;
  session_type: string;
  description: string | null;
  distance_km: number | null;
  pace_target: string | null;
  hr_zone: string | null;
  rpe: number | null;
  notes: string | null;
  completed: boolean;
};

export async function upsertTrainingPlanRows(
  rows: TrainingPlanInput[]
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const { data: existing } = await db()
      .from("training_plan")
      .select("id")
      .eq("date", row.date)
      .maybeSingle();

    if (existing) {
      const { error } = await db()
        .from("training_plan")
        .update(row)
        .eq("date", row.date);
      if (error) throw new Error(formatSupabaseError(error));
      updated++;
    } else {
      const { error } = await db().from("training_plan").insert(row);
      if (error) throw new Error(formatSupabaseError(error));
      inserted++;
    }
  }

  revalidatePath("/", "layout");
  return { inserted, updated };
}

export async function toggleTrainingPlanCompleted(
  id: string,
  completed: boolean
): Promise<void> {
  const { error } = await db()
    .from("training_plan")
    .update({ completed })
    .eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
  revalidatePath("/", "layout");
}

export async function linkTrainingPlanActivity(
  planId: string,
  activityId: string
): Promise<void> {
  const { error } = await db()
    .from("training_plan")
    .update({ linked_activity_id: activityId, completed: true })
    .eq("id", planId);
  if (error) throw new Error(formatSupabaseError(error));
  revalidatePath("/", "layout");
}
