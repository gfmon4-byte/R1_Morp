/** Parse pace string like "6:45" or "1:06:30" to seconds per km */
export function parsePaceToSeconds(pace: string): number | null {
  const trimmed = pace.trim().replace(/\/km$/i, "");
  const parts = trimmed.split(":").map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

/** Format seconds per km as MM:SS/km */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || secPerKm <= 0) return "—";
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
}

/** Format duration in seconds as HH:MM:SS or MM:SS */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Parse HH:MM:SS or MM:SS to total seconds */
export function parseDurationToSeconds(input: string): number | null {
  const parts = input.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/** Compute pace from distance (km) and duration (seconds) */
export function computePaceSecPerKm(
  distanceKm: number,
  durationSeconds: number
): number | null {
  if (!distanceKm || distanceKm <= 0 || !durationSeconds) return null;
  return Math.round(durationSeconds / distanceKm);
}

/** Format PB time and show pace/km for a given distance */
export function pbPaceEquivalent(
  pbTime: string | null,
  distanceKm: number
): string | null {
  if (!pbTime) return null;
  const seconds = parseDurationToSeconds(pbTime);
  if (!seconds) return null;
  const pace = computePaceSecPerKm(distanceKm, seconds);
  return pace ? formatPace(pace) : null;
}

/** Weighted average pace across runs */
export function weightedAvgPace(
  activities: { distance_km: number | null; avg_pace_sec_per_km: number | null; duration_seconds: number }[]
): number | null {
  let totalDist = 0;
  let weightedSum = 0;

  for (const a of activities) {
    const dist = a.distance_km ?? 0;
    let pace = a.avg_pace_sec_per_km;
    if (!pace && dist > 0 && a.duration_seconds) {
      pace = computePaceSecPerKm(dist, a.duration_seconds);
    }
    if (dist > 0 && pace) {
      totalDist += dist;
      weightedSum += pace * dist;
    }
  }

  return totalDist > 0 ? Math.round(weightedSum / totalDist) : null;
}
