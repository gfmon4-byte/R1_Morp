'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Heart,
  Gauge,
  Fire,
  Footprints,
  Lightning,
  Wind,
  Thermometer,
  ArrowsDownUp,
  Trophy,
  ArrowSquareOut,
  ArrowsClockwise,
  Timer,
  ChartBar,
  Drop,
  Sparkle,
  Sneaker,
  CheckCircle,
  Copy,
  DownloadSimple,
  Check,
} from '@phosphor-icons/react';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { formatPace, formatDuration, thaiDate, getSessionColor } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Activity } from '@/lib/supabase';
import type { HRZone } from '@/lib/hrZones';

interface Props {
  activities: Activity[];
  hrZones?: HRZone[];
}

export function WorkoutDetailSection({ activities, hrZones }: Props) {
  const [localActivities, setLocalActivities] = useState<Activity[]>(activities);
  const [syncingNewRuns, setSyncingNewRuns] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  useEffect(() => {
    setLocalActivities(activities);
  }, [activities]);

  // 1. Find initial date: latest date with an activity, or fallback to today
  const latestDateWithActivity = useMemo(() => {
    if (!localActivities || localActivities.length === 0) {
      return format(new Date(), 'yyyy-MM-dd');
    }
    const sorted = [...localActivities]
      .filter((a) => a.date)
      .sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.date || format(new Date(), 'yyyy-MM-dd');
  }, [localActivities]);

  const [selectedDate, setSelectedDate] = useState<string>(latestDateWithActivity);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    try {
      return parseISO(latestDateWithActivity);
    } catch {
      return new Date();
    }
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'splits' | 'zones'>('overview');
  const [workoutData, setWorkoutData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Group activities by date string "YYYY-MM-DD"
  const activitiesByDate = useMemo(() => {
    const map: Record<string, Activity[]> = {};
    for (const a of localActivities || []) {
      if (!a.date) continue;
      const dt = a.date.slice(0, 10);
      if (!map[dt]) map[dt] = [];
      map[dt].push(a);
    }
    return map;
  }, [localActivities]);

  // Available dates for quick pills (top 6 newest)
  const recentRunDates = useMemo(() => {
    return Object.keys(activitiesByDate)
      .sort()
      .reverse()
      .slice(0, 6);
  }, [activitiesByDate]);

  // Handler to pull any newly recorded Garmin runs from the last 7 days
  const handleSyncGarminRuns = async () => {
    try {
      setSyncingNewRuns(true);
      setSyncToast(null);

      const res = await fetch('/api/garmin-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      const data = await res.json();

      if (data.success) {
        // Refresh activities list from Supabase
        const { data: refreshedActs } = await supabase
          .from('activities')
          .select('*')
          .order('date', { ascending: false });

        if (refreshedActs && refreshedActs.length > 0) {
          setLocalActivities(refreshedActs);
          const newest = refreshedActs[0].date;
          setSelectedDate(newest);
          try {
            setCalendarMonth(parseISO(newest));
          } catch {}
          fetchWorkoutDetails(newest, true);
        }

        if (data.inserted > 0) {
          setSyncToast(`ซิงค์สำเร็จ! พบการวิ่งใหม่ ${data.inserted} รายการ`);
        } else {
          setSyncToast(`ข้อมูลเป็นปัจจุบันแล้ว (${data.total || 0} รายการ)`);
        }
      } else {
        setSyncToast(data.error || 'การซิงค์ล้มเหลว');
      }
    } catch (e: any) {
      setSyncToast(e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Garmin');
    } finally {
      setSyncingNewRuns(false);
      setTimeout(() => setSyncToast(null), 5000);
    }
  };

  const [copiedCsv, setCopiedCsv] = useState<boolean>(false);

  const handleCopyCsv = async () => {
    if (!workoutData) return;
    const csvContent = buildWorkoutCsv(workoutData);
    try {
      await navigator.clipboard.writeText(csvContent);
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 2500);
    } catch (err) {
      console.error('Failed to copy CSV:', err);
    }
  };

  const handleDownloadCsv = () => {
    if (!workoutData) return;
    const csvContent = buildWorkoutCsv(workoutData);
    const dateStr = workoutData.session_date || selectedDate || 'workout';
    const fileName = `garmin_${dateStr}_WU_Main_CD_all_laps.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Fetch workout details from API (which checks DB first)
  const fetchWorkoutDetails = useCallback(async (dateStr: string, forceFresh = false) => {
    try {
      if (forceFresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMsg(null);

      const url = `/api/garmin-last-run?date=${dateStr}${forceFresh ? '&fresh=true' : ''}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.status === 'success') {
        setWorkoutData(data);
      } else {
        // Fallback to checking local activities array if API returned an error
        const localActs = activitiesByDate[dateStr];
        if (localActs && localActs.length > 0) {
          const act = localActs[0];
          setWorkoutData({
            status: 'success',
            activity_id: act.garmin_activity_id || act.id,
            activity_name: act.title || act.route_name || act.session_type || 'Running Activity',
            activity_type: act.session_type || 'Running',
            session_date: act.date,
            start_time_local: `${act.date}T06:00:00.0`,
            location_name: act.route_name || 'Thailand',
            summary: {
              distance_km: act.distance_km || 0,
              duration_seconds: act.duration_seconds || 0,
              duration_formatted: formatDuration(act.duration_seconds || 0),
              moving_duration_formatted: formatDuration(act.duration_seconds || 0),
              elapsed_duration_formatted: formatDuration(act.duration_seconds || 0),
              avg_pace: act.avg_pace_sec_per_km ? formatPace(act.avg_pace_sec_per_km) : '--',
              best_pace: '--',
              avg_speed_kph: act.avg_pace_sec_per_km ? Math.round((3600 / act.avg_pace_sec_per_km) * 10) / 10 : null,
              avg_hr: act.avg_hr,
              max_hr: act.max_hr,
              calories: act.calories,
              steps: act.steps,
              avg_cadence: act.avg_cadence,
              avg_stride_length_m: act.avg_stride_length,
              avg_ground_contact_time_ms: act.avg_ground_contact_time,
              avg_vertical_oscillation_cm: act.avg_vertical_oscillation,
              avg_vertical_ratio_percent: act.avg_vertical_ratio,
              elevation_gain_m: act.elevation_gain_m,
              training_effect_label: act.session_type,
            },
            hr_zones: [],
            laps: [],
            source: 'activities_local',
          });
        } else {
          setWorkoutData(null);
          setErrorMsg(data?.error || `ไม่พบข้อมูลกิจกรรมการวิ่งในวันที่ ${dateStr}`);
        }
      }
    } catch (err: any) {
      console.error('Error fetching workout details:', err);
      setErrorMsg(err.message || 'ไม่สามารถโหลดข้อมูลการวิ่งได้');
      setWorkoutData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activitiesByDate]);

  useEffect(() => {
    if (selectedDate) {
      fetchWorkoutDetails(selectedDate);
    }
  }, [selectedDate, fetchWorkoutDetails]);

  // Calendar calculations
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // 0 = Sunday, 1 = Monday ... convert to Monday-first (0 = Mon, 6 = Sun)
  const startDayOfWeek = (getDay(monthStart) + 6) % 7;
  const paddedDays: (Date | null)[] = [
    ...Array(startDayOfWeek).fill(null),
    ...daysInMonth,
  ];

  const handlePrevMonth = () => setCalendarMonth((m) => subMonths(m, 1));
  const handleNextMonth = () => setCalendarMonth((m) => addMonths(m, 1));
  const handleSelectToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setSelectedDate(today);
    setCalendarMonth(new Date());
  };
  const handleSelectLatest = () => {
    setSelectedDate(latestDateWithActivity);
    try {
      setCalendarMonth(parseISO(latestDateWithActivity));
    } catch {}
  };

  const summary = workoutData?.summary || {};
  const hrZonesData = workoutData?.hr_zones || [];
  const laps = workoutData?.laps || [];
  const weather = workoutData?.weather;
  const gear = workoutData?.gear;

  // Find fastest lap for highlight badge
  const fastestLapIndex = useMemo(() => {
    if (!laps || laps.length === 0) return null;
    let minPaceSec = Infinity;
    let bestIdx = null;
    laps.forEach((l: any) => {
      const p = l.avg_pace;
      if (p && p.includes(':')) {
        const [m, s] = p.split(':').map(Number);
        const total = m * 60 + s;
        if (total > 0 && total < minPaceSec) {
          minPaceSec = total;
          bestIdx = l.lap_index;
        }
      }
    });
    return bestIdx;
  }, [laps]);

  return (
    <div style={{ marginTop: 24, marginBottom: 28 }}>
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--color-primary-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
            }}
          >
            <CalendarBlank size={18} weight="fill" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700, fontFamily: "'Baloo 2', sans-serif" }}>
              details run
            </h2>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              เลือกวันที่ในปฏิทินเพื่อดู Overview, Splits และ Heart Rate Zones จากฐานข้อมูล
            </p>
          </div>
        </div>

        {/* Action Buttons: Sync New Runs & Jump to Latest */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {syncToast && (
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--color-primary)',
                background: 'var(--color-primary-soft)',
                padding: '4px 10px',
                borderRadius: 100,
                border: '1px solid rgba(255,143,163,0.3)',
              }}
            >
              {syncToast}
            </span>
          )}

          <button
            onClick={handleSyncGarminRuns}
            disabled={syncingNewRuns}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 12px',
              borderRadius: 100,
              fontSize: '0.75rem',
              fontWeight: 600,
              fontFamily: "'Baloo 2', sans-serif",
              background: 'var(--color-primary)',
              color: '#FFFFFF',
              border: 'none',
              cursor: syncingNewRuns ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.15s ease',
            }}
          >
            <ArrowsClockwise size={13} className={syncingNewRuns ? 'animate-spin' : ''} />
            <span>{syncingNewRuns ? 'Syncing...' : 'Sync Garmin'}</span>
          </button>

          <button
            onClick={handleSelectLatest}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 12px',
              borderRadius: 100,
              fontSize: '0.75rem',
              fontWeight: 600,
              fontFamily: "'Baloo 2', sans-serif",
              background: 'var(--color-primary-soft)',
              border: '1px solid rgba(255,143,163,0.3)',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkle size={13} weight="fill" />
            <span>ล่าสุด ({latestDateWithActivity.slice(5)})</span>
          </button>
        </div>
      </div>

      {/* Main Card: Calendar + Workout Details */}
      <div
        className="card"
        style={{
          padding: '18px 20px',
          borderRadius: 20,
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* ---- 1. CALENDAR CONTROLS & GRID ---- */}
        <div style={{ marginBottom: 16 }}>
          {/* Month Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: '1px solid var(--color-border-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  fontFamily: "'Baloo 2', sans-serif",
                  color: 'var(--color-foreground)',
                }}
              >
                {format(calendarMonth, 'MMMM yyyy')}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                ({Object.keys(activitiesByDate).filter((d) => d.startsWith(format(calendarMonth, 'yyyy-MM'))).length} runs)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: '1px solid var(--color-border-muted)',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--color-foreground)',
                }}
              >
                <CaretLeft size={14} weight="bold" />
              </button>
              <button
                onClick={handleSelectToday}
                style={{
                  padding: '3px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border-muted)',
                  background: 'transparent',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                }}
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                aria-label="Next Month"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: '1px solid var(--color-border-muted)',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--color-foreground)',
                }}
              >
                <CaretRight size={14} weight="bold" />
              </button>
            </div>
          </div>

          {/* Weekday Labels (Mon - Sun) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 4,
              textAlign: 'center',
              marginBottom: 6,
            }}
          >
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName) => (
              <span
                key={dayName}
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  fontFamily: "'Baloo 2', sans-serif",
                }}
              >
                {dayName}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {paddedDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} style={{ height: 42 }} />;
              }
              const dStr = format(day, 'yyyy-MM-dd');
              const isSelected = dStr === selectedDate;
              const isToday = dStr === format(new Date(), 'yyyy-MM-dd');
              const acts = activitiesByDate[dStr] || [];
              const hasRun = acts.length > 0;
              const totalKm = acts.reduce((s, a) => s + (a.distance_km || 0), 0);
              const sessionType = acts[0]?.session_type || 'Run';
              const dotColor = hasRun ? getSessionColor(sessionType) : 'transparent';

              return (
                <button
                  key={dStr}
                  onClick={() => setSelectedDate(dStr)}
                  style={{
                    height: 44,
                    borderRadius: 10,
                    border: isSelected
                      ? '2px solid var(--color-primary)'
                      : isToday
                      ? '1px solid var(--color-accent)'
                      : hasRun
                      ? '1px solid rgba(255,143,163,0.3)'
                      : '1px solid transparent',
                    background: isSelected
                      ? 'var(--color-primary)'
                      : hasRun
                      ? 'rgba(255,143,163,0.08)'
                      : 'transparent',
                    color: isSelected
                      ? '#FFFFFF'
                      : isToday
                      ? 'var(--color-primary)'
                      : 'var(--color-foreground)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    padding: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: isSelected || hasRun || isToday ? 700 : 500,
                      fontFamily: "'Baloo 2', sans-serif",
                      lineHeight: 1,
                    }}
                  >
                    {format(day, 'd')}
                  </span>

                  {hasRun && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
                      <span
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: isSelected ? '#FFFFFF' : dotColor,
                        }}
                      />
                      <span
                        style={{
                          fontSize: '0.5625rem',
                          fontWeight: 700,
                          fontFamily: "'Baloo 2', sans-serif",
                          color: isSelected ? '#FFFFFF' : 'var(--color-primary)',
                          lineHeight: 1,
                        }}
                      >
                        {totalKm > 0 ? `${totalKm.toFixed(1)}k` : 'Run'}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Date Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflowX: 'auto',
              paddingTop: 10,
              paddingBottom: 4,
              borderTop: '1px solid var(--color-border-muted)',
              marginTop: 10,
            }}
          >
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
                fontFamily: "'Baloo 2', sans-serif",
              }}
            >
              Recent Runs:
            </span>
            {recentRunDates.map((dt) => {
              const acts = activitiesByDate[dt] || [];
              const km = acts.reduce((s, a) => s + (a.distance_km || 0), 0);
              const isSel = dt === selectedDate;
              return (
                <button
                  key={dt}
                  onClick={() => {
                    setSelectedDate(dt);
                    try {
                      setCalendarMonth(parseISO(dt));
                    } catch {}
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 100,
                    fontSize: '0.6875rem',
                    fontWeight: isSel ? 700 : 500,
                    fontFamily: "'Baloo 2', sans-serif",
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    border: isSel ? '1px solid var(--color-primary)' : '1px solid rgba(255,143,163,0.2)',
                    background: isSel ? 'var(--color-primary-soft)' : 'transparent',
                    color: isSel ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {thaiDate(dt)} ({km.toFixed(1)} km)
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- 2. WORKOUT DETAILS HEADER BAR ---- */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 14,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-muted)',
            marginBottom: 16,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  fontFamily: "'Baloo 2', sans-serif",
                  color: 'var(--color-foreground)',
                }}
              >
                {workoutData?.activity_name || workoutData?.parts?.[0]?.activity_name || 'กิจกรรมการวิ่ง'}
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 100,
                  background: 'var(--color-primary-soft)',
                  color: 'var(--color-primary)',
                  fontFamily: "'Baloo 2', sans-serif",
                }}
              >
                {workoutData?.activity_type || 'Running'}
              </span>
              {workoutData?.source && (
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 6,
                    background: 'rgba(127,219,182,0.15)',
                    color: '#059669',
                    fontFamily: "'Baloo 2', sans-serif",
                  }}
                >
                  ✓ In Database
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              <span>{thaiDate(selectedDate)}</span>
              {workoutData?.start_time_local && (
                <span> · {workoutData.start_time_local.slice(11, 16)} น.</span>
              )}
              {workoutData?.location_name && <span> · {workoutData.location_name}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {workoutData?.garmin_connect_url && (
              <a
                href={workoutData.garmin_connect_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px',
                  borderRadius: 8,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border-muted)',
                  background: 'var(--color-bg-surface)',
                  textDecoration: 'none',
                }}
              >
                <span>Garmin</span>
                <ArrowSquareOut size={12} />
              </a>
            )}

            {/* Copy CSV Button */}
            <button
              onClick={handleCopyCsv}
              disabled={loading || !workoutData}
              title={`คัดลอกรายละเอียดการวิ่งเป็น CSV (garmin_${workoutData?.session_date || selectedDate}_WU_Main_CD_all_laps.csv)`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                borderRadius: 8,
                fontSize: '0.75rem',
                fontWeight: 600,
                color: copiedCsv ? '#059669' : 'var(--color-foreground)',
                border: copiedCsv ? '1px solid #059669' : '1px solid var(--color-border-muted)',
                background: copiedCsv ? 'rgba(127,219,182,0.2)' : 'var(--color-bg-surface)',
                cursor: loading || !workoutData ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {copiedCsv ? <Check size={13} weight="bold" /> : <Copy size={13} />}
              <span>{copiedCsv ? 'Copied CSV!' : 'Copy CSV'}</span>
            </button>

            {/* Download CSV Button */}
            <button
              onClick={handleDownloadCsv}
              disabled={loading || !workoutData}
              title={`ดาวน์โหลดไฟล์ CSV (garmin_${workoutData?.session_date || selectedDate}_WU_Main_CD_all_laps.csv)`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 9px',
                borderRadius: 8,
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border-muted)',
                background: 'var(--color-bg-surface)',
                cursor: loading || !workoutData ? 'not-allowed' : 'pointer',
              }}
            >
              <DownloadSimple size={13} />
              <span>.csv</span>
            </button>

            <button
              onClick={() => fetchWorkoutDetails(selectedDate, true)}
              disabled={refreshing || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderRadius: 8,
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-primary)',
                border: '1px solid rgba(255,143,163,0.3)',
                background: 'var(--color-primary-soft)',
                cursor: refreshing ? 'not-allowed' : 'pointer',
              }}
            >
              <ArrowsClockwise size={12} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Re-sync'}</span>
            </button>
          </div>
        </div>

        {/* ---- 3. TAB CONTROLS ---- */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 16,
            borderBottom: '1px solid var(--color-border-muted)',
            paddingBottom: 8,
          }}
        >
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 100,
              fontSize: '0.8125rem',
              fontWeight: activeTab === 'overview' ? 700 : 500,
              fontFamily: "'Baloo 2', sans-serif",
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'overview' ? 'var(--color-primary)' : 'rgba(255,143,163,0.08)',
              color: activeTab === 'overview' ? '#FFFFFF' : 'var(--color-text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <Gauge size={14} weight={activeTab === 'overview' ? 'fill' : 'regular'} />
            <span>Overview & Metrics</span>
          </button>

          <button
            onClick={() => setActiveTab('splits')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 100,
              fontSize: '0.8125rem',
              fontWeight: activeTab === 'splits' ? 700 : 500,
              fontFamily: "'Baloo 2', sans-serif",
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'splits' ? 'var(--color-primary)' : 'rgba(255,143,163,0.08)',
              color: activeTab === 'splits' ? '#FFFFFF' : 'var(--color-text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <Timer size={14} weight={activeTab === 'splits' ? 'fill' : 'regular'} />
            <span>Splits & Lap {laps.length > 0 && `(${laps.length})`}</span>
          </button>

          <button
            onClick={() => setActiveTab('zones')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 100,
              fontSize: '0.8125rem',
              fontWeight: activeTab === 'zones' ? 700 : 500,
              fontFamily: "'Baloo 2', sans-serif",
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'zones' ? 'var(--color-primary)' : 'rgba(255,143,163,0.08)',
              color: activeTab === 'zones' ? '#FFFFFF' : 'var(--color-text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <Heart size={14} weight={activeTab === 'zones' ? 'fill' : 'regular'} />
            <span>Heart Rate Zones</span>
          </button>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
            <ArrowsClockwise size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            <p style={{ margin: 0, fontSize: '0.875rem' }}>กำลังโหลดรายละเอียดการวิ่งจากฐานข้อมูล...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && errorMsg && !workoutData && (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              borderRadius: 14,
              background: 'rgba(255,143,163,0.08)',
              border: '1px dashed var(--color-border)',
            }}
          >
            <Footprints size={32} color="var(--color-primary)" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
            <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-foreground)' }}>
              {errorMsg}
            </p>
            <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              กรุณากดเลือกวันที่มีจุดสีในปฏิทินด้านบน หรือกดปุ่ม Recent Runs
            </p>
            {recentRunDates[0] && (
              <button
                onClick={() => setSelectedDate(recentRunDates[0])}
                style={{
                  padding: '6px 14px',
                  borderRadius: 100,
                  background: 'var(--color-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ไปยังกิจกรรมล่าสุด ({thaiDate(recentRunDates[0])})
              </button>
            )}
          </div>
        )}

        {/* ---- 4. TAB CONTENTS ---- */}
        {!loading && workoutData && (
          <div>
            {/* ========================================================================= */}
            {/* TAB 1: OVERVIEW & METRICS                                                 */}
            {/* ========================================================================= */}
            {activeTab === 'overview' && (
              <div>
                {/* Core 6 Metrics Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <MetricCard
                    label="Distance"
                    value={summary.distance_km != null ? `${Number(summary.distance_km).toFixed(2)}` : '--'}
                    unit="km"
                    color="var(--color-primary)"
                  />
                  <MetricCard
                    label="Avg Pace"
                    value={summary.avg_pace || '--'}
                    unit="/km"
                    sub={summary.best_pace ? `Best: ${summary.best_pace}` : undefined}
                    color="#FBBF24"
                  />
                  <MetricCard
                    label="Duration"
                    value={summary.moving_duration_formatted || summary.duration_formatted || '--'}
                    unit=""
                    sub={summary.elapsed_duration_formatted ? `Elapsed: ${summary.elapsed_duration_formatted}` : undefined}
                    color="#60A5FA"
                  />
                  <MetricCard
                    label="Avg Heart Rate"
                    value={summary.avg_hr != null ? `${Math.round(summary.avg_hr)}` : '--'}
                    unit="bpm"
                    sub={summary.max_hr ? `Max: ${summary.max_hr} bpm` : undefined}
                    color="#EF4444"
                  />
                  <MetricCard
                    label="Avg Speed"
                    value={summary.avg_speed_kph != null ? `${Number(summary.avg_speed_kph).toFixed(1)}` : '--'}
                    unit="km/h"
                    sub={summary.max_speed_kph ? `Max: ${summary.max_speed_kph} km/h` : undefined}
                    color="#34D399"
                  />
                  <MetricCard
                    label="Calories"
                    value={summary.calories != null ? `${Math.round(summary.calories)}` : '--'}
                    unit="kcal"
                    sub={summary.steps ? `${summary.steps.toLocaleString()} steps` : undefined}
                    color="#F97316"
                  />
                </div>

                {/* Detailed Analytics Grid: Dynamics + Physiology + Environmental */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  {/* Advanced Running Dynamics */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-muted)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <Footprints size={16} color="var(--color-primary)" weight="fill" />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: "'Baloo 2', sans-serif" }}>
                        Running Dynamics
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <DetailRow
                        label="Cadence (รอบขา)"
                        val={summary.avg_cadence ? `${Math.round(summary.avg_cadence)} spm` : '--'}
                        sub={summary.max_cadence ? `Max: ${Math.round(summary.max_cadence)} spm` : undefined}
                      />
                      <DetailRow
                        label="Stride Length (ระยะก้าว)"
                        val={summary.avg_stride_length_m ? `${Number(summary.avg_stride_length_m).toFixed(2)} m` : '--'}
                      />
                      <DetailRow
                        label="Ground Contact Time (GCT)"
                        val={summary.avg_ground_contact_time_ms ? `${Math.round(summary.avg_ground_contact_time_ms)} ms` : '--'}
                      />
                      <DetailRow
                        label="Vertical Oscillation (เด้งตัว)"
                        val={summary.avg_vertical_oscillation_cm ? `${Number(summary.avg_vertical_oscillation_cm).toFixed(1)} cm` : '--'}
                      />
                      <DetailRow
                        label="Vertical Ratio (สัดส่วนเด้ง)"
                        val={summary.avg_vertical_ratio_percent ? `${Number(summary.avg_vertical_ratio_percent).toFixed(1)} %` : '--'}
                      />
                    </div>
                  </div>

                  {/* Training Effect & Physiology */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-muted)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <Lightning size={16} color="#FBBF24" weight="fill" />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: "'Baloo 2', sans-serif" }}>
                        Training Effect & Body
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <DetailRow
                        label="Training Effect Label"
                        val={summary.training_effect_label || workoutData.activity_type || '--'}
                      />
                      <DetailRow
                        label="Aerobic TE"
                        val={summary.aerobic_training_effect != null ? `${summary.aerobic_training_effect}` : '--'}
                      />
                      <DetailRow
                        label="Anaerobic TE"
                        val={summary.anaerobic_training_effect != null ? `${summary.anaerobic_training_effect}` : '--'}
                      />
                      <DetailRow
                        label="Body Battery Drain"
                        val={summary.body_battery_drain != null ? `${summary.body_battery_drain}` : '--'}
                      />
                      <DetailRow
                        label="Elevation Gain / Loss"
                        val={`+${summary.elevation_gain_m || 0} m / -${summary.elevation_loss_m || 0} m`}
                      />
                    </div>
                  </div>

                  {/* Weather & Gear */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-muted)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <Thermometer size={16} color="#60A5FA" weight="fill" />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: "'Baloo 2', sans-serif" }}>
                        Environment & Gear
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {weather ? (
                        <>
                          <DetailRow
                            label="Condition"
                            val={weather.condition || weather.weather_type || 'Mostly Cloudy'}
                          />
                          <DetailRow
                            label="Temperature"
                            val={weather.temp_c != null ? `${weather.temp_c}°C` : (weather.temp ? `${weather.temp}°F` : '--')}
                            sub={weather.feels_like_c ? `Feels like: ${weather.feels_like_c}°C` : undefined}
                          />
                          <DetailRow
                            label="Humidity & Wind"
                            val={`${weather.humidity || weather.relativeHumidity || '--'}% | ${weather.wind_speed || weather.windSpeed || 0} mph`}
                          />
                        </>
                      ) : (
                        <DetailRow label="Weather" val="ไม่พบข้อมูลสภาพอากาศ" />
                      )}

                      {gear && gear.length > 0 ? (
                        <DetailRow
                          label="Shoes (รองเท้า)"
                          val={gear[0]?.name || gear[0]?.customMakeModel || 'Running Shoes'}
                        />
                      ) : (
                        <DetailRow label="Gear" val="Garmin Watch" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: SPLITS & LAP                                                       */}
            {/* ========================================================================= */}
            {activeTab === 'splits' && (
              <div>
                {laps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
                    <Timer size={32} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>
                      ไม่มีข้อมูล Lap ย่อยในกิจกรรมนี้ (เป็นบันทึกแบบสรุปภาพรวม)
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* Header Summary */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: 'rgba(255,143,163,0.1)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                          บันทึกทั้งหมด {laps.length} Laps
                        </span>
                        {fastestLapIndex && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>
                            ⚡ Fastest: Lap {fastestLapIndex}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={handleCopyCsv}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 10px',
                          borderRadius: 6,
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: copiedCsv ? '#059669' : 'var(--color-primary)',
                          background: 'var(--color-bg-surface)',
                          border: '1px solid rgba(255,143,163,0.3)',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedCsv ? <Check size={12} weight="bold" /> : <Copy size={12} />}
                        <span>{copiedCsv ? 'Copied Laps CSV!' : 'Copy CSV'}</span>
                      </button>
                    </div>

                    {/* Laps Table Container */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                        <thead>
                          <tr
                            style={{
                              borderBottom: '2px solid var(--color-border-muted)',
                              textAlign: 'left',
                              color: 'var(--color-text-muted)',
                              fontFamily: "'Baloo 2', sans-serif",
                            }}
                          >
                            <th style={{ padding: '8px 6px' }}>Lap</th>
                            <th style={{ padding: '8px 6px' }}>Dist</th>
                            <th style={{ padding: '8px 6px' }}>Time</th>
                            <th style={{ padding: '8px 6px' }}>Pace</th>
                            <th style={{ padding: '8px 6px' }}>Avg HR</th>
                            <th style={{ padding: '8px 6px' }}>Cadence</th>
                            <th style={{ padding: '8px 6px' }}>GCT</th>
                            <th style={{ padding: '8px 6px' }}>Stride</th>
                          </tr>
                        </thead>
                        <tbody>
                          {laps.map((l: any, i: number) => {
                            const isFastest = l.lap_index === fastestLapIndex;
                            const distKm = l.distance_km != null ? Number(l.distance_km).toFixed(2) : (l.distance_meters ? (l.distance_meters / 1000).toFixed(2) : '--');
                            return (
                              <tr
                                key={l.lap_index ?? i}
                                style={{
                                  borderBottom: '1px solid var(--color-border-muted)',
                                  background: isFastest ? 'rgba(127,219,182,0.1)' : 'transparent',
                                }}
                              >
                                <td style={{ padding: '8px 6px', fontWeight: 700, fontFamily: "'Baloo 2', sans-serif" }}>
                                  {isFastest ? `⚡ Lap ${l.lap_index ?? i + 1}` : `Lap ${l.lap_index ?? i + 1}`}
                                </td>
                                <td style={{ padding: '8px 6px' }}>{distKm} km</td>
                                <td style={{ padding: '8px 6px' }}>{l.duration_formatted || formatDuration(l.duration_seconds || 0)}</td>
                                <td style={{ padding: '8px 6px', fontWeight: 600, color: 'var(--color-primary)' }}>
                                  {l.avg_pace || '--'}
                                </td>
                                <td style={{ padding: '8px 6px' }}>{l.avg_hr ? `${Math.round(l.avg_hr)} bpm` : '--'}</td>
                                <td style={{ padding: '8px 6px' }}>{l.avg_cadence ? `${Math.round(l.avg_cadence)} spm` : '--'}</td>
                                <td style={{ padding: '8px 6px' }}>{l.avg_ground_contact_time_ms ? `${Math.round(l.avg_ground_contact_time_ms)}ms` : '--'}</td>
                                <td style={{ padding: '8px 6px' }}>{l.avg_stride_length_m ? `${Number(l.avg_stride_length_m).toFixed(2)}m` : '--'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: HEART RATE ZONES                                                   */}
            {/* ========================================================================= */}
            {activeTab === 'zones' && (
              <div>
                {hrZonesData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
                    <Heart size={32} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>
                      ไม่มีข้อมูลการแบ่งโซนหัวใจในกิจกรรมนี้
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* Zone composite color bar */}
                    <div
                      style={{
                        display: 'flex',
                        height: 16,
                        borderRadius: 100,
                        overflow: 'hidden',
                        marginBottom: 16,
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
                      }}
                    >
                      {hrZonesData.map((z: any) => {
                        const pct = Number(z.percentage) || 0;
                        if (pct <= 0) return null;
                        const zColors: Record<number, string> = {
                          1: 'var(--zone-1)',
                          2: 'var(--zone-2)',
                          3: 'var(--zone-3)',
                          4: 'var(--zone-4)',
                          5: 'var(--zone-5)',
                        };
                        const color = zColors[z.zone_number] || 'var(--color-primary)';
                        return (
                          <div
                            key={z.zone_number}
                            title={`${z.zone_name}: ${pct}%`}
                            style={{
                              width: `${pct}%`,
                              background: color,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Zone List Breakdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {hrZonesData.map((z: any) => {
                        const zColors: Record<number, string> = {
                          1: 'var(--zone-1)',
                          2: 'var(--zone-2)',
                          3: 'var(--zone-3)',
                          4: 'var(--zone-4)',
                          5: 'var(--zone-5)',
                        };
                        const color = zColors[z.zone_number] || 'var(--color-primary)';
                        const pct = Number(z.percentage) || 0;
                        return (
                          <div
                            key={z.zone_number}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 12,
                              background: 'var(--color-bg-elevated)',
                              borderLeft: `4px solid ${color}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    fontSize: '0.875rem',
                                    fontFamily: "'Baloo 2', sans-serif",
                                    color: 'var(--color-foreground)',
                                  }}
                                >
                                  {z.zone_name || `Zone ${z.zone_number}`}
                                </span>
                                {z.min_bpm && (
                                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                                    (≥ {z.min_bpm} bpm)
                                  </span>
                                )}
                              </div>

                              {/* Progress Track */}
                              <div
                                style={{
                                  width: '100%',
                                  height: 6,
                                  borderRadius: 100,
                                  background: 'rgba(255,143,163,0.15)',
                                  overflow: 'hidden',
                                  marginTop: 6,
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(100, pct)}%`,
                                    height: '100%',
                                    background: color,
                                    borderRadius: 100,
                                  }}
                                />
                              </div>
                            </div>

                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: '0.9375rem',
                                  fontFamily: "'Baloo 2', sans-serif",
                                  color: 'var(--color-foreground)',
                                }}
                              >
                                {z.duration_formatted || formatDuration(z.seconds_in_zone || 0)}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color,
                                  fontFamily: "'Baloo 2', sans-serif",
                                }}
                              >
                                {pct.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helpers
function MetricCard({
  label,
  value,
  unit,
  sub,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  sub?: string;
  color: string;
}) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 12,
        background: 'var(--color-bg-surface)',
        borderLeft: `3px solid ${color}`,
        borderTop: '1px solid var(--color-border-muted)',
        borderRight: '1px solid var(--color-border-muted)',
        borderBottom: '1px solid var(--color-border-muted)',
      }}
    >
      <span
        style={{
          display: 'block',
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          fontFamily: "'Baloo 2', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
        <span
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            fontFamily: "'Baloo 2', sans-serif",
            color: 'var(--color-foreground)',
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <span
          style={{
            display: 'block',
            fontSize: '0.6875rem',
            color: 'var(--color-text-muted)',
            marginTop: 3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

function DetailRow({ label, val, sub }: { label: string; val: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontWeight: 600, color: 'var(--color-foreground)', fontFamily: "'Baloo 2', sans-serif" }}>
          {val}
        </span>
        {sub && (
          <span style={{ display: 'block', fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function buildWorkoutCsv(workoutData: any): string {
  if (workoutData?.csv_exports?.combined_csv) {
    return workoutData.csv_exports.combined_csv;
  }

  const summary = workoutData?.summary || {};
  const laps = workoutData?.laps || [];
  const actName = workoutData?.activity_name || workoutData?.title || 'Running Activity';
  const startTime = workoutData?.start_time_local || workoutData?.session_date || '';
  const actType = workoutData?.activity_type || 'running';
  const partTag = workoutData?.part_type || (workoutData?.is_multi_session ? 'All Parts' : 'Part 1');

  const sumCols = [
    'Part', 'Activity Type', 'Date', 'Title', 'Distance (km)', 'Duration',
    'Moving Duration', 'Elapsed Duration', 'Avg Pace (min/km)', 'Best Pace (min/km)',
    'Avg Speed (km/h)', 'Max Speed (km/h)', 'Avg HR (bpm)', 'Max HR (bpm)',
    'Avg Cadence (spm)', 'Max Cadence (spm)', 'Calories (kcal)', 'Elevation Gain (m)',
    'Elevation Loss (m)', 'Min Elevation (m)', 'Max Elevation (m)',
    'Avg Stride Length (m)', 'Avg Ground Contact Time (ms)', 'Avg Vertical Oscillation (cm)',
    'Avg Vertical Ratio (%)', 'Aerobic TE', 'Anaerobic TE', 'TE Label',
    'Body Battery Drain', 'Steps',
  ];

  const sumVals = [
    `"${partTag}"`,
    `"${actType}"`,
    `"${startTime}"`,
    `"${actName}"`,
    String(summary.distance_km ?? ''),
    `"${summary.duration_formatted ?? ''}"`,
    `"${summary.moving_duration_formatted ?? summary.duration_formatted ?? ''}"`,
    `"${summary.elapsed_duration_formatted ?? summary.duration_formatted ?? ''}"`,
    `"${summary.avg_pace ?? ''}"`,
    `"${summary.best_pace ?? ''}"`,
    String(summary.avg_speed_kph ?? ''),
    String(summary.max_speed_kph ?? ''),
    String(summary.avg_hr ?? ''),
    String(summary.max_hr ?? ''),
    String(summary.avg_cadence ?? ''),
    String(summary.max_cadence ?? ''),
    String(summary.calories ?? ''),
    String(summary.elevation_gain_m ?? ''),
    String(summary.elevation_loss_m ?? ''),
    String(summary.min_elevation_m ?? ''),
    String(summary.max_elevation_m ?? ''),
    String(summary.avg_stride_length_m ?? ''),
    String(summary.avg_ground_contact_time_ms ?? ''),
    String(summary.avg_vertical_oscillation_cm ?? ''),
    String(summary.avg_vertical_ratio_percent ?? ''),
    String(summary.aerobic_training_effect ?? ''),
    String(summary.anaerobic_training_effect ?? ''),
    `"${summary.training_effect_label ?? ''}"`,
    String(summary.body_battery_drain ?? ''),
    String(summary.steps ?? ''),
  ];

  let out = `# GARMIN ACTIVITY SUMMARY - ${partTag}\n${sumCols.join(',')}\n${sumVals.join(',')}`;

  if (laps && laps.length > 0) {
    const lapCols = [
      'Part', 'Lap', 'Distance (km)', 'Duration', 'Moving Duration', 'Avg Pace (min/km)',
      'Avg Speed (km/h)', 'Avg HR (bpm)', 'Max HR (bpm)', 'Avg Cadence (spm)',
      'Max Cadence (spm)', 'Elevation Gain (m)', 'Elevation Loss (m)',
      'Avg Stride Length (m)', 'Avg GCT (ms)', 'Avg Vertical Oscillation (cm)',
      'Avg Vertical Ratio (%)', 'Calories (kcal)',
    ];
    const lapRows = [lapCols.join(',')];
    for (const l of laps) {
      const pTag = l.part_name || l.part_label || actName;
      lapRows.push([
        `"${pTag}"`,
        String(l.lap_index ?? ''),
        String(l.distance_km ?? ''),
        `"${l.duration_formatted ?? ''}"`,
        `"${l.moving_duration_formatted ?? l.duration_formatted ?? ''}"`,
        `"${l.avg_pace ?? ''}"`,
        String(l.avg_speed_kph ?? ''),
        String(l.avg_hr ?? ''),
        String(l.max_hr ?? ''),
        String(l.avg_cadence ?? ''),
        String(l.max_cadence ?? ''),
        String(l.elevation_gain_m ?? ''),
        String(l.elevation_loss_m ?? ''),
        String(l.avg_stride_length_m ?? ''),
        String(l.avg_ground_contact_time_ms ?? ''),
        String(l.avg_vertical_oscillation_cm ?? ''),
        String(l.avg_vertical_ratio_percent ?? ''),
        String(l.calories ?? ''),
      ].join(','));
    }
    out += `\n\n# LAPS / SPLITS BREAKDOWN\n${lapRows.join('\n')}`;
  }

  return out;
}
