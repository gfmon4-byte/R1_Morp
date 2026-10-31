'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import {
  Timer,
  Gauge,
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  Sparkle,
  Footprints,
  Lightning,
  Thermometer,
  Check,
  Copy,
  Heart,
} from '@phosphor-icons/react';
import type { Activity } from '@/lib/supabase';
import type { HRZone } from '@/lib/hrZones';
import { supabase } from '@/lib/supabase';
import { IconBolt } from '@/components/Icons';
import GarminRunCard, { ShoeInfo } from './GarminRunCard';
import styles from './WorkoutDetailSection.module.css';

// Garmin HR Zone Configuration (Matching Garmin Connect & RunMorp)
export const GARMIN_HR_ZONE_CONFIG: Record<number, { name: string; color: string; label: string }> = {
  1: { name: 'Warm Up', color: '#0284C7', label: 'Z1' },
  2: { name: 'Easy / Fat Burn', color: '#10B981', label: 'Z2' },
  3: { name: 'Aerobic', color: '#F59E0B', label: 'Z3' },
  4: { name: 'Threshold', color: '#EF4444', label: 'Z4' },
  5: { name: 'Maximum', color: '#A855F7', label: 'Z5' },
};

function getZoneForBpm(bpm: number, garminHrZones?: any[], profileHrZones?: any[]) {
  if (!bpm) return null;

  // 1. ALWAYS prioritize Profile HR Zones (Garmin Venu 3 running zones from user profile)
  if (Array.isArray(profileHrZones) && profileHrZones.length > 0) {
    const sorted = [...profileHrZones].sort((a, b) => (b.minBpm ?? b.min_bpm ?? 0) - (a.minBpm ?? a.min_bpm ?? 0));
    for (const z of sorted) {
      const threshold = z.minBpm ?? z.min_bpm;
      if (threshold != null && bpm >= threshold) {
        const zNum = z.zone ?? z.zoneNumber ?? 1;
        const conf = GARMIN_HR_ZONE_CONFIG[zNum] || GARMIN_HR_ZONE_CONFIG[1];
        return {
          zoneNumber: zNum,
          name: conf.name,
          color: conf.color,
          label: conf.label,
        };
      }
    }
  }

  // 2. Fallback to valid Garmin Activity HR zones (>= 90 bpm running zones)
  if (Array.isArray(garminHrZones) && garminHrZones.length > 0) {
    const valid = garminHrZones.filter((z) => (z.min_bpm != null && z.min_bpm >= 90) || (z.zoneLowBoundary != null && z.zoneLowBoundary >= 90));
    if (valid.length > 0) {
      const sorted = [...valid].sort(
        (a, b) => (b.min_bpm ?? b.zoneLowBoundary ?? 0) - (a.min_bpm ?? a.zoneLowBoundary ?? 0)
      );
      for (const z of sorted) {
        const threshold = z.min_bpm ?? z.zoneLowBoundary;
        if (bpm >= threshold) {
          const zNum = z.zone_number ?? z.zoneNumber ?? 1;
          const conf = GARMIN_HR_ZONE_CONFIG[zNum] || GARMIN_HR_ZONE_CONFIG[1];
          return {
            zoneNumber: zNum,
            name: conf.name,
            color: conf.color,
            label: conf.label,
          };
        }
      }
    }
  }

  const conf = GARMIN_HR_ZONE_CONFIG[1];
  return {
    zoneNumber: 1,
    name: conf.name,
    color: conf.color,
    label: conf.label,
  };
}

function DetailRow({ label, val, sub }: { label: string; val: React.ReactNode; sub?: string }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <div>
        <span className={styles.detailValue}>{val}</span>
        {sub && <span className={styles.detailSub}>{sub}</span>}
      </div>
    </div>
  );
}

function resolveShoeInfo(gearList: any[], garminGearList: any[] = []): ShoeInfo {
  if (!Array.isArray(gearList) || gearList.length === 0) {
    return {
      hasShoe: false,
      title: 'ไม่ได้ระบุรองเท้า',
      subtitle: 'ไม่มีข้อมูลรองเท้าใน Garmin Connect',
      brandModel: null,
      nickname: null,
      totalDistanceKm: null,
      wearPct: null,
    };
  }

  const primary = gearList[0];
  const rawName =
    primary.customMakeModel ||
    primary.displayName ||
    primary.gear_name ||
    primary.name ||
    primary.model ||
    (primary.gearPk ? `Gear #${primary.gearPk}` : 'รองเท้าวิ่ง Garmin');
  const uuid = primary.uuid;

  let matched: any = null;
  if (Array.isArray(garminGearList) && garminGearList.length > 0) {
    if (uuid) {
      matched = garminGearList.find((g) => g.uuid && g.uuid.toLowerCase() === uuid.toLowerCase());
    }
    if (!matched && rawName) {
      const lowerRaw = rawName.toLowerCase().trim();
      matched = garminGearList.find((g) => {
        const b = (g.brand_model || '').toLowerCase().trim();
        const n = (g.name || '').toLowerCase().trim();
        return (
          (b && (lowerRaw.includes(b) || b.includes(lowerRaw))) ||
          (n && (lowerRaw.includes(n) || n.includes(lowerRaw)))
        );
      });
    }
  }

  const brandModel =
    matched?.brand_model ||
    primary.customMakeModel ||
    primary.displayName ||
    primary.gear_name ||
    primary.name ||
    primary.model ||
    'รองเท้าวิ่ง Garmin';
  const nickname = matched?.name || primary.nickname || primary.displayName || null;
  const totalKm = matched?.distance_km ?? primary.total_distance_km ?? null;
  const wearPct = matched?.wear_pct ?? primary.wear_pct ?? null;

  const subParts: string[] = [];
  if (nickname && nickname !== brandModel) subParts.push(`"${nickname}"`);
  if (totalKm != null && !isNaN(Number(totalKm))) subParts.push(`วิ่งสะสม ${Number(totalKm).toFixed(1)} km`);
  if (wearPct != null && !isNaN(Number(wearPct))) subParts.push(`ใช้งานแล้ว ${Math.round(Number(wearPct))}%`);

  return {
    hasShoe: true,
    title: brandModel,
    subtitle: subParts.length > 0 ? subParts.join(' · ') : 'รองเท้าวิ่ง Garmin',
    brandModel,
    nickname,
    totalDistanceKm: totalKm,
    wearPct,
  };
}

function buildWorkoutCsv(workoutData: any): string {
  if (!workoutData) return '';

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
    `"${summary.moving_duration_formatted ?? ''}"`,
    `"${summary.elapsed_duration_formatted ?? ''}"`,
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

  const summaryCsv = `${sumCols.join(',')}\n${sumVals.join(',')}`;

  let lapsCsv = '';
  if (Array.isArray(laps) && laps.length > 0) {
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
      const row = [
        `"${pTag}"`,
        String(l.lap_index ?? ''),
        String(l.distance_km ?? ''),
        `"${l.duration_formatted ?? ''}"`,
        `"${l.moving_duration_formatted ?? ''}"`,
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
      ];
      lapRows.push(row.join(','));
    }
    lapsCsv = lapRows.join('\n');
  }

  return `# GARMIN WORKOUT SESSION SUMMARY\n${summaryCsv}\n\n# LAPS / SPLITS BREAKDOWN\n${lapsCsv}`;
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function thaiDate(dateStr?: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  const monthIdx = parseInt(m, 10) - 1;
  const thaiYear = parseInt(y, 10) + 543;
  return `${parseInt(d, 10)} ${THAI_MONTHS_SHORT[monthIdx]} ${thaiYear}`;
}

function thaiToday() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  return format(now, 'yyyy-MM-dd');
}

function formatPace(seconds?: number | null) {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function toLocalDateStr(dateInput: string | Date): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const s = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.includes('T')) {
      try {
        const d = parseISO(s);
        return format(d, 'yyyy-MM-dd');
      } catch {
        return s.slice(0, 10);
      }
    }
    return s.slice(0, 10);
  }
  return format(dateInput, 'yyyy-MM-dd');
}

function getSessionColor(sessionType: string): string {
  const t = (sessionType || '').toLowerCase();
  if (t.includes('easy') || t.includes('recovery')) return '#10B981';
  if (t.includes('interval') || t.includes('speed') || t.includes('tempo')) return '#EF4444';
  if (t.includes('long')) return '#6366F1';
  if (t.includes('treadmill')) return '#06B6D4';
  return '#FF8FA3';
}

interface Props {
  activities: Activity[];
  hrZones?: HRZone[];
  data?: any;
  garminGear?: any[];
}

export function WorkoutDetailSection({ activities, hrZones, data = null, garminGear = [] }: Props) {
  const [localActivities, setLocalActivities] = useState<Activity[]>(activities);
  const [syncingNewRuns, setSyncingNewRuns] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<'all' | number>('all');

  // Compute latest date that actually has an activity recorded
  const latestDateWithActivity = useMemo(() => {
    if (!localActivities || localActivities.length === 0) {
      return thaiToday();
    }
    const sorted = [...localActivities]
      .filter((a) => a.date)
      .sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.date ? toLocalDateStr(sorted[0].date) : thaiToday();
  }, [localActivities]);

  const [selectedDate, setSelectedDate] = useState<string>(latestDateWithActivity);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    try {
      return parseISO(latestDateWithActivity);
    } catch {
      return new Date();
    }
  });

  const [activeTab, setActiveTab] = useState<'splits' | 'overview'>('splits');
  const [splitsViewMode, setSplitsViewMode] = useState<'bars' | 'table'>('bars');
  const [workoutData, setWorkoutData] = useState<any>(data || null);
  const [loading, setLoading] = useState<boolean>(!data);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCsv, setCopiedCsv] = useState<boolean>(false);

  // Group activities by date string "YYYY-MM-DD" in Bangkok timezone
  const activitiesByDate = useMemo(() => {
    const map: Record<string, Activity[]> = {};
    for (const a of localActivities || []) {
      if (!a.date) continue;
      const dt = toLocalDateStr(a.date);
      if (!dt) continue;
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

  // Handler to sync newly recorded Garmin runs from Garmin API
  const handleSyncGarminRuns = async () => {
    try {
      setSyncingNewRuns(true);
      setSyncToast(null);

      const res = await fetch('/api/garmin-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      const resData = await res.json();

      if (res.ok && resData.status !== 'error') {
        const { data: refreshedActs } = await supabase
          .from('activities')
          .select('*')
          .order('date', { ascending: false });

        if (refreshedActs && refreshedActs.length > 0) {
          setLocalActivities(refreshedActs);
          const newest = toLocalDateStr(refreshedActs[0].date);
          setSelectedDate(newest);
          try {
            setCalendarMonth(parseISO(newest));
          } catch { }
          fetchWorkoutDetails(newest, true);
        }

        const count = resData.synced_count ?? resData.activities?.inserted ?? 0;
        if (count > 0) {
          setSyncToast(`ซิงค์สำเร็จ 100%! พบการวิ่งใหม่ ${count} รายการ`);
        } else {
          setSyncToast(`ข้อมูลเป็นปัจจุบัน 100% แล้ว`);
        }
      } else {
        setSyncToast(resData.error || resData.message || 'การซิงค์ล้มเหลว');
      }
    } catch (e: any) {
      setSyncToast(e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Garmin');
    } finally {
      setSyncingNewRuns(false);
      setTimeout(() => setSyncToast(null), 5000);
    }
  };

  const handleCopyCsv = async () => {
    if (!workoutData) return;
    const dataToExport =
      selectedPart !== 'all' && workoutData.parts?.[selectedPart]
        ? workoutData.parts[selectedPart]
        : workoutData;
    const csvContent = buildWorkoutCsv(dataToExport);
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
    const dataToExport =
      selectedPart !== 'all' && workoutData.parts?.[selectedPart]
        ? workoutData.parts[selectedPart]
        : workoutData;
    const csvContent = buildWorkoutCsv(dataToExport);
    const dateStr = workoutData.session_date || selectedDate || 'workout';
    const partSuffix = selectedPart !== 'all' ? `_part${Number(selectedPart) + 1}` : '_all_parts';
    const fileName = `garmin_${dateStr}${partSuffix}_laps.csv`;
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

  // Fetch workout details from API (checks DB first, falls back to Garmin API)
  const fetchWorkoutDetails = useCallback(async (dateStr: string, forceFresh = false) => {
    if (!dateStr) return;
    try {
      if (forceFresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMsg(null);

      const url = `/api/garmin-last-run?date=${dateStr}${forceFresh ? '&fresh=true' : ''}`;
      const res = await fetch(url);
      const resData = await res.json();

      if (resData && resData.status === 'success') {
        setWorkoutData(resData);
      } else {
        // Fallback to checking local activities array if API returned an error
        const localActs = activitiesByDate[dateStr];
        if (localActs && localActs.length > 0) {
          const act = localActs[0];
          const distKm = Number(act.distance_km != null ? act.distance_km : (act as any).distance) || 0;
          const durSec = Number(act.duration_seconds) || 0;
          const paceSec = act.avg_pace_sec_per_km;
          const avgPace = act.avg_pace || (paceSec ? formatPace(paceSec) : '--');
          const avgSpd = paceSec && paceSec > 0
            ? Math.round((3600 / paceSec) * 10) / 10
            : (durSec > 0 && distKm > 0 ? Math.round((distKm / (durSec / 3600)) * 10) / 10 : null);

          setWorkoutData({
            status: 'success',
            activity_id: act.id || (act as any).garmin_activity_id,
            activity_name: act.title || act.route_name || act.session_type || 'Running Activity',
            activity_type: act.session_type || 'Running',
            session_date: dateStr,
            start_time_local: act.date ? String(act.date).slice(0, 19) : `${dateStr}T06:00:00.0`,
            location_name: act.route_name || 'Thailand',
            garmin_connect_url: (act as any).garmin_activity_id
              ? `https://connect.garmin.com/modern/activity/${(act as any).garmin_activity_id}`
              : null,
            summary: {
              distance_km: distKm,
              duration_seconds: durSec,
              duration_formatted: formatDuration(durSec),
              moving_duration_formatted: formatDuration(durSec),
              elapsed_duration_formatted: formatDuration(durSec),
              avg_pace: avgPace,
              best_pace: (act as any).best_pace || '--',
              avg_speed_kph: avgSpd,
              avg_hr: act.avg_hr,
              max_hr: act.max_hr,
              calories: act.calories,
              water_estimated_ml: (act as any).water_estimated_ml || (act.calories ? Math.round(act.calories * 1.4) : null),
              steps: act.steps,
              avg_cadence: act.avg_cadence,
              avg_stride_length_m: act.avg_stride_length,
              avg_ground_contact_time_ms: act.avg_ground_contact_time,
              avg_vertical_oscillation_cm: act.avg_vertical_oscillation,
              avg_vertical_ratio_percent: act.avg_vertical_ratio,
              elevation_gain_m: act.elevation_gain_m,
              body_battery_drain: act.body_battery_drain,
              aerobic_training_effect: act.aerobic_training_effect,
              anaerobic_training_effect: act.anaerobic_training_effect,
              training_effect_label: act.session_type,
            },
            hr_zones: [],
            laps: [],
            source: 'activities_local',
          });
        } else {
          setWorkoutData(null);
          setErrorMsg(resData?.error || `ไม่พบข้อมูลกิจกรรมการวิ่งในวันที่ ${dateStr}`);
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
    const today = thaiToday();
    setSelectedDate(today);
    setCalendarMonth(new Date());
  };
  const handleSelectLatest = () => {
    setSelectedDate(latestDateWithActivity);
    try {
      setCalendarMonth(parseISO(latestDateWithActivity));
    } catch { }
  };

  const activeData = useMemo(() => {
    if (!workoutData) return null;
    if (selectedPart === 'all' || !workoutData.parts || !workoutData.parts[selectedPart]) {
      return workoutData;
    }
    return workoutData.parts[selectedPart];
  }, [workoutData, selectedPart]);

  const summary = activeData?.summary || {};
  const rawHrZonesData = activeData?.hr_zones || [];
  const hrZonesData = useMemo(() => {
    if (!Array.isArray(hrZones) || hrZones.length === 0) return rawHrZonesData;
    const pMap = new Map(hrZones.map((z) => [z.zone, z]));
    return rawHrZonesData.map((z: any) => {
      const zNum = Number(z.zone_number ?? z.zoneNumber);
      const p = pMap.get(zNum);
      if (p) {
        return {
          ...z,
          min_bpm: p.minBpm,
          max_bpm: p.maxBpm,
          minBpm: p.minBpm,
          maxBpm: p.maxBpm,
        };
      }
      return z;
    });
  }, [rawHrZonesData, hrZones]);
  const laps: any[] = activeData?.laps || [];
  const weather = activeData?.weather || workoutData?.weather;

  // Estimated sweat loss (ml) from Garmin Connect API or estimation
  const sweatLoss = useMemo(() => {
    if (summary.water_estimated_ml != null) return Number(summary.water_estimated_ml);
    if (summary.waterEstimated != null) return Number(summary.waterEstimated);
    if (summary.calories) return Math.round(summary.calories * 1.4);
    return null;
  }, [summary.water_estimated_ml, summary.waterEstimated, summary.calories]);

  // Resolve gear from activeData or fallback across workoutData parts
  const gear = useMemo(() => {
    if (Array.isArray(activeData?.gear) && activeData.gear.length > 0) return activeData.gear;
    if (Array.isArray(workoutData?.gear) && workoutData.gear.length > 0) return workoutData.gear;
    if (Array.isArray(workoutData?.parts)) {
      for (const p of workoutData.parts) {
        if (Array.isArray(p.gear) && p.gear.length > 0) return p.gear;
      }
    }
    return [];
  }, [activeData, workoutData]);

  // Resolve detailed shoe information
  const shoeInfo = useMemo(() => {
    return resolveShoeInfo(gear, garminGear);
  }, [gear, garminGear]);

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

  // Pace min/max range for compact Strava-style Splits bars
  const splitsPaceRange = useMemo(() => {
    if (!laps || laps.length === 0) return { minSec: 0, maxSec: 0 };
    let minSec = Infinity;
    let maxSec = 0;
    laps.forEach((l: any) => {
      const p = l.avg_pace ? String(l.avg_pace).replace('/km', '').trim() : '';
      if (p && p.includes(':')) {
        const parts = p.split(':').map(Number);
        const total = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
        if (total > 0 && !isNaN(total)) {
          if (total < minSec) minSec = total;
          if (total > maxSec) maxSec = total;
        }
      }
    });
    if (minSec === Infinity) return { minSec: 0, maxSec: 0 };
    return { minSec, maxSec };
  }, [laps]);

  return (
    <div className={styles.container}>
      {/* Section Header */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderLeft}>
          <div className={styles.sectionIcon}>
            <IconBolt size={18} />
          </div>
          <div>
            <h2 className={styles.sectionTitle}>
              details run
            </h2>
            <p className={styles.sectionSubtitle}>
              เลือกวันที่ในปฏิทินเพื่อดู Overview และ Splits จากฐานข้อมูล
            </p>
          </div>
        </div>

        {/* Action Buttons: Sync New Runs & Jump to Latest */}
        <div className={styles.sectionHeaderRight}>
          {syncToast && (
            <span className={styles.toastBadge}>
              {syncToast}
            </span>
          )}

          <button
            onClick={handleSyncGarminRuns}
            disabled={syncingNewRuns}
            className={styles.syncBtnPrimary}
          >
            <ArrowsClockwise size={13} className={syncingNewRuns ? 'animate-spin' : ''} />
            <span>{syncingNewRuns ? 'Syncing...' : 'Sync Garmin'}</span>
          </button>

          <button
            onClick={handleSelectLatest}
            className={styles.latestBtn}
          >
            <Sparkle size={13} weight="fill" />
            <span>ล่าสุด ({latestDateWithActivity.slice(5)})</span>
          </button>
        </div>
      </div>

      {/* Main Card: Calendar + Workout Details */}
      <div className={styles.mainCard}>
        {/* ---- 1. CALENDAR CONTROLS & GRID ---- */}
        <div className={styles.calendarSectionWrap}>
          {/* Month Bar */}
          <div className={styles.calendarMonthRow}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className={styles.calendarMonthTitle}>
                {format(calendarMonth, 'MMMM yyyy')}
              </span>
              <span className={styles.calendarRunsBadge}>
                ({Object.keys(activitiesByDate).filter((d) => d.startsWith(format(calendarMonth, 'yyyy-MM'))).length} RUNS)
              </span>
            </div>

            <div className={styles.calendarNavBtns}>
              <button
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className={styles.navArrowBtn}
              >
                <CaretLeft size={14} weight="bold" />
              </button>
              <button
                onClick={handleSelectToday}
                className={styles.todayBtn}
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                aria-label="Next Month"
                className={styles.navArrowBtn}
              >
                <CaretRight size={14} weight="bold" />
              </button>
            </div>
          </div>

          {/* Weekday Labels (Mon - Sun) */}
          <div className={styles.weekdayHeaderRow}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName) => (
              <span key={dayName} className={styles.weekdayLabel}>
                {dayName}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className={styles.calendarGrid}>
            {paddedDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className={styles.emptyDayCell} />;
              }
              const dStr = format(day, 'yyyy-MM-dd');
              const isSelected = dStr === selectedDate;
              const isToday = dStr === thaiToday();
              const acts = activitiesByDate[dStr] || [];
              const hasRun = acts.length > 0;
              const totalKm = acts.reduce((s, a) => s + (Number(a.distance_km != null ? a.distance_km : (a as any).distance) || 0), 0);
              const sessionType = acts[0]?.session_type || 'Run';
              const dotColor = hasRun ? getSessionColor(sessionType) : 'transparent';

              return (
                <button
                  key={dStr}
                  onClick={() => setSelectedDate(dStr)}
                  className={`${styles.dayCell} ${hasRun ? styles.dayCellWithRun : ''} ${isToday ? styles.dayCellToday : ''} ${isSelected ? styles.dayCellSelected : ''}`}
                >
                  <span className={styles.dayNumber}>
                    {format(day, 'd')}
                  </span>

                  {hasRun && (
                    <div className={styles.dayRunMeta}>
                      <span
                        className={styles.dayRunDot}
                        style={{ background: isSelected ? '#FFFFFF' : dotColor }}
                      />
                      <span className={styles.dayDistance}>
                        {totalKm > 0 ? `${totalKm.toFixed(1)}k` : 'Run'}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Date Pills */}
          <div className={styles.recentRunsRow}>
            <span className={styles.recentRunsLabel}>
              Recent Runs:
            </span>
            {recentRunDates.map((dt) => {
              const acts = activitiesByDate[dt] || [];
              const km = acts.reduce((s, a) => s + (Number(a.distance_km != null ? a.distance_km : (a as any).distance) || 0), 0);
              const isSel = dt === selectedDate;
              return (
                <button
                  key={dt}
                  onClick={() => {
                    setSelectedDate(dt);
                    try {
                      setCalendarMonth(parseISO(dt));
                    } catch { }
                  }}
                  className={`${styles.recentChip} ${isSel ? styles.recentChipActive : ''}`}
                >
                  {thaiDate(dt)} ({km.toFixed(1)} km)
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- 2. GARMIN RUN SHOWCASE CARD ---- */}
        {!loading && workoutData && (
          <GarminRunCard
            activityName={activeData?.activity_name || workoutData?.activity_name || workoutData?.parts?.[0]?.activity_name}
            activityType={activeData?.activity_type || workoutData?.activity_type || 'Running'}
            sessionDate={selectedDate}
            startTimeLocal={activeData?.start_time_local || workoutData?.start_time_local}
            summary={summary}
            sweatLoss={sweatLoss}
            hrZones={hrZonesData}
            geoPolyline={activeData?.geo_polyline || workoutData?.geo_polyline}
            garminConnectUrl={workoutData?.garmin_connect_url}
            shoeInfo={shoeInfo}
            partType={activeData?.part_type}
            onResync={() => fetchWorkoutDetails(selectedDate, true)}
            refreshing={refreshing}
            onCopyCsv={handleCopyCsv}
            copiedCsv={copiedCsv}
            onDownloadCsv={handleDownloadCsv}
          />
        )}

        {/* Session Parts Switcher (WU / Main / CD) if multi-part */}
        {workoutData?.parts && workoutData.parts.length > 1 && (
          <div className={styles.partsBar}>
            <span className={styles.partsLabel}>Session Parts:</span>
            <button
              type="button"
              onClick={() => setSelectedPart('all')}
              className={`${styles.partPill} ${selectedPart === 'all' ? styles.partPillActive : ''}`}
            >
              All Session ({workoutData.parts.length} parts)
            </button>
            {workoutData.parts.map((p: any, idx: number) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedPart(idx)}
                className={`${styles.partPill} ${selectedPart === idx ? styles.partPillActive : ''}`}
              >
                {p.part_type || `Part ${idx + 1}`} ({p.summary?.distance_km ?? 0} km)
              </button>
            ))}
          </div>
        )}

        {/* ---- 3. TAB CONTROLS ---- */}
        <div className={styles.tabsBar}>
          <button
            onClick={() => setActiveTab('splits')}
            className={`${styles.tabBtn} ${activeTab === 'splits' ? styles.tabBtnActive : ''}`}
          >
            <Timer size={14} weight={activeTab === 'splits' ? 'fill' : 'regular'} />
            <span>Splits & Lap {laps.length > 0 && `(${laps.length})`}</span>
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.tabBtnActive : ''}`}
          >
            <Gauge size={14} weight={activeTab === 'overview' ? 'fill' : 'regular'} />
            <span>Overview & Metrics</span>
          </button>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
            <ArrowsClockwise size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--color-primary)' }} />
            <p style={{ margin: 0, fontSize: '0.85rem' }}>กำลังโหลดรายละเอียดการวิ่งจากฐานข้อมูล...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && errorMsg && !workoutData && (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              borderRadius: 14,
              background: 'var(--color-bg-elevated)',
              border: '1px dashed var(--color-border)',
            }}
          >
            <Footprints size={32} color="var(--color-primary)" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-foreground)' }}>
              {errorMsg}
            </p>
            <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              กรุณากดเลือกวันที่มีจุดสีในปฏิทินด้านบน หรือกดปุ่ม Recent Runs
            </p>
            {recentRunDates[0] && (
              <button
                onClick={() => setSelectedDate(recentRunDates[0])}
                className={styles.syncBtnPrimary}
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
            {/* TAB 1: SPLITS & LAP                                                       */}
            {/* ========================================================================= */}
            {activeTab === 'splits' && (
              <div>
                {laps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--color-text-muted)' }}>
                    <Timer size={32} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>
                      ไม่มีข้อมูล Lap ย่อยในกิจกรรมนี้ (เป็นบันทึกแบบสรุปภาพรวม)
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* Header Summary */}
                    <div className={styles.splitsSummaryHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: "'Baloo 2', sans-serif" }}>
                          {laps.length} Laps
                        </span>
                        {fastestLapIndex && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#059669',
                              background: 'rgba(127, 219, 182, 0.25)',
                              border: '1px solid rgba(127, 219, 182, 0.5)',
                              padding: '2px 8px',
                              borderRadius: 100,
                              fontFamily: "'Baloo 2', sans-serif",
                            }}
                          >
                            <IconBolt size={12} style={{ marginRight: 3, verticalAlign: -1 }} /> Fastest: Lap {fastestLapIndex}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className={styles.splitsViewSwitch}>
                          <button
                            type="button"
                            onClick={() => setSplitsViewMode('bars')}
                            className={`${styles.splitsSwitchBtn} ${splitsViewMode === 'bars' ? styles.splitsSwitchBtnActive : ''}`}
                          >
                            Bar
                          </button>
                          <button
                            type="button"
                            onClick={() => setSplitsViewMode('table')}
                            className={`${styles.splitsSwitchBtn} ${splitsViewMode === 'table' ? styles.splitsSwitchBtnActive : ''}`}
                          >
                            Table
                          </button>
                        </div>

                        <button
                          onClick={handleCopyCsv}
                          className={`${styles.actionBtnSecondary} ${copiedCsv ? styles.actionBtnSuccess : ''}`}
                        >
                          {copiedCsv ? <Check size={12} weight="bold" /> : <Copy size={12} />}
                          <span>{copiedCsv ? 'Copied Laps CSV!' : 'Copy CSV'}</span>
                        </button>
                      </div>
                    </div>

                    {splitsViewMode === 'bars' ? (
                      <div className={styles.splitsBarListWrap}>
                        {/* Column Headers: Km | Pace | Bar | Elev | HR */}
                        <div className={styles.splitsBarHeaderRow}>
                          <span className={styles.splitsColKm}>Km</span>
                          <span className={styles.splitsColPace}>Pace</span>
                          <span className={styles.splitsColBar} />
                          <span className={styles.splitsColElev}>Elev</span>
                          <span className={styles.splitsColHr}>HR</span>
                        </div>

                        {/* Compact Splits Rows */}
                        <div className={styles.splitsBarRows}>
                          {laps.map((l: any, i: number) => {
                            const kmNum = l.lap_index ?? i + 1;
                            const paceClean = l.avg_pace ? String(l.avg_pace).replace('/km', '').trim() : '--';
                            let paceSec = 0;
                            if (paceClean && paceClean.includes(':')) {
                              const parts = paceClean.split(':').map(Number);
                              paceSec = parts.length === 3
                                ? parts[0] * 3600 + parts[1] * 60 + parts[2]
                                : parts[0] * 60 + parts[1];
                            }

                            let barWidthPct = 0;
                            if (paceSec > 0) {
                              if (splitsPaceRange.maxSec <= splitsPaceRange.minSec) {
                                barWidthPct = 76;
                              } else {
                                const ratio =
                                  (splitsPaceRange.maxSec - paceSec) /
                                  (splitsPaceRange.maxSec - splitsPaceRange.minSec);
                                barWidthPct = Math.round(38 + Math.max(0, Math.min(1, ratio)) * 54);
                              }
                            }

                            const hasElev = l.elevation_gain_m != null || l.elevation_loss_m != null;
                            const gain = Math.round(Number(l.elevation_gain_m) || 0);
                            const loss = Math.round(Number(l.elevation_loss_m) || 0);
                            const netElev = hasElev ? gain - loss : 0;
                            const hrVal = l.avg_hr ? Math.round(l.avg_hr) : '--';
                            const isFastest = l.lap_index === fastestLapIndex;

                            return (
                              <div
                                key={kmNum}
                                className={`${styles.splitsBarRow} ${isFastest ? styles.splitsBarRowFastest : ''}`}
                                title={`Km ${kmNum} · Pace ${paceClean}/km · Elev ${netElev}m · HR ${hrVal} bpm`}
                              >
                                <span className={styles.splitsBarKm}>{kmNum}</span>
                                <span className={styles.splitsBarPace}>{paceClean}</span>
                                <div className={styles.splitsBarTrack}>
                                  <div
                                    className={`${styles.splitsBarFill} ${isFastest ? styles.splitsBarFillFastest : ''}`}
                                    style={{ width: `${barWidthPct}%` }}
                                  />
                                </div>
                                <span className={styles.splitsBarElev}>
                                  {hasElev ? (netElev > 0 ? `+${netElev}` : netElev) : 0}
                                </span>
                                <span className={styles.splitsBarHr}>{hrVal}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Laps Table Container */}
                        <div className={styles.tableContainer}>
                          <div className={styles.tableScrollWrapper}>
                            <table className={styles.lapsTable}>
                              <thead>
                                <tr>
                                  <th className={styles.stickyLapCell} style={{ minWidth: 80 }}>
                                    Lap
                                  </th>
                                  <th style={{ minWidth: 85 }}>Distance</th>
                                  <th style={{ minWidth: 80 }}>Time</th>
                                  <th style={{ minWidth: 80 }}>Pace</th>
                                  <th style={{ minWidth: 95 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                      <Heart size={12} weight="fill" style={{ color: '#EF4444' }} />
                                      Avg HR
                                    </span>
                                  </th>
                                  <th style={{ minWidth: 85 }}>Cadence</th>
                                  <th style={{ minWidth: 80 }}>Stride</th>
                                  <th style={{ minWidth: 80 }}>GCT</th>
                                  <th style={{ minWidth: 80 }}>Elev</th>
                                  <th style={{ minWidth: 80 }}>Calories</th>
                                </tr>
                              </thead>
                              <tbody>
                                {laps.map((l: any, i: number) => {
                                  const isFastest = l.lap_index === fastestLapIndex;
                                  const distKm = l.distance_km != null ? Number(l.distance_km).toFixed(2) : (l.distance_meters ? (l.distance_meters / 1000).toFixed(2) : '--');

                                  return (
                                    <tr
                                      key={l.lap_index ?? i}
                                      className={isFastest ? styles.fastestRow : ''}
                                    >
                                      {/* 1. Lap */}
                                      <td className={styles.stickyLapCell}>
                                        <span className={isFastest ? styles.fastestLapBadge : styles.lapBadge}>
                                          {isFastest && <IconBolt size={11} style={{ marginRight: 2, verticalAlign: -1 }} />} Lap {l.lap_index ?? i + 1}
                                        </span>
                                      </td>

                                      {/* 2. Distance */}
                                      <td style={{ whiteSpace: 'nowrap' }}>
                                        <span className={styles.cellNum}>{distKm}</span>{' '}
                                        <span className={styles.cellUnit}>km</span>
                                      </td>

                                      {/* 3. Time */}
                                      <td style={{ whiteSpace: 'nowrap' }}>
                                        <span className={styles.cellNum}>
                                          {l.duration_formatted || formatDuration(l.duration_seconds || 0)}
                                        </span>
                                      </td>

                                      {/* 4. Pace */}
                                      <td style={{ whiteSpace: 'nowrap' }}>
                                        <span className={styles.cellPace}>{l.avg_pace || '--'}</span>
                                      </td>

                                      {/* 5. Avg HR */}
                                      <td style={{ whiteSpace: 'nowrap' }}>
                                        {l.avg_hr ? (
                                          (() => {
                                            const zInfo = getZoneForBpm(l.avg_hr, hrZonesData, hrZones);
                                            return (
                                              <div
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: 4,
                                                }}
                                                title={
                                                  zInfo
                                                    ? `Zone ${zInfo.zoneNumber}: ${zInfo.name} - ${Math.round(l.avg_hr)} bpm`
                                                    : `${Math.round(l.avg_hr)} bpm`
                                                }
                                              >
                                                <span
                                                  style={{
                                                    width: 7,
                                                    height: 7,
                                                    borderRadius: '50%',
                                                    backgroundColor: zInfo?.color || '#64748B',
                                                    display: 'inline-block',
                                                    flexShrink: 0,
                                                  }}
                                                />
                                                <span className={styles.cellNum}>
                                                  {Math.round(l.avg_hr)}
                                                </span>
                                                <span className={styles.cellUnit}>
                                                  bpm
                                                </span>
                                              </div>
                                            );
                                          })()
                                        ) : (
                                          <span style={{ color: 'var(--color-text-muted)' }}>--</span>
                                        )}
                                      </td>

                                      {/* 6. Cadence */}
                                      <td style={{ whiteSpace: 'nowrap' }}>
                                        {l.avg_cadence ? (
                                          <>
                                            <span className={styles.cellNum}>{Math.round(l.avg_cadence)}</span>{' '}
                                            <span className={styles.cellUnit}>spm</span>
                                          </>
                                        ) : (
                                          '--'
                                        )}
                                      </td>

                                      {/* 7. Stride */}
                                      <td style={{ whiteSpace: 'nowrap' }}>
                                        {l.avg_stride_length_m ? (
                                          <>
                                            <span className={styles.cellNum}>{Number(l.avg_stride_length_m).toFixed(2)}</span>{' '}
                                            <span className={styles.cellUnit}>m</span>
                                          </>
                                        ) : (
                                          '--'
                                        )}
                                      </td>

                                      {/* 8. GCT */}
                                      <td style={{ whiteSpace: 'nowrap' }}>
                                        {l.avg_ground_contact_time_ms ? (
                                          <>
                                            <span className={styles.cellNum}>{Math.round(l.avg_ground_contact_time_ms)}</span>{' '}
                                            <span className={styles.cellUnit}>ms</span>
                                          </>
                                        ) : (
                                          '--'
                                        )}
                                      </td>

                                      {/* 9. Elev */}
                                      <td style={{ whiteSpace: 'nowrap' }}>
                                        {(() => {
                                          if (l.elevation_gain_m == null && l.elevation_loss_m == null) return '--';
                                          const gain = Math.round(Number(l.elevation_gain_m) || 0);
                                          const loss = Math.round(Number(l.elevation_loss_m) || 0);
                                          const net = gain - loss;
                                          const color = net > 0 ? '#059669' : net < 0 ? '#EF4444' : 'var(--color-text-muted)';
                                          const sign = net > 0 ? '+' : '';
                                          return (
                                            <span
                                              className={styles.cellNum}
                                              style={{ color }}
                                              title={`Gain: +${gain}m, Loss: -${loss}m`}
                                            >
                                              {sign}{net}{' '}
                                              <span className={styles.cellUnit}>m</span>
                                            </span>
                                          );
                                        })()}
                                      </td>

                                      {/* 10. Calories */}
                                      <td style={{ whiteSpace: 'nowrap' }}>
                                        {l.calories != null ? (
                                          <>
                                            <span className={styles.cellNum}>{Math.round(l.calories)}</span>{' '}
                                            <span className={styles.cellUnit}>kcal</span>
                                          </>
                                        ) : (
                                          '--'
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>

                              {/* Summary Footer Row */}
                              <tfoot className={styles.tableFoot}>
                                <tr>
                                  <td className={styles.stickyLapCell}>
                                    TOTAL
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    <span className={styles.cellNum}>{summary.distance_km != null ? Number(summary.distance_km).toFixed(2) : '--'}</span>{' '}
                                    <span className={styles.cellUnit}>km</span>
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    <span className={styles.cellNum}>{summary.duration_formatted || '--'}</span>
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    <span className={styles.cellPace}>{summary.avg_pace || '--'}</span>
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    {summary.avg_hr ? (
                                      (() => {
                                        const zInfo = getZoneForBpm(summary.avg_hr, hrZonesData, hrZones);
                                        return (
                                          <div
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: 4,
                                            }}
                                            title={zInfo ? `Avg Zone ${zInfo.zoneNumber}: ${zInfo.name}` : undefined}
                                          >
                                            <span
                                              style={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: '50%',
                                                backgroundColor: zInfo?.color || '#64748B',
                                                display: 'inline-block',
                                                flexShrink: 0,
                                              }}
                                            />
                                            <span className={styles.cellNum}>{Math.round(summary.avg_hr)}</span>{' '}
                                            <span className={styles.cellUnit}>bpm</span>
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      '--'
                                    )}
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    <span className={styles.cellNum}>{summary.avg_cadence ? Math.round(summary.avg_cadence) : '--'}</span>{' '}
                                    <span className={styles.cellUnit}>{summary.avg_cadence ? 'spm' : ''}</span>
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    <span className={styles.cellNum}>{summary.avg_stride_length_m ? Number(summary.avg_stride_length_m).toFixed(2) : '--'}</span>{' '}
                                    <span className={styles.cellUnit}>{summary.avg_stride_length_m ? 'm' : ''}</span>
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    <span className={styles.cellNum}>{summary.avg_ground_contact_time_ms ? Math.round(summary.avg_ground_contact_time_ms) : '--'}</span>{' '}
                                    <span className={styles.cellUnit}>{summary.avg_ground_contact_time_ms ? 'ms' : ''}</span>
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    {summary.elevation_gain_m != null ? (
                                      <span className={styles.cellNum} style={{ color: '#059669' }}>
                                        +{Math.round(summary.elevation_gain_m)}{' '}
                                        <span className={styles.cellUnit}>m</span>
                                      </span>
                                    ) : (
                                      '--'
                                    )}
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    <span className={styles.cellNum}>{summary.calories != null ? Math.round(summary.calories) : '--'}</span>{' '}
                                    <span className={styles.cellUnit}>{summary.calories != null ? 'kcal' : ''}</span>
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>

                        {/* Mobile swipe hint */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 4px 0',
                            fontSize: '0.6875rem',
                            color: 'var(--color-text-muted)',
                            fontFamily: "'Mali', sans-serif",
                          }}
                        >
                          <span>← เลื่อนตารางแนวนอนเพื่อดูข้อมูล Dynamics & Elevation →</span>
                          <span>{laps.length} Laps</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: OVERVIEW & METRICS                                                 */}
            {/* ========================================================================= */}
            {activeTab === 'overview' && (
              <div>
                <div className={styles.subCardsGrid}>
                  {/* Advanced Running Dynamics */}
                  <div className={styles.subCard}>
                    <div className={styles.subCardTitle}>
                      <Footprints size={16} color="var(--color-primary)" weight="fill" />
                      <span>Running Dynamics</span>
                    </div>

                    <div>
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
                      {summary.avg_speed_kph != null && (
                        <DetailRow
                          label="Speed (ความเร็ว)"
                          val={`${Number(summary.avg_speed_kph).toFixed(1)} km/h`}
                          sub={summary.max_speed_kph ? `Max: ${summary.max_speed_kph} km/h` : undefined}
                        />
                      )}
                    </div>
                  </div>

                  {/* Training Effect & Physiology */}
                  <div className={styles.subCard}>
                    <div className={styles.subCardTitle}>
                      <Lightning size={16} color="#F59E0B" weight="fill" />
                      <span>Training Effect & Body</span>
                    </div>

                    <div>
                      <DetailRow
                        label="Training Effect Label"
                        val={summary.training_effect_label || workoutData.activity_type || '--'}
                      />
                      <DetailRow
                        label="Aerobic TE"
                        val={summary.aerobic_training_effect != null && summary.aerobic_training_effect !== '' && !isNaN(Number(summary.aerobic_training_effect))
                          ? Number(summary.aerobic_training_effect).toFixed(2)
                          : '--'}
                      />
                      <DetailRow
                        label="Anaerobic TE"
                        val={summary.anaerobic_training_effect != null && summary.anaerobic_training_effect !== '' && !isNaN(Number(summary.anaerobic_training_effect))
                          ? Number(summary.anaerobic_training_effect).toFixed(2)
                          : '--'}
                      />
                      <DetailRow
                        label="Body Battery Drain"
                        val={summary.body_battery_drain != null && summary.body_battery_drain !== '' && !isNaN(Number(summary.body_battery_drain))
                          ? Number(summary.body_battery_drain).toFixed(2)
                          : '--'}
                      />
                      <DetailRow
                        label="Elevation Gain / Loss"
                        val={`+${summary.elevation_gain_m || 0} m / -${summary.elevation_loss_m || 0} m`}
                      />
                    </div>
                  </div>

                  {/* Weather & Gear */}
                  <div className={styles.subCard}>
                    <div className={styles.subCardTitle}>
                      <Thermometer size={16} color="#06B6D4" weight="fill" />
                      <span>Environment & Gear</span>
                    </div>

                    <div>
                      {weather ? (
                        <>
                          <DetailRow
                            label="Condition"
                            val={weather.condition || weather.weather_type || 'Mostly Cloudy'}
                          />
                          <DetailRow
                            label="Temperature"
                            val={weather.temperature_c != null ? `${weather.temperature_c}°C` : (weather.temp_c != null ? `${weather.temp_c}°C` : '--')}
                            sub={weather.apparent_temperature_c != null ? `Feels like: ${weather.apparent_temperature_c}°C` : undefined}
                          />
                          <DetailRow
                            label="Humidity & Wind"
                            val={`${weather.relative_humidity_percent || weather.humidity || '--'}% | ${weather.wind_speed_kph || weather.wind_speed || 0} km/h`}
                          />
                        </>
                      ) : (
                        <DetailRow label="Weather" val="ไม่พบข้อมูลสภาพอากาศ" />
                      )}

                      <DetailRow
                        label="Shoes (รองเท้า)"
                        val={shoeInfo.title}
                        sub={shoeInfo.subtitle}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkoutDetailSection;
