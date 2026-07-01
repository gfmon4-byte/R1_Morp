"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, StatCard } from "@/components/ui/Card";
import { FilterPills, PageHeader } from "@/components/ui/Badge";
import {
  WeeklyDistanceChart,
  MonthlyVolumeChart,
  HRZoneDistributionChart,
} from "@/components/charts/DashboardCharts";
import type { Activity, DateRangeFilter, HRZonePeriod, Profile } from "@/lib/types";
import { formatPace, weightedAvgPace } from "@/lib/pace";
import { isRunningSession } from "@/lib/sessionTypes";
import {
  filterByDateRange,
  filterByDaysBack,
  getWeekKey,
  getMonthKey,
  formatMonthLabel,
  formatWeekLabel,
  isDateInRange,
  getWeekRange,
  getLastWeekRange,
  formatDateShort,
} from "@/lib/dates";
import { computeHRZones, formatZoneRange, type ZoneKey } from "@/lib/hrZones";
import { getSessionTypeColor } from "@/lib/sessionTypes";
import { Badge } from "@/components/ui/Badge";
import { cn, formatNumber } from "@/lib/utils";

const DATE_FILTERS: { value: DateRangeFilter; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "90days", label: "90 Days" },
  { value: "all", label: "All Time" },
];

const HR_PERIODS: { value: HRZonePeriod; label: string }[] = [
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
];

export function DashboardClient({
  activities,
  profile,
}: {
  activities: Activity[];
  profile: Profile | null;
}) {
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>("all");
  const [hrPeriod, setHrPeriod] = useState<HRZonePeriod>("30");

  const runningActivities = useMemo(
    () => activities.filter((a) => isRunningSession(a.session_type)),
    [activities]
  );

  const filtered = useMemo(
    () => filterByDateRange(runningActivities, dateFilter),
    [runningActivities, dateFilter]
  );

  const totalDistance = useMemo(
    () => filtered.reduce((s, a) => s + (a.distance_km ?? 0), 0),
    [filtered]
  );

  const totalRuns = filtered.length;

  const avgPace = useMemo(
    () => weightedAvgPace(filtered),
    [filtered]
  );

  const weekComparison = useMemo(() => {
    const thisWeek = getWeekRange();
    const lastWeek = getLastWeekRange();
    const thisKm = runningActivities
      .filter((a) => isDateInRange(a.date, thisWeek.start, thisWeek.end))
      .reduce((s, a) => s + (a.distance_km ?? 0), 0);
    const lastKm = runningActivities
      .filter((a) => isDateInRange(a.date, lastWeek.start, lastWeek.end))
      .reduce((s, a) => s + (a.distance_km ?? 0), 0);
    const diff = thisKm - lastKm;
    const pct = lastKm > 0 ? Math.abs((diff / lastKm) * 100).toFixed(0) : null;
    return {
      thisKm,
      direction: diff > 0 ? ("up" as const) : diff < 0 ? ("down" as const) : ("flat" as const),
      text: pct ? `${pct}% vs last week` : `${formatNumber(thisKm)} km this week`,
    };
  }, [runningActivities]);

  const weeklyData = useMemo(() => {
    const weeks = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      weeks.set(getWeekKey(d.toISOString().slice(0, 10)), 0);
    }
    runningActivities.forEach((a) => {
      const key = getWeekKey(a.date);
      if (weeks.has(key)) {
        weeks.set(key, (weeks.get(key) ?? 0) + (a.distance_km ?? 0));
      }
    });
    return Array.from(weeks.entries()).map(([week, km]) => ({
      week: formatWeekLabel(week).split(" – ")[0],
      km: Math.round(km * 10) / 10,
    }));
  }, [runningActivities]);

  const monthlyData = useMemo(() => {
    const months = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.set(getMonthKey(d.toISOString().slice(0, 10)), 0);
    }
    runningActivities.forEach((a) => {
      const key = getMonthKey(a.date);
      if (months.has(key)) {
        months.set(key, (months.get(key) ?? 0) + (a.distance_km ?? 0));
      }
    });
    return Array.from(months.entries()).map(([month, km]) => ({
      month: formatMonthLabel(month).replace(" ", "'"),
      km: Math.round(km * 10) / 10,
    }));
  }, [runningActivities]);

  const hrZoneData = useMemo(() => {
    const days = parseInt(hrPeriod, 10);
    const periodActivities = filterByDaysBack(runningActivities, days);
    const totals: Record<ZoneKey, number> = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };

    periodActivities.forEach((a) => {
      if (a.hr_zone_breakdown) {
        (Object.keys(totals) as ZoneKey[]).forEach((k) => {
          totals[k] += a.hr_zone_breakdown?.[k] ?? 0;
        });
      }
    });

    const zones =
      profile?.hr_max && profile?.hr_rest
        ? computeHRZones(profile.hr_max, profile.hr_rest)
        : null;

    return (Object.keys(totals) as ZoneKey[]).map((key) => {
      const zone = zones?.find((z) => z.key === key);
      const label = zone ? formatZoneRange(zone) : `Z${key.slice(1)}`;
      return { key, name: label, minutes: totals[key] };
    });
  }, [runningActivities, hrPeriod, profile]);

  const recentActivities = activities.slice(0, 8);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          profile?.name
            ? `Welcome back, ${profile.name.split(" ")[0]}`
            : "Your training at a glance"
        }
      />

      <div className="mb-6">
        <FilterPills
          options={DATE_FILTERS}
          value={dateFilter}
          onChange={(v) => setDateFilter(v as DateRangeFilter)}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total Distance"
          value={`${formatNumber(totalDistance)} km`}
        />
        <StatCard label="Total Runs" value={String(totalRuns)} />
        <StatCard label="Avg Pace" value={formatPace(avgPace)} />
        <StatCard
          label="This Week"
          value={`${formatNumber(weekComparison.thisKm)} km`}
          trend={weekComparison}
        />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Distance</CardTitle>
            <span className="text-xs text-muted">Last 12 weeks</span>
          </CardHeader>
          <div className="overflow-x-auto scrollbar-thin -mx-2 px-2">
            <div className="min-w-[320px]">
              <WeeklyDistanceChart data={weeklyData} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Volume</CardTitle>
            <span className="text-xs text-muted">Last 12 months</span>
          </CardHeader>
          <div className="overflow-x-auto scrollbar-thin -mx-2 px-2">
            <div className="min-w-[320px]">
              <MonthlyVolumeChart data={monthlyData} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>HR Zone Distribution</CardTitle>
            <div className="flex gap-1">
              {HR_PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setHrPeriod(p.value)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-medium min-h-[32px]",
                    hrPeriod === p.value
                      ? "bg-accent text-background"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <HRZoneDistributionChart data={hrZoneData} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <Link href="/runs" className="text-xs text-accent hover:underline">
              View all
            </Link>
          </CardHeader>
          <ul className="divide-y divide-border">
            {recentActivities.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted">
                No activities logged yet.{" "}
                <Link href="/runs" className="text-accent underline">
                  Add a run
                </Link>
              </li>
            ) : (
              recentActivities.map((a) => (
                <li key={a.id}>
                  <Link
                    href="/runs"
                    className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-surface/50 -mx-2 px-2 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={getSessionTypeColor(a.session_type)}>
                          {a.session_type}
                        </Badge>
                        <span className="text-xs text-muted">
                          {formatDateShort(a.date)}
                        </span>
                      </div>
                      {a.route_name && (
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {a.route_name}
                        </p>
                      )}
                    </div>
                    <div className="text-right font-tabular text-sm shrink-0">
                      <div>{a.distance_km ? `${a.distance_km} km` : "—"}</div>
                      <div className="text-xs text-muted">
                        {formatPace(a.avg_pace_sec_per_km)}{" "}
                        {a.avg_hr ? `· ${a.avg_hr} bpm` : ""}
                      </div>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}
