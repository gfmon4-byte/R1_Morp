export const RUNNING_SESSION_TYPES = [
  "Easy Run",
  "Long Run",
  "Intervals",
  "Tempo",
  "Recovery Run",
  "Race",
] as const;

export const ALL_SESSION_TYPES = [
  "Easy Run",
  "Long Run",
  "Intervals",
  "Tempo",
  "Recovery Run",
  "Strength A",
  "Strength B",
  "Mobility",
  "Rest",
  "Race",
] as const;

export const TRAINING_PHASES = ["Base", "Build", "Peak", "Taper", "Race"] as const;

export type SessionType = (typeof ALL_SESSION_TYPES)[number];

/** Normalize session type for case-insensitive comparison */
export function normalizeSessionType(type: string): string {
  const lower = type.toLowerCase().trim();
  const match = ALL_SESSION_TYPES.find((t) => t.toLowerCase() === lower);
  return match ?? type;
}

export function isRunningSession(type: string): boolean {
  return RUNNING_SESSION_TYPES.some(
    (t) => t.toLowerCase() === type.toLowerCase()
  );
}

/** Color tags per session type for training plan / calendar */
export const SESSION_TYPE_COLORS: Record<string, string> = {
  "Easy Run": "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  "Long Run": "bg-blue-500/20 text-blue-300 border-blue-500/40",
  Intervals: "bg-red-500/20 text-red-300 border-red-500/40",
  Tempo: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  "Recovery Run": "bg-teal-500/20 text-teal-300 border-teal-500/40",
  "Strength A": "bg-purple-500/20 text-purple-300 border-purple-500/40",
  "Strength B": "bg-violet-500/20 text-violet-300 border-violet-500/40",
  Mobility: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  Rest: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
  Race: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

export const PHASE_COLORS: Record<string, string> = {
  Base: "border-l-blue-500",
  Build: "border-l-orange-500",
  Peak: "border-l-red-500",
  Taper: "border-l-emerald-500",
  Race: "border-l-amber-500",
};

export function getSessionTypeColor(type: string): string {
  const normalized = normalizeSessionType(type);
  return (
    SESSION_TYPE_COLORS[normalized] ??
    "bg-zinc-500/20 text-zinc-300 border-zinc-500/40"
  );
}

export function getPhaseColor(phase: string | null): string {
  if (!phase) return "border-l-zinc-600";
  return PHASE_COLORS[phase] ?? "border-l-zinc-600";
}
