'use client';

import { useMemo, useState } from 'react';
import { Lightning } from '@phosphor-icons/react';
import { DashboardCharts } from './DashboardCharts';
import { formatPace, formatDuration, thaiDate, getSessionColor } from '@/lib/utils';
import type { Activity, Profile } from '@/lib/supabase';
import type { HRZone } from '@/lib/hrZones';

interface Props {
  profile: Profile | null;
  activities: Activity[];
  hrZones: HRZone[];
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function DashboardClient({ profile, activities, hrZones }: Props) {
  // Derive available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    activities.forEach((a) => {
      if (a.date) years.add(new Date(a.date).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a); // newest first
  }, [activities]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  const [selectedYear, setSelectedYear] = useState<number>(
    availableYears.includes(currentYear) ? currentYear : (availableYears[0] ?? currentYear)
  );
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = all months

  // Filtered activities based on year + optional month
  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (!a.date) return false;
      const d = new Date(a.date);
      if (d.getFullYear() !== selectedYear) return false;
      if (selectedMonth !== null && d.getMonth() + 1 !== selectedMonth) return false;
      return true;
    });
  }, [activities, selectedYear, selectedMonth]);

  // ---- Stat computations on filtered set ----
  const totalDistance = filtered.reduce((sum, a) => sum + (a.distance_km || 0), 0);
  const totalRuns = filtered.filter((a) => a.distance_km > 0).length;
  const avgPace =
    totalRuns > 0
      ? filtered.reduce((sum, a) => sum + (a.avg_pace_sec_per_km || 0), 0) / totalRuns
      : 0;

  // "This week" or "this month" total depending on filter
  const weekStart = getWeekBounds();
  const periodKm = selectedMonth !== null
    ? filtered.reduce((sum, a) => sum + (a.distance_km || 0), 0)
    : filtered
        .filter((a) => a.date && new Date(a.date) >= weekStart)
        .reduce((sum, a) => sum + (a.distance_km || 0), 0);
  const periodLabel = selectedMonth !== null ? 'Month Total' : 'This Week';

  const recentActivities = filtered.slice(0, 6);

  return (
    <div>
      {/* Header */}
      <header className="page-header">
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', lineHeight: 1 }}>
              {profile?.name ? `Hey, ${profile.name}` : 'Dashboard'}
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-primary-soft)', border: '1px solid rgba(255,118,216,0.25)', borderRadius: 10, padding: '6px 12px' }}>
            <Lightning size={16} color="var(--color-primary)" weight="fill" />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-primary)' }}>
              {profile?.vo2max ? `VO₂: ${profile.vo2max}` : 'Elite'}
            </span>
          </div>
        </div>
      </header>

      <div className="page-content" style={{ paddingTop: 20 }}>

        {/* ---- Year / Month Filter ---- */}
        <div style={{ marginBottom: 20 }}>
          {/* Year pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: 'Barlow, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Year
            </span>
            {availableYears.map((yr) => (
              <button
                key={yr}
                onClick={() => {
                  setSelectedYear(yr);
                  setSelectedMonth(null);
                }}
                style={{
                  padding: '4px 14px',
                  borderRadius: 100,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  fontFamily: 'Barlow Condensed, sans-serif',
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedYear === yr ? 'var(--color-primary)' : 'rgba(255,255,255,0.07)',
                  color: selectedYear === yr ? '#fff' : 'var(--color-text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* Month pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: 'Barlow, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Month
            </span>
            <button
              onClick={() => setSelectedMonth(null)}
              style={{
                padding: '4px 12px',
                borderRadius: 100,
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: 'Barlow, sans-serif',
                border: 'none',
                cursor: 'pointer',
                background: selectedMonth === null ? 'var(--color-primary-soft)' : 'rgba(255,255,255,0.05)',
                color: selectedMonth === null ? 'var(--color-primary)' : 'var(--color-text-muted)',
                transition: 'all 0.15s',
              }}
            >
              All
            </button>
            {MONTHS.map((name, idx) => {
              const m = idx + 1;
              const isActive = selectedMonth === m;
              // highlight current month subtly
              const isCurrent = selectedYear === currentYear && m === currentMonth;
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 100,
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 700 : 500,
                    fontFamily: 'Barlow, sans-serif',
                    border: isCurrent && !isActive ? '1px solid rgba(255,118,216,0.4)' : 'none',
                    cursor: 'pointer',
                    background: isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? '#fff' : isCurrent ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- Stat Cards ---- */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <StatCard label="Total Distance" value={`${totalDistance.toFixed(1)}`} unit="km" color="var(--color-primary)" />
          <StatCard label="Total Runs" value={`${totalRuns}`} unit="runs" color="#059669" />
          <StatCard label="Avg Pace" value={avgPace > 0 ? formatPace(avgPace) : '—'} unit="" color="#FBBF24" />
          <StatCard label={periodLabel} value={`${periodKm.toFixed(1)}`} unit="km" color="#60A5FA" />
        </div>

        {/* Charts */}
        <DashboardCharts activities={filtered} hrZones={hrZones} />

        {/* Recent Activities */}
        <div style={{ marginTop: 24 }}>
          <p className="section-title">Recent Activities</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentActivities.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                No activities for this period.
              </div>
            ) : (
              recentActivities.map((activity) => (
                <RecentActivityRow key={activity.id} activity={activity} />
              ))
            )}
          </div>
        </div>

        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

// ---- Helpers ----

function getWeekBounds(): Date {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color}` }}>
      <span className="stat-label">{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="stat-value">{value}</span>
        {unit && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{unit}</span>}
      </div>
    </div>
  );
}

function RecentActivityRow({ activity }: { activity: Activity }) {
  const color = getSessionColor(activity.session_type);
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
      <div
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}20`, border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '0.625rem', fontWeight: 700, color, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.03em' }}>
          {activity.session_type.split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase()}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {activity.session_type}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 1 }}>
          {thaiDate(activity.date)} {activity.route_name ? `· ${activity.route_name}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-text)' }}>
          {activity.distance_km > 0 ? `${activity.distance_km.toFixed(1)} km` : formatDuration(activity.duration_seconds)}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {activity.avg_pace_sec_per_km ? formatPace(activity.avg_pace_sec_per_km) : formatDuration(activity.duration_seconds)}
        </div>
      </div>
    </div>
  );
}
