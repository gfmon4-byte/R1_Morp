/**
 * HR Zone calculation using the Karvonen formula.
 * This is the ONLY place HR zone logic should live.
 *
 * Zones based on % HRR (Heart Rate Reserve):
 *   Z1: 50–60% HRR  — Recovery
 *   Z2: 60–70% HRR  — Aerobic Base
 *   Z3: 70–80% HRR  — Tempo / Aerobic Power
 *   Z4: 80–90% HRR  — Threshold
 *   Z5: 90–100% HRR — VO2max / Neuromuscular
 */

export interface HRZone {
  zone: number;
  label: string;
  description: string;
  minBpm: number;
  maxBpm: number;
  color: string;
}

const ZONE_BANDS = [
  { zone: 1, label: 'Z1', description: 'Recovery',        minPct: 0.50, maxPct: 0.60, color: '#6EE7B7' },
  { zone: 2, label: 'Z2', description: 'Aerobic Base',    minPct: 0.60, maxPct: 0.70, color: '#34D399' },
  { zone: 3, label: 'Z3', description: 'Tempo',           minPct: 0.70, maxPct: 0.80, color: '#FBBF24' },
  { zone: 4, label: 'Z4', description: 'Threshold',       minPct: 0.80, maxPct: 0.90, color: '#F97316' },
  { zone: 5, label: 'Z5', description: 'VO2max',          minPct: 0.90, maxPct: 1.00, color: '#EF4444' },
] as const;

/**
 * Compute all 5 HR zones from hr_max and hr_rest using Karvonen formula.
 * HRR = hr_max - hr_rest
 * Target HR = (HRR × intensity%) + hr_rest
 */
export function computeHRZones(hrMax: number, hrRest: number): HRZone[] {
  const hrr = hrMax - hrRest;
  return ZONE_BANDS.map((band) => ({
    zone: band.zone,
    label: band.label,
    description: band.description,
    minBpm: Math.round(hrr * band.minPct + hrRest),
    maxBpm: band.zone === 5 ? hrMax : Math.round(hrr * band.maxPct + hrRest),
    color: band.color,
  }));
}

/**
 * Get the HR zone number for a given heart rate.
 * Returns null if HR is below zone 1 minimum.
 */
export function getHRZoneForBpm(bpm: number, hrMax: number, hrRest: number): number | null {
  const zones = computeHRZones(hrMax, hrRest);
  for (let i = zones.length - 1; i >= 0; i--) {
    if (bpm >= zones[i].minBpm) return zones[i].zone;
  }
  return null;
}
