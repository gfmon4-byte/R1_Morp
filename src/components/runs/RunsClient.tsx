"use client";

import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge, EmptyState, FilterPills, PageHeader } from "@/components/ui/Badge";
import type { Activity, HRZoneBreakdown, Profile } from "@/lib/types";
import {
  createActivity,
  updateActivity,
  deleteActivity,
  type ActivityInput,
} from "@/lib/actions/data";
import { ALL_SESSION_TYPES, getSessionTypeColor } from "@/lib/sessionTypes";
import {
  formatPace,
  formatDuration,
  parseDurationToSeconds,
  computePaceSecPerKm,
} from "@/lib/pace";
import { formatDateShort, filterByDateRange } from "@/lib/dates";
import type { DateRangeFilter } from "@/lib/types";
import { computeHRZones, getZoneForHR, formatZoneShort } from "@/lib/hrZones";
import { cn, truncate } from "@/lib/utils";

import { nullableNumber, nullableRpe, zoneMinutes } from "@/lib/schemas";

const activitySchema = z.object({
  date: z.string().min(1, "Date is required"),
  session_type: z.string().min(1),
  distance_km: nullableNumber,
  duration: z.string().min(1, "Duration is required"),
  avg_hr: nullableNumber.optional(),
  max_hr: nullableNumber.optional(),
  z1: zoneMinutes,
  z2: zoneMinutes,
  z3: zoneMinutes,
  z4: zoneMinutes,
  z5: zoneMinutes,
  elevation_gain_m: nullableNumber.optional(),
  rpe: nullableRpe,
  notes: z.string().nullable().optional(),
  route_name: z.string().nullable().optional(),
});

type FormValues = z.output<typeof activitySchema>;

const DATE_FILTERS = [
  { value: "all", label: "All Time" },
  { value: "month", label: "This Month" },
  { value: "90days", label: "90 Days" },
];

const PAGE_SIZE = 10;

function formToInput(values: FormValues): ActivityInput {
  const duration_seconds = parseDurationToSeconds(values.duration) ?? 0;
  const distance = values.distance_km;
  const avg_pace =
    distance && duration_seconds
      ? computePaceSecPerKm(distance, duration_seconds)
      : null;

  const hasZones =
    (values.z1 ?? 0) + (values.z2 ?? 0) + (values.z3 ?? 0) +
    (values.z4 ?? 0) + (values.z5 ?? 0) > 0;

  const hr_zone_breakdown: HRZoneBreakdown | null = hasZones
    ? {
        z1: values.z1 ?? 0,
        z2: values.z2 ?? 0,
        z3: values.z3 ?? 0,
        z4: values.z4 ?? 0,
        z5: values.z5 ?? 0,
      }
    : null;

  return {
    date: values.date,
    session_type: values.session_type,
    distance_km: distance,
    duration_seconds,
    avg_pace_sec_per_km: avg_pace,
    avg_hr: values.avg_hr ?? null,
    max_hr: values.max_hr ?? null,
    hr_zone_breakdown,
    elevation_gain_m: values.elevation_gain_m ?? null,
    rpe: values.rpe ?? null,
    notes: values.notes ?? null,
    route_name: values.route_name ?? null,
  };
}

function activityToForm(a: Activity): FormValues {
  const bd = a.hr_zone_breakdown;
  return {
    date: a.date,
    session_type: a.session_type,
    distance_km: a.distance_km,
    duration: formatDuration(a.duration_seconds),
    avg_hr: a.avg_hr,
    max_hr: a.max_hr,
    z1: bd?.z1 ?? 0,
    z2: bd?.z2 ?? 0,
    z3: bd?.z3 ?? 0,
    z4: bd?.z4 ?? 0,
    z5: bd?.z5 ?? 0,
    elevation_gain_m: a.elevation_gain_m,
    rpe: a.rpe,
    notes: a.notes,
    route_name: a.route_name,
  };
}

export function RunsClient({
  activities: initial,
  profile,
  prefill,
}: {
  activities: Activity[];
  profile: Profile | null;
  prefill?: Partial<FormValues> | null;
}) {
  const [activities, setActivities] = useState(initial);
  const [showForm, setShowForm] = useState(Boolean(prefill));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hrMax = profile?.hr_max ?? null;
  const hrRest = profile?.hr_rest ?? null;
  const zones = hrMax && hrRest ? computeHRZones(hrMax, hrRest) : null;

  const defaultValues: FormValues = {
    date: prefill?.date ?? new Date().toISOString().slice(0, 10),
    session_type: prefill?.session_type ?? "Easy Run",
    distance_km: prefill?.distance_km ?? null,
    duration: prefill?.duration ?? "0:00",
    avg_hr: prefill?.avg_hr ?? null,
    max_hr: prefill?.max_hr ?? null,
    z1: 0,
    z2: 0,
    z3: 0,
    z4: 0,
    z5: 0,
    elevation_gain_m: null,
    rpe: prefill?.rpe ?? null,
    notes: prefill?.notes ?? null,
    route_name: null,
  };

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(activitySchema),
    defaultValues,
  });

  const watchDistance = watch("distance_km");
  const watchDuration = watch("duration");
  const watchAvgHr = watch("avg_hr");

  const computedPace = useMemo(() => {
    const dur = parseDurationToSeconds(watchDuration);
    const dist = watchDistance != null ? Number(watchDistance) : null;
    if (dist && dur) return formatPace(computePaceSecPerKm(dist, dur));
    return "—";
  }, [watchDistance, watchDuration]);

  const avgHrZone = useMemo(() => {
    if (!watchAvgHr || !hrMax || !hrRest) return null;
    const zone = getZoneForHR(Number(watchAvgHr), hrMax, hrRest);
    return zone ? formatZoneShort(zone) : null;
  }, [watchAvgHr, hrMax, hrRest]);

  const filtered = useMemo(() => {
    let list = [...activities];
    if (sessionFilter !== "all") {
      list = list.filter(
        (a) => a.session_type.toLowerCase() === sessionFilter.toLowerCase()
      );
    }
    list = filterByDateRange(list, dateFilter as DateRangeFilter);
    return list;
  }, [activities, sessionFilter, dateFilter]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const openNew = useCallback(() => {
    setEditingId(null);
    reset(defaultValues);
    setShowForm(true);
    setError(null);
  }, [reset, defaultValues]);

  const openEdit = useCallback(
    (a: Activity) => {
      setEditingId(a.id);
      reset(activityToForm(a));
      setShowForm(true);
      setError(null);
    },
    [reset]
  );

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    setError(null);
    try {
      const input = formToInput(values);
      if (editingId) {
        const updated = await updateActivity(editingId, input);
        setActivities((prev) =>
          prev.map((a) => (a.id === editingId ? updated : a))
        );
      } else {
        const created = await createActivity(input);
        setActivities((prev) => [created, ...prev]);
      }
      setShowForm(false);
      setEditingId(null);
      reset(defaultValues);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this activity?")) return;
    setLoading(true);
    try {
      await deleteActivity(id);
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  const sessionOptions = [
    { value: "all", label: "All Types" },
    ...ALL_SESSION_TYPES.map((t) => ({ value: t, label: t })),
  ];

  return (
    <>
      <PageHeader
        title="Run History"
        subtitle="Manual log from Apple Watch"
        action={
          <Button onClick={openNew} size="md">
            <Plus className="h-4 w-4" />
            Add Run
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {showForm && (
        <Card className="mb-6">
          <h2 className="font-display mb-4 text-lg font-semibold">
            {editingId ? "Edit Run" : "Add Run"}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Date" type="date" error={errors.date?.message} {...register("date")} />
              <Select label="Session Type" {...register("session_type")}>
                {ALL_SESSION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Input
                label="Distance (km)"
                type="number"
                step="0.1"
                {...register("distance_km")}
              />
              <Input
                label="Duration (H:MM:SS or MM:SS)"
                placeholder="0:45:00"
                error={errors.duration?.message}
                {...register("duration")}
              />
            </div>

            <div className="rounded-xl bg-surface px-4 py-3 text-sm">
              <span className="text-muted">Calculated pace: </span>
              <span className="font-tabular font-semibold text-accent">{computedPace}</span>
              {avgHrZone && (
                <>
                  <span className="mx-2 text-muted">·</span>
                  <span className="text-muted">Avg HR zone: </span>
                  <span className="font-semibold">{avgHrZone}</span>
                </>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Avg HR (bpm)" type="number" {...register("avg_hr")} />
              <Input label="Max HR (bpm)" type="number" {...register("max_hr")} />
              <Input label="Elevation (m)" type="number" {...register("elevation_gain_m")} />
              <Input label="RPE (1–10)" type="number" min={1} max={10} {...register("rpe")} />
              <Input label="Route Name" {...register("route_name")} />
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-foreground">
                HR Zone Breakdown (minutes, optional)
              </legend>
              {zones && (
                <p className="mb-2 text-xs text-muted">
                  Zones from profile:{" "}
                  {zones.map((z) => formatZoneShort(z)).join(" · ")}
                </p>
              )}
              <div className="grid grid-cols-5 gap-2">
                {(["z1", "z2", "z3", "z4", "z5"] as const).map((z, i) => (
                  <Input
                    key={z}
                    label={`Z${i + 1}`}
                    type="number"
                    min={0}
                    {...register(z)}
                  />
                ))}
              </div>
            </fieldset>

            <Textarea label="Notes" {...register("notes")} />

            <div className="flex gap-3">
              <Button type="submit" loading={loading}>
                {editingId ? "Save Changes" : "Log Run"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-4 space-y-3">
        <FilterPills
          options={DATE_FILTERS}
          value={dateFilter}
          onChange={setDateFilter}
        />
        <div className="overflow-x-auto scrollbar-thin">
          <FilterPills
            options={sessionOptions}
            value={sessionFilter}
            onChange={setSessionFilter}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No runs found"
          description="Log your first run or adjust filters."
          action={<Button onClick={openNew}>Add Run</Button>}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {paginated.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                expanded={expandedNotes.has(a.id)}
                onToggleNotes={() =>
                  setExpandedNotes((prev) => {
                    const next = new Set(prev);
                    if (next.has(a.id)) next.delete(a.id);
                    else next.add(a.id);
                    return next;
                  })
                }
                onEdit={() => openEdit(a)}
                onDelete={() => onDelete(a.id)}
              />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Pace</th>
                  <th className="px-4 py-3">Avg HR</th>
                  <th className="px-4 py-3">RPE</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-elevated/50">
                    <td className="px-4 py-3 font-tabular">{formatDateShort(a.date)}</td>
                    <td className="px-4 py-3">
                      <Badge className={getSessionTypeColor(a.session_type)}>
                        {a.session_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-tabular">{a.distance_km ?? "—"} km</td>
                    <td className="px-4 py-3 font-tabular">{formatDuration(a.duration_seconds)}</td>
                    <td className="px-4 py-3 font-tabular">{formatPace(a.avg_pace_sec_per_km)}</td>
                    <td className="px-4 py-3 font-tabular">{a.avg_hr ?? "—"}</td>
                    <td className="px-4 py-3 font-tabular">{a.rpe ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onDelete(a.id)} aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function ActivityCard({
  activity: a,
  expanded,
  onToggleNotes,
  onEdit,
  onDelete,
}: {
  activity: Activity;
  expanded: boolean;
  onToggleNotes: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={getSessionTypeColor(a.session_type)}>{a.session_type}</Badge>
            <span className="text-xs text-muted">{formatDateShort(a.date)}</span>
          </div>
          {a.route_name && (
            <p className="mt-1 text-sm text-muted">{a.route_name}</p>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete">
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 font-tabular text-sm">
        <div>
          <span className="text-xs text-muted">Distance</span>
          <p>{a.distance_km ? `${a.distance_km} km` : "—"}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Pace</span>
          <p>{formatPace(a.avg_pace_sec_per_km)}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Avg HR</span>
          <p>{a.avg_hr ?? "—"}</p>
        </div>
      </div>
      {a.notes && (
        <div>
          <button
            type="button"
            onClick={onToggleNotes}
            className="flex items-center gap-1 text-xs text-accent"
          >
            Notes {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <p className={cn("mt-1 text-sm text-muted", !expanded && "line-clamp-2")}>
            {expanded ? a.notes : truncate(a.notes, 80)}
          </p>
        </div>
      )}
    </Card>
  );
}
