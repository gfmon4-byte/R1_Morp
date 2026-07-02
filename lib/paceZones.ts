/**
 * Pace Zone calculation.
 * This is the ONLY place pace zone logic should live.
 *
 * Auto mode: derives threshold pace from PB 10k/half using standard % model.
 *   Threshold pace ≈ avg pace from best 1-hour effort
 *   Model: VT2 pace = 10k_pace × 1.05 (approximate)
 *
 * Manual mode: reads raw min/max text strings per zone from profile.
 */

export interface PaceZone {
  zone: number;
  label: string;
  description: string;
  minPace: string; // "MM:SS/km"
  maxPace: string; // "MM:SS/km"
  color: string;
}

export interface ManualPaceZoneInput {
  zone1Min?: string | null; zone1Max?: string | null;
  zone2Min?: string | null; zone2Max?: string | null;
  zone3Min?: string | null; zone3Max?: string | null;
  zone4Min?: string | null; zone4Max?: string | null;
  zone5Min?: string | null; zone5Max?: string | null;
}

const ZONE_META = [
  { zone: 1, label: 'Z1', description: 'Recovery',      color: '#6EE7B7' },
  { zone: 2, label: 'Z2', description: 'Aerobic Base',  color: '#34D399' },
  { zone: 3, label: 'Z3', description: 'Tempo',         color: '#FBBF24' },
  { zone: 4, label: 'Z4', description: 'Threshold',     color: '#F97316' },
  { zone: 5, label: 'Z5', description: 'VO2max',        color: '#EF4444' },
];

/** Seconds per km → "MM:SS/km" */
function secPerKmToString(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}/km`;
}

/**
 * Auto-compute pace zones from PB times (seconds).
 * Uses standard % model:
 *   Z1 Recovery:     VT1 × 1.20–1.30
 *   Z2 Aerobic:      VT1 × 1.05–1.20
 *   Z3 Tempo:        VT1 × 0.97–1.05
 *   Z4 Threshold:    VT1 × 0.90–0.97
 *   Z5 VO2max:       5k_pace × 0.95–1.00
 *
 * VT1 pace estimated from 10k pace × 1.10
 */
export function computeAutoPaceZones(pb10kSeconds: number | null, pbHalfSeconds: number | null): PaceZone[] {
  // Use best available reference: half > 10k
  let thresholdPaceSec: number;
  if (pbHalfSeconds && pbHalfSeconds > 0) {
    // half pace in sec/km × 0.97 ≈ threshold
    const halfPace = pbHalfSeconds / 21.0975;
    thresholdPaceSec = halfPace * 0.97;
  } else if (pb10kSeconds && pb10kSeconds > 0) {
    const tenKPace = pb10kSeconds / 10;
    thresholdPaceSec = tenKPace * 1.05;
  } else {
    // Fallback defaults for ~40min 10k runner
    thresholdPaceSec = 240; // 4:00/km
  }

  const vt1Pace = thresholdPaceSec * 1.08; // VT1 slightly slower than VT2

  const bands = [
    { min: vt1Pace * 1.20, max: vt1Pace * 1.35 },  // Z1 Recovery
    { min: vt1Pace * 1.05, max: vt1Pace * 1.20 },  // Z2 Aerobic
    { min: vt1Pace * 0.97, max: vt1Pace * 1.05 },  // Z3 Tempo
    { min: thresholdPaceSec * 0.95, max: thresholdPaceSec * 1.02 }, // Z4 Threshold
    { min: thresholdPaceSec * 0.88, max: thresholdPaceSec * 0.95 }, // Z5 VO2max
  ];

  return ZONE_META.map((meta, i) => ({
    ...meta,
    minPace: secPerKmToString(bands[i].min),
    maxPace: secPerKmToString(bands[i].max),
  }));
}

/**
 * Return manual pace zones from profile text fields.
 * Falls back to auto if a field is missing.
 */
export function computeManualPaceZones(manual: ManualPaceZoneInput): PaceZone[] {
  const pairs = [
    { min: manual.zone1Min, max: manual.zone1Max },
    { min: manual.zone2Min, max: manual.zone2Max },
    { min: manual.zone3Min, max: manual.zone3Max },
    { min: manual.zone4Min, max: manual.zone4Max },
    { min: manual.zone5Min, max: manual.zone5Max },
  ];
  return ZONE_META.map((meta, i) => ({
    ...meta,
    minPace: pairs[i].min || '—',
    maxPace: pairs[i].max || '—',
  }));
}
