export type ZoneKey = "z1" | "z2" | "z3" | "z4" | "z5";

export type HRZoneIntensity = {
  minPct: number;
  maxPct: number;
  label: string;
};

/** Karvonen HRR intensity bands — single source of truth for zone percentages */
export const HRR_INTENSITY: Record<ZoneKey, HRZoneIntensity> = {
  z1: { minPct: 0.5, maxPct: 0.6, label: "Recovery" },
  z2: { minPct: 0.6, maxPct: 0.7, label: "Easy/Aerobic" },
  z3: { minPct: 0.7, maxPct: 0.8, label: "Moderate" },
  z4: { minPct: 0.8, maxPct: 0.9, label: "Threshold" },
  z5: { minPct: 0.9, maxPct: 1.0, label: "VO2max/Anaerobic" },
};

export type ComputedHRZone = {
  key: ZoneKey;
  min: number;
  max: number;
  label: string;
};

export function computeHRZones(
  hrMax: number,
  hrRest: number
): ComputedHRZone[] {
  const hrr = hrMax - hrRest;

  return (Object.keys(HRR_INTENSITY) as ZoneKey[]).map((key) => {
    const { minPct, maxPct, label } = HRR_INTENSITY[key];
    return {
      key,
      min: Math.round(hrRest + hrr * minPct),
      max: Math.round(hrRest + hrr * maxPct),
      label,
    };
  });
}

export function formatZoneRange(zone: ComputedHRZone): string {
  return `Z${zone.key.slice(1)} (${zone.min}–${zone.max} bpm)`;
}

export function formatZoneShort(zone: ComputedHRZone): string {
  return `Z${zone.key.slice(1)} ${zone.min}–${zone.max}`;
}

export function getZoneForHR(
  hr: number,
  hrMax: number,
  hrRest: number
): ComputedHRZone | null {
  if (!hrMax || !hrRest) return null;
  const zones = computeHRZones(hrMax, hrRest);
  return (
    zones.find((z) => hr >= z.min && hr <= z.max) ??
    zones.find((z) => hr < z.min) ??
    zones[zones.length - 1]
  );
}

export function parseHRZoneText(text: string | null): ZoneKey | null {
  if (!text || text === "-") return null;
  const match = text.match(/z?(\d)/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (n < 1 || n > 5) return null;
  return `z${n}` as ZoneKey;
}

/** Chart / tag colors per zone */
export const ZONE_COLORS: Record<ZoneKey, string> = {
  z1: "#60A5FA",
  z2: "#34D399",
  z3: "#FBBF24",
  z4: "#FB923C",
  z5: "#F87171",
};
