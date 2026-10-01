'use client';

import { useMemo, useState } from 'react';
import { Lightning, CalendarBlank } from '@phosphor-icons/react';
import { DashboardCharts } from './DashboardCharts';
import { WorkoutDetailSection } from './WorkoutDetailSection';
import { formatPace, thaiToday } from '@/lib/utils';
import type { Activity, Profile } from '@/lib/supabase';
import type { HRZone } from '@/lib/hrZones';
import { parseISO, differenceInCalendarDays } from 'date-fns';

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
  // Load races (merging database and local storage fallback)
  const races = useMemo(() => {
    const localRacesStr = typeof window !== 'undefined' ? localStorage.getItem('profile_races') : null;
    let localRaces: any[] = [];
    if (localRacesStr) {
      try {
        localRaces = JSON.parse(localRacesStr);
      } catch (e) {
        localRaces = [];
      }
    }
    
    let dbRaces: any[] = [];
    if (profile?.races) {
      dbRaces = Array.isArray(profile.races) ? profile.races : JSON.parse(profile.races as any);
    }
    
    // Choose database races if present, else fallback to localStorage
    const activeRaces = dbRaces.length > 0 ? dbRaces : localRaces;
    return activeRaces;
  }, [profile?.races]);

  const nextRace = useMemo(() => {
    if (!races || races.length === 0) return null;
    const todayStr = thaiToday(); // "yyyy-MM-dd"
    
    // Filter races that are in the future or today
    const upcoming = races.filter((r) => r.date >= todayStr);
    if (upcoming.length === 0) return null;
    
    // Sort upcoming races by date (ascending)
    upcoming.sort((a, b) => a.date.localeCompare(b.date));
    return upcoming[0];
  }, [races]);

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
  const [selectedMonth, setSelectedMonth] = useState<number | null>(currentMonth); // default to current month

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

  return (
    <div>
      {/* Header */}
      <header className="page-header">
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* Top row: greeting + date (inline) | VO₂ badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.375rem', lineHeight: 1, margin: 0 }}>
                {profile?.name ? `Hey, ${profile.name}` : 'Dashboard'}
              </h1>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>·</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' })}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-primary-soft)', border: '1px solid rgba(255,118,216,0.25)', borderRadius: 10, padding: '5px 10px', flexShrink: 0 }}>
              <Lightning size={14} color="var(--color-primary)" weight="fill" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                {profile?.vo2max ? `VO₂: ${profile.vo2max}` : 'Elite'}
              </span>
            </div>
          </div>
          {/* Race pill below */}
          {nextRace && (() => {
            const todayStr = thaiToday();
            const raceDate = parseISO(nextRace.date);
            const today = parseISO(todayStr);
            const diff = differenceInCalendarDays(raceDate, today);
            const isToday = diff === 0;
            const statusText = isToday ? 'แข่งวันนี้! 🎉🏆' : `อีก ${diff} วัน 🏁`;
            return (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 6,
                padding: '3px 10px',
                borderRadius: 100,
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: "'Mali', sans-serif",
                background: isToday ? 'rgba(127, 219, 182, 0.15)' : 'rgba(255, 143, 163, 0.12)',
                border: `1px solid ${isToday ? 'var(--color-accent)' : 'var(--color-primary)'}`,
                color: isToday ? '#059669' : 'var(--color-primary)',
              }}>
                <span style={{ fontWeight: 700, fontFamily: "'Baloo 2', sans-serif" }}>
                  {nextRace.name}
                  {nextRace.distance && ` (${nextRace.distance})`}
                </span>
                <span>·</span>
                <span>{statusText}</span>
              </div>
            );
          })()}
        </div>
      </header>
      <div className="page-content" style={{ paddingTop: 20 }}>

        {/* ---- Year / Month Filter ---- */}
        <div style={{ marginBottom: 20 }}>
          {/* Year pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: "'Baloo 2', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' }}>
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
                  fontFamily: "'Baloo 2', sans-serif",
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedYear === yr ? 'var(--color-primary)' : 'rgba(255,143,163,0.12)',
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
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: "'Baloo 2', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Month
            </span>
            <button
              onClick={() => setSelectedMonth(null)}
              style={{
                padding: '4px 12px',
                borderRadius: 100,
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: "'Baloo 2', sans-serif",
                border: 'none',
                cursor: 'pointer',
                background: selectedMonth === null ? 'var(--color-primary-soft)' : 'rgba(255,143,163,0.08)',
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
                    fontFamily: "'Baloo 2', sans-serif",
                    border: isCurrent && !isActive ? '1px solid rgba(255,143,163,0.4)' : 'none',
                    cursor: 'pointer',
                    background: isActive ? 'var(--color-primary)' : 'rgba(255,143,163,0.08)',
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

        {/* Workout Details & Interactive Calendar (Overview, Splits/Lap, HR Zones) */}
        <WorkoutDetailSection activities={activities} hrZones={hrZones} />

        {/* Charts */}
        <DashboardCharts activities={filtered} allActivities={activities} hrZones={hrZones} />

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
