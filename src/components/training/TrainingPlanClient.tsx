"use client";

import { useMemo, useState, useCallback } from "react";
import Papa from "papaparse";
import { Upload, Check, Calendar, List, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/Badge";
import type { Profile, TrainingPlanEntry } from "@/lib/types";
import {
  upsertTrainingPlanRows,
  toggleTrainingPlanCompleted,
  type TrainingPlanInput,
} from "@/lib/actions/data";
import {
  getSessionTypeColor,
  getPhaseColor,
  normalizeSessionType,
} from "@/lib/sessionTypes";
import { formatDate, formatDateShort } from "@/lib/dates";
import { computeHRZones, parseHRZoneText } from "@/lib/hrZones";
import { cn } from "@/lib/utils";
import Link from "next/link";

type ParsedRow = TrainingPlanInput & { _error?: string };

type CsvRow = Record<string, string>;

function nullIfDash(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "-") return null;
  return trimmed;
}

/** Strip UTF-8 BOM from Excel-exported CSV headers */
function normalizeCsvRow(row: CsvRow): CsvRow {
  const out: CsvRow = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/^\ufeff/, "").trim()] = value;
  }
  return out;
}

const CSV_COLUMNS = [
  "date",
  "day_of_week",
  "phase",
  "session_type",
  "description",
  "distance_km",
  "pace_target",
  "hr_zone",
  "rpe",
  "notes",
];

function parseCsvRow(row: CsvRow, index: number): ParsedRow {
  const date = row.date?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      date: date ?? "",
      day_of_week: null,
      phase: null,
      session_type: "",
      description: null,
      distance_km: null,
      pace_target: null,
      hr_zone: null,
      rpe: null,
      notes: null,
      completed: false,
      _error: `Row ${index + 1}: invalid date "${date}"`,
    };
  }

  const rpeRaw = row.rpe?.trim();
  let rpe: number | null = null;
  if (rpeRaw && rpeRaw !== "-") {
    const n = parseInt(rpeRaw, 10);
    rpe = isNaN(n) ? null : n;
  }

  const distRaw = row.distance_km?.trim();
  const distance_km = distRaw && distRaw !== "-" ? parseFloat(distRaw) : null;

  return {
    date,
    day_of_week: nullIfDash(row.day_of_week),
    phase: nullIfDash(row.phase),
    session_type: normalizeSessionType(row.session_type?.trim() ?? "Rest"),
    description: nullIfDash(row.description),
    distance_km: distance_km != null && !isNaN(distance_km) ? distance_km : null,
    pace_target: nullIfDash(row.pace_target),
    hr_zone: nullIfDash(row.hr_zone),
    rpe,
    notes: nullIfDash(row.notes),
    completed: false,
  };
}

export function TrainingPlanClient({
  entries: initial,
  profile,
}: {
  entries: TrainingPlanEntry[];
  profile: Profile | null;
}) {
  const [entries, setEntries] = useState(initial);
  const [view, setView] = useState<"agenda" | "calendar">("agenda");
  const [selected, setSelected] = useState<TrainingPlanEntry | null>(null);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const zones =
    profile?.hr_max && profile?.hr_rest
      ? computeHRZones(profile.hr_max, profile.hr_rest)
      : null;

  const groupedByDate = useMemo(() => {
    const map = new Map<string, TrainingPlanEntry>();
    entries.forEach((e) => map.set(e.date, e));
    return map;
  }, [entries]);

  const currentMonth = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, []);

  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7;
    const days: (TrainingPlanEntry | null)[] = [];

    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push(groupedByDate.get(dateStr) ?? null);
    }
    return days;
  }, [currentMonth, groupedByDate]);

  const handleFile = useCallback((file: File) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = [];
        const rows = results.data.map((row, i) => {
          const parsed = parseCsvRow(normalizeCsvRow(row), i);
          if (parsed._error) errors.push(parsed._error);
          return parsed;
        });
        if (results.errors.length) {
          results.errors.forEach((e) =>
            errors.push(`Parse error row ${e.row}: ${e.message}`)
          );
        }
        setImportErrors(errors);
        setPreview(rows);
      },
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.includes("csv") || file?.name.endsWith(".csv")) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const confirmImport = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const valid = preview.filter((r) => !r._error && r.date);
      const payload: TrainingPlanInput[] = valid.map(
        ({ _error: _, ...rest }) => rest
      );
      await upsertTrainingPlanRows(payload);
      setEntries((prev) => {
        const map = new Map(prev.map((e) => [e.date, e]));
        valid.forEach((r) => {
          const existing = map.get(r.date);
          map.set(r.date, {
            id: existing?.id ?? crypto.randomUUID(),
            ...r,
            linked_activity_id: existing?.linked_activity_id ?? null,
            created_at: existing?.created_at ?? new Date().toISOString(),
          } as TrainingPlanEntry);
        });
        return Array.from(map.values()).sort((a, b) =>
          a.date.localeCompare(b.date)
        );
      });
      setPreview(null);
    } catch (e) {
      setImportErrors([
        e instanceof Error ? e.message : "Import failed",
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onToggleComplete = async (entry: TrainingPlanEntry) => {
    const next = !entry.completed;
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, completed: next } : e))
    );
    try {
      await toggleTrainingPlanCompleted(entry.id, next);
    } catch {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, completed: !next } : e
        )
      );
    }
  };

  const logRunUrl = (entry: TrainingPlanEntry) => {
    const prefill = {
      date: entry.date,
      session_type: entry.session_type,
      distance_km: entry.distance_km,
      duration: "0:00",
      rpe: entry.rpe,
      notes: entry.notes,
    };
    return `/runs?prefill=${encodeURIComponent(JSON.stringify(prefill))}`;
  };

  const hrZoneLabel = (hrZone: string | null) => {
    if (!hrZone || hrZone === "-") return "—";
    const key = parseHRZoneText(hrZone);
    if (key && zones) {
      const zone = zones.find((z) => z.key === key);
      if (zone) return `${hrZone.toUpperCase()} · ${zone.min}–${zone.max} bpm`;
    }
    return hrZone;
  };

  return (
    <>
      <PageHeader
        title="Training Plan"
        subtitle="Import CSV and track your schedule"
        action={
          <div className="flex gap-2">
            <Button
              variant={view === "agenda" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setView("agenda")}
            >
              <List className="h-4 w-4" />
              Agenda
            </Button>
            <Button
              variant={view === "calendar" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setView("calendar")}
              className="hidden md:inline-flex"
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Import CSV
        </h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition-colors",
            dragOver ? "border-accent bg-accent/5" : "border-border"
          )}
        >
          <Upload className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted text-center">
            Drag & drop CSV or click to browse
          </p>
          <p className="text-xs text-muted text-center">
            Columns: {CSV_COLUMNS.join(", ")}
          </p>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <span className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface-elevated px-3 text-sm font-medium text-foreground">
              Choose File
            </span>
          </label>
        </div>
      </Card>

      {preview && (
        <Card className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted">
              Import Preview ({preview.length} rows)
            </h2>
            <button type="button" onClick={() => setPreview(null)} aria-label="Close preview">
              <X className="h-5 w-5 text-muted" />
            </button>
          </div>
          {importErrors.length > 0 && (
            <div className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              {importErrors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
          <div className="max-h-64 overflow-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-elevated">
                <tr className="text-left text-muted">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Distance</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.slice(0, 20).map((row, i) => (
                  <tr key={i} className={row._error ? "bg-danger/5" : ""}>
                    <td className="px-3 py-2 font-tabular">{row.date}</td>
                    <td className="px-3 py-2">{row.session_type}</td>
                    <td className="px-3 py-2 font-tabular">{row.distance_km ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row._error ? (
                        <span className="text-danger">{row._error}</span>
                      ) : (
                        <span className="text-success">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 20 && (
              <p className="px-3 py-2 text-xs text-muted">
                + {preview.length - 20} more rows
              </p>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <Button onClick={confirmImport} loading={loading}>
              Confirm Import
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {entries.length === 0 ? (
        <EmptyState
          title="No training plan yet"
          description="Import a CSV to populate your schedule."
        />
      ) : view === "agenda" ? (
        <div className="space-y-2">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelected(entry)}
              className={cn(
                "w-full rounded-2xl border border-border bg-surface-elevated p-4 text-left transition-colors hover:border-muted",
                "border-l-4",
                getPhaseColor(entry.phase),
                entry.completed && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">{formatDateShort(entry.date)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge className={getSessionTypeColor(entry.session_type)}>
                      {entry.session_type}
                    </Badge>
                    {entry.phase && (
                      <span className="text-xs text-muted">{entry.phase}</span>
                    )}
                  </div>
                </div>
                <div className="text-right font-tabular text-sm">
                  {entry.distance_km ? `${entry.distance_km} km` : "—"}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="hidden md:block">
          <Card>
            <h2 className="font-display mb-4 text-center text-lg font-semibold">
              {formatDate(
                `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-01`,
                "MMMM yyyy"
              )}
            </h2>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted mb-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((entry, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!entry}
                  onClick={() => entry && setSelected(entry)}
                  className={cn(
                    "min-h-[72px] rounded-lg border border-border p-1 text-left text-xs transition-colors",
                    entry ? "hover:border-accent cursor-pointer" : "border-transparent",
                    entry?.completed && "opacity-50"
                  )}
                >
                  {entry && (
                    <>
                      <span className="font-tabular text-muted">
                        {parseInt(entry.date.slice(-2), 10)}
                      </span>
                      <Badge
                        className={cn(
                          "mt-1 block truncate text-[9px]",
                          getSessionTypeColor(entry.session_type)
                        )}
                      >
                        {entry.session_type.split(" ")[0]}
                      </Badge>
                    </>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
        >
          <Card
            className="w-full max-w-lg max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-sm text-muted">{formatDate(selected.date)}</p>
                <h2 className="font-display text-xl font-bold">{selected.session_type}</h2>
                {selected.phase && (
                  <span className="text-sm text-muted">{selected.phase} phase</span>
                )}
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close">
                <X className="h-5 w-5 text-muted" />
              </button>
            </div>

            {selected.description && (
              <p className="mb-4 text-sm">{selected.description}</p>
            )}

            <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div>
                <dt className="text-xs text-muted">Distance</dt>
                <dd className="font-tabular">{selected.distance_km ? `${selected.distance_km} km` : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Pace Target</dt>
                <dd className="font-tabular">{selected.pace_target ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">HR Zone</dt>
                <dd>{hrZoneLabel(selected.hr_zone)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">RPE</dt>
                <dd className="font-tabular">{selected.rpe ?? "—"}</dd>
              </div>
            </dl>

            {selected.notes && (
              <p className="mb-4 text-sm text-muted">{selected.notes}</p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant={selected.completed ? "secondary" : "primary"}
                onClick={() => onToggleComplete(selected)}
                className="flex-1"
              >
                <Check className="h-4 w-4" />
                {selected.completed ? "Completed" : "Mark Complete"}
              </Button>
              {selected.completed && (
                <Link href={logRunUrl(selected)} className="flex-1">
                  <Button variant="secondary" className="w-full">
                    Log This Run
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
