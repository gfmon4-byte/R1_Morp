/**
 * HR Zone calculation and Garmin sync helper.
 * Prioritizes actual Garmin-synced Running Heart Rate Zones.
 * Falls back to Karvonen formula using hr_max and hr_rest when Garmin data is not present or invalid.
 */

export interface HRZone {
  zone: number;
  label: string;
  description: string;
  minBpm: number;
  maxBpm: number;
  color: string;
}

export const DEFAULT_GARMIN_HR_ZONES = {
  z1: { min: 97, max: 115, name: 'Warm Up (Zone 1)', label: 'Z1' },
  z2: { min: 116, max: 144, name: 'Easy / Fat Burn (Zone 2)', label: 'Z2' },
  z3: { min: 145, max: 157, name: 'Aerobic (Zone 3)', label: 'Z3' },
  z4: { min: 158, max: 173, name: 'Threshold (Zone 4)', label: 'Z4' },
  z5: { min: 174, max: 199, name: 'Maximum (Zone 5)', label: 'Z5' },
};

const ZONE_BANDS = [
  { zone: 1, label: 'Z1', description: 'Warm Up',         minPct: 0.50, maxPct: 0.60, color: '#6EE7B7' },
  { zone: 2, label: 'Z2', description: 'Easy / Fat Burn', minPct: 0.60, maxPct: 0.70, color: '#34D399' },
  { zone: 3, label: 'Z3', description: 'Aerobic',         minPct: 0.70, maxPct: 0.80, color: '#FBBF24' },
  { zone: 4, label: 'Z4', description: 'Threshold',       minPct: 0.80, maxPct: 0.90, color: '#F97316' },
  { zone: 5, label: 'Z5', description: 'Maximum',         minPct: 0.90, maxPct: 1.00, color: '#EF4444' },
] as const;

/**
 * Extract Garmin HR zones from profile or custom object.
 * Validates that Zone 2 min is at least 100 bpm (running zone, not resting/wellness).
 */
export function extractGarminZones(profileOrZones?: any): Record<string, any> | null {
  if (!profileOrZones) return null;
  const target =
    profileOrZones.fitness_age_data?.garmin_hr_zones ||
    profileOrZones.fitness_age_data?.hr_zones ||
    profileOrZones.garmin_hr_zones ||
    profileOrZones.hr_zones ||
    profileOrZones;

  if (target && typeof target === 'object') {
    if (target.z1 && target.z2 && target.z3 && target.z4 && target.z5) {
      // Validate that Z2 is a plausible running zone (>= 100 bpm)
      const z2Min = Number(target.z2.min);
      if (z2Min >= 100) {
        return target;
      }
    }
  }
  return null;
}

/**
 * Compute all 5 HR zones:
 * 1. If valid Garmin Running HR zones exist in profile, use Garmin's exact thresholds.
 * 2. Otherwise, fall back to default Garmin Venu 3 activity HR zones (Option 3).
 */
export function computeHRZones(
  hrMax: number = 199,
  hrRest: number = 63,
  profileOrZones?: any
): HRZone[] {
  const gZones = extractGarminZones(profileOrZones) || DEFAULT_GARMIN_HR_ZONES;
  return [
    {
      zone: 1,
      label: 'Z1',
      description: gZones.z1.name?.replace(/\s*\(Zone\s*\d+\)/i, '') || 'Warm Up',
      minBpm: Number(gZones.z1.min),
      maxBpm: Number(gZones.z1.max),
      color: '#6EE7B7',
    },
    {
      zone: 2,
      label: 'Z2',
      description: gZones.z2.name?.replace(/\s*\(Zone\s*\d+\)/i, '') || 'Easy / Fat Burn',
      minBpm: Number(gZones.z2.min),
      maxBpm: Number(gZones.z2.max),
      color: '#34D399',
    },
    {
      zone: 3,
      label: 'Z3',
      description: gZones.z3.name?.replace(/\s*\(Zone\s*\d+\)/i, '') || 'Aerobic',
      minBpm: Number(gZones.z3.min),
      maxBpm: Number(gZones.z3.max),
      color: '#FBBF24',
    },
    {
      zone: 4,
      label: 'Z4',
      description: gZones.z4.name?.replace(/\s*\(Zone\s*\d+\)/i, '') || 'Threshold',
      minBpm: Number(gZones.z4.min),
      maxBpm: Number(gZones.z4.max),
      color: '#F97316',
    },
    {
      zone: 5,
      label: 'Z5',
      description: gZones.z5.name?.replace(/\s*\(Zone\s*\d+\)/i, '') || 'Maximum',
      minBpm: Number(gZones.z5.min),
      maxBpm: Number(gZones.z5.max || hrMax),
      color: '#EF4444',
    },
  ];
}

/**
 * Get the HR zone number for a given heart rate.
 * Returns null if HR is below zone 1 minimum.
 */
export function getHRZoneForBpm(
  bpm: number,
  hrMax: number = 199,
  hrRest: number = 65,
  profileOrZones?: any
): number | null {
  const zones = computeHRZones(hrMax, hrRest, profileOrZones);
  for (let i = zones.length - 1; i >= 0; i--) {
    if (bpm >= zones[i].minBpm) return zones[i].zone;
  }
  return null;
}
