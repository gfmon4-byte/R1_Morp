'use client';

import React, { useState, useMemo, memo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ArrowsOutSimple, X, Heart, CaretUp, CaretDown } from '@phosphor-icons/react';
import type { Activity, Profile } from '@/lib/supabase';
import type { HRZone } from '@/lib/hrZones';

const EN_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatShortDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = d.getDate();
  const m = EN_MONTHS_SHORT[d.getMonth()];
  return `${day} ${m}`;
}

function formatFullDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = d.getDate();
  const m = EN_MONTHS_SHORT[d.getMonth()];
  const y = d.getFullYear();
  return `${day} ${m} ${y}`;
}

function secondsToPace(seconds?: number | null) {
  if (!seconds || seconds >= 9999 || isNaN(seconds) || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDurationMin(seconds?: number | null) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0m';
  const mins = Math.round(seconds / 60);
  return `${mins}m`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
}

/* ── Custom Tooltip matching RunMorp pastel & dark theme ────────────────────── */
function Zone2Tooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      style={{
        background: 'var(--color-bg-card)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: 'var(--shadow-md)',
        pointerEvents: 'none',
        minWidth: 180,
      }}
    >
      <div
        style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          marginBottom: 4,
          fontFamily: "'Baloo 2', sans-serif",
          borderBottom: '1px solid var(--color-border-muted)',
          paddingBottom: 3,
        }}
      >
        {data.fullDate}
      </div>
      <div
        style={{
          fontSize: '0.8125rem',
          fontWeight: 700,
          color: 'var(--color-text)',
          marginBottom: 8,
          fontFamily: "'Baloo 2', sans-serif",
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {data.title}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', fontFamily: "'Mali', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Pace @ Z2:</span>
          <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontFamily: "'Baloo 2', sans-serif" }}>
            {data.paceStr} /km
          </span>
        </div>
        {data.trendStr && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Trend:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: "'Baloo 2', sans-serif" }}>
              {data.trendStr} /km
            </span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Time in Z2:</span>
          <span style={{ fontWeight: 700, color: '#10B981', fontFamily: "'Baloo 2', sans-serif" }}>
            {data.pctZ2}% ({formatDurationMin(data.z2Duration)})
          </span>
        </div>
        {data.avgHr > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Avg HR:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text)', fontFamily: "'Baloo 2', sans-serif" }}>
              {data.avgHr} bpm
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  activities?: Activity[];
  activityDetails?: any[];
  profile?: Profile | null;
  hrZones?: HRZone[];
  defaultDays?: number;
}

export function Zone2TrendChart({
  activities = [],
  activityDetails = [],
  profile = null,
  hrZones = [],
  defaultDays = 30,
}: Props) {
  const [daysRange, setDaysRange] = useState<number | 'all'>(defaultDays);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Zone 2 HR boundaries (calibrated for running: min >= 100 bpm)
  const { z2Min, z2Max } = useMemo(() => {
    // 1. Try from computeHRZones (hrZones prop)
    const z2Item = hrZones?.find((z) => z.zone === 2);
    if (z2Item && z2Item.minBpm >= 100) {
      return { z2Min: z2Item.minBpm, z2Max: z2Item.maxBpm };
    }

    // 2. Try from profile garmin_hr_zones or hr_zones object (must be running zone >= 100 bpm)
    const pZones =
      (profile as any)?.fitness_age_data?.garmin_hr_zones ||
      (profile as any)?.fitness_age_data?.hr_zones ||
      (profile as any)?.hr_zones;
    if (pZones?.z2 && Number(pZones.z2.min) >= 100) {
      return {
        z2Min: parseInt(pZones.z2.min, 10),
        z2Max: parseInt(pZones.z2.max, 10),
      };
    }

    // 3. Fallback based on profile hr_max and hr_rest (or default Garmin Venu 3 Activity Zone 2: 116-144)
    return { z2Min: 116, z2Max: 144 };
  }, [hrZones, profile]);

  // Map of activity_id -> details
  const detailsMap = useMemo(() => {
    const map = new Map<string, any>();
    (activityDetails || []).forEach((d) => {
      if (d.activity_id) map.set(String(d.activity_id), d.details);
    });
    return map;
  }, [activityDetails]);

  // Process activities into Zone 2 metrics
  const {
    chartData,
    avgPctZ2,
    avgPaceStr,
    pctDelta,
    paceDeltaStr,
    isPaceBetter,
    yTicks,
    yDomain,
  } = useMemo(() => {
    if (!activities || activities.length === 0) {
      return {
        chartData: [],
        avgPctZ2: 0,
        avgPaceStr: '--',
        pctDelta: 0,
        paceDeltaStr: null,
        isPaceBetter: true,
        yTicks: [300, 330, 360, 390, 420],
        yDomain: [300, 420],
      };
    }

    const now = new Date();
    const daysNum = typeof daysRange === 'number' ? daysRange : 9999;
    const windowStart = new Date(now.getTime() - daysNum * 86400000);
    const prevWindowStart = new Date(now.getTime() - daysNum * 2 * 86400000);

    // Helper to extract Z2 data from an activity
    const parseActZ2 = (act: Activity) => {
      const detail = detailsMap.get(String(act.garmin_activity_id || act.id));
      let z2HrDuration = 0;
      let totalDuration = parseInt(String(act.duration_seconds || 0), 10);
      let z2RunningDist = 0;
      let z2RunningDur = 0;
      let z2Pace: number | null = null;

      // Strict Zone 2 boundaries anchored to Profile Heart Rate Zone (116 - 144 bpm)
      const targetZ2Min = z2Min;
      const targetZ2Max = z2Max;

      // 1. Check HR Zones breakdown for time heart was in Z2
      if (detail?.hr_zones && Array.isArray(detail.hr_zones)) {
        const z2 = detail.hr_zones.find((z: any) => z.zone_number === 2);
        // Only accept seconds_in_zone if zone boundary is a real running zone (>= 100 bpm)
        if (z2 && typeof z2.min_bpm === 'number' && z2.min_bpm >= 100) {
          z2HrDuration = parseFloat(z2.seconds_in_zone || 0);
        }
        const sumDur = detail.hr_zones.reduce(
          (acc: number, z: any) => acc + (parseFloat(z.seconds_in_zone) || 0),
          0
        );
        if (sumDur > 0) totalDuration = sumDur;
      } else if (act.hr_zone_breakdown && typeof act.hr_zone_breakdown === 'object') {
        const b = act.hr_zone_breakdown as Record<string, number>;
        if (b.Z2 && b.Z2 > 0) z2HrDuration = b.Z2;
      }

      // 2. Check Laps breakdown for specific pace in Profile Zone 2 (targetZ2Min - targetZ2Max)
      const laps = detail?.laps || (detail?.parts ? detail.parts.flatMap((p: any) => p.laps || []) : []);
      if (laps.length > 0) {
        let lapZ2Dist = 0;
        let lapZ2Dur = 0;
        laps.forEach((lap: any) => {
          const hr = parseInt(lap.avg_hr || 0, 10);
          if (hr >= targetZ2Min && hr <= targetZ2Max) {
            lapZ2Dist += parseFloat(lap.distance_km || 0);
            lapZ2Dur += parseInt(lap.duration_seconds || 0, 10);
          }
        });
        if (lapZ2Dist > 0.1 && lapZ2Dur > 0) {
          z2RunningDist = lapZ2Dist;
          z2RunningDur = lapZ2Dur;
          z2Pace = Math.round(lapZ2Dur / lapZ2Dist);
        }
      }

      // 3. Fallback: Entire run average HR in Zone 2
      const actHr = parseInt(String(act.avg_hr || 0), 10);
      if (!z2Pace && actHr >= targetZ2Min && actHr <= targetZ2Max) {
        const dist = parseFloat(String(act.distance_km || 0));
        const dur = parseInt(String(act.duration_seconds || 0), 10);
        if (dist > 0.2 && dur > 0) {
          z2RunningDist = dist;
          z2RunningDur = dur;
          z2Pace = Math.round(dur / dist);
        }
      }

      // 4. Fallback: if activity has pace and duration and heart in Z2
      if (!z2Pace && z2HrDuration > 60 && act.avg_pace_sec_per_km && actHr >= targetZ2Min - 5 && actHr <= targetZ2Max + 5) {
        const paceVal = Math.round(act.avg_pace_sec_per_km);
        const dist = parseFloat(String(act.distance_km || 0));
        if (paceVal >= 200 && paceVal <= 720 && dist > 0.2) {
          z2Pace = paceVal;
          z2RunningDist = dist;
          z2RunningDur = Math.round(paceVal * dist);
        }
      }

      // Ensure z2HrDuration reflects actual running in Zone 2
      if (z2RunningDur > z2HrDuration) {
        z2HrDuration = z2RunningDur;
      }
      if (z2HrDuration === 0 && actHr >= targetZ2Min && actHr <= targetZ2Max && totalDuration > 0) {
        z2HrDuration = totalDuration;
      }

      const pct = totalDuration > 0 ? Math.round((z2HrDuration / totalDuration) * 100) : 0;
      return {
        act,
        z2HrDuration,
        totalDuration,
        z2RunningDist,
        z2RunningDur,
        z2Pace,
        pct,
        actHr,
      };
    };

    let currZ2RunningDur = 0;
    let currZ2RunningDist = 0;
    let currZ2HrDuration = 0;
    let currTotalDuration = 0;

    let prevZ2RunningDur = 0;
    let prevZ2RunningDist = 0;
    let prevZ2HrDuration = 0;
    let prevTotalDuration = 0;

    const currentPoints: any[] = [];

    activities.forEach((act) => {
      if (!act.date) return;
      const actDate = new Date(act.date);
      if (isNaN(actDate.getTime())) return;

      const parsed = parseActZ2(act);

      // Current period
      if (actDate >= windowStart && actDate <= now) {
        if (parsed.totalDuration > 0) {
          currZ2HrDuration += parsed.z2HrDuration;
          currTotalDuration += parsed.totalDuration;
        }
        if (
          parsed.z2Pace &&
          parsed.z2Pace >= 200 &&
          parsed.z2Pace <= 720 &&
          parsed.z2RunningDist > 0 &&
          parsed.z2RunningDur > 0
        ) {
          currZ2RunningDist += parsed.z2RunningDist;
          currZ2RunningDur += parsed.z2RunningDur;
          currentPoints.push({
            date: act.date,
            dateObj: actDate,
            dateLabel: formatShortDate(act.date),
            fullDate: formatFullDate(act.date),
            title: act.title || act.route_name || act.session_type || 'Running',
            paceSecs: parsed.z2Pace,
            paceStr: secondsToPace(parsed.z2Pace),
            pctZ2: parsed.pct,
            z2Duration: parsed.z2RunningDur || parsed.z2HrDuration,
            z2Dist: parsed.z2RunningDist,
            avgHr: parsed.actHr,
          });
        }
      }
      // Previous period
      else if (actDate >= prevWindowStart && actDate < windowStart) {
        if (parsed.totalDuration > 0) {
          prevZ2HrDuration += parsed.z2HrDuration;
          prevTotalDuration += parsed.totalDuration;
        }
        if (
          parsed.z2Pace &&
          parsed.z2Pace >= 200 &&
          parsed.z2Pace <= 720 &&
          parsed.z2RunningDist > 0 &&
          parsed.z2RunningDur > 0
        ) {
          prevZ2RunningDist += parsed.z2RunningDist;
          prevZ2RunningDur += parsed.z2RunningDur;
        }
      }
    });

    // Sort chronologically (oldest to newest, left to right)
    currentPoints.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    // Linear regression for Trendline
    const n = currentPoints.length;
    if (n >= 2) {
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumX2 = 0;

      currentPoints.forEach((pt, i) => {
        sumX += i;
        sumY += pt.paceSecs;
        sumXY += i * pt.paceSecs;
        sumX2 += i * i;
      });

      const denom = n * sumX2 - sumX * sumX;
      const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      const intercept = (sumY - slope * sumX) / n;

      currentPoints.forEach((pt, i) => {
        const trend = Math.round(slope * i + intercept);
        pt.trendSecs = trend;
        pt.trendStr = secondsToPace(trend);
      });
    } else if (n === 1) {
      currentPoints[0].trendSecs = currentPoints[0].paceSecs;
      currentPoints[0].trendStr = currentPoints[0].paceStr;
    }

    // Current Summary Metrics
    const currAvgPct = currTotalDuration > 0 ? Math.round((currZ2HrDuration / currTotalDuration) * 100) : 0;
    // Accurate distance-weighted average pace in Zone 2
    const currAvgPace = currZ2RunningDist > 0
      ? Math.round(currZ2RunningDur / currZ2RunningDist)
      : (currentPoints.length > 0
          ? Math.round(currentPoints.reduce((acc, p) => acc + p.paceSecs, 0) / currentPoints.length)
          : 0);

    // Previous Summary Metrics
    const prevAvgPct = prevTotalDuration > 0 ? Math.round((prevZ2HrDuration / prevTotalDuration) * 100) : 0;
    const prevAvgPace = prevZ2RunningDist > 0
      ? Math.round(prevZ2RunningDur / prevZ2RunningDist)
      : 0;

    // Deltas
    const pDelta = currAvgPct - prevAvgPct;
    const paceDiff = prevAvgPace > 0 && currAvgPace > 0 ? prevAvgPace - currAvgPace : 0; // positive if faster
    const isFaster = paceDiff >= 0;

    // Y Axis domain and ticks (rounded to 30-sec boundaries, inverted pace)
    let minPace = 360;
    let maxPace = 600;
    if (currentPoints.length > 0) {
      const allVals = currentPoints.flatMap((p) => [p.paceSecs, p.trendSecs].filter(Boolean));
      minPace = Math.min(...allVals);
      maxPace = Math.max(...allVals);
    }

    const niceMin = Math.max(180, Math.floor((minPace - 15) / 30) * 30);
    const niceMax = Math.min(720, Math.ceil((maxPace + 15) / 30) * 30);

    const ticks: number[] = [];
    for (let t = niceMin; t <= niceMax; t += 30) {
      ticks.push(t);
    }

    return {
      chartData: currentPoints,
      avgPctZ2: currAvgPct,
      avgPaceStr: secondsToPace(currAvgPace),
      pctDelta: pDelta,
      paceDeltaStr: paceDiff !== 0 ? secondsToPace(Math.abs(paceDiff)) : null,
      isPaceBetter: isFaster,
      yTicks: ticks.length >= 2 ? ticks : [360, 420, 480, 540, 600],
      yDomain: [niceMin, niceMax],
    };
  }, [activities, detailsMap, daysRange, z2Min, z2Max]);

  return (
    <div
      className="card"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Card Header ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              fontFamily: "'Baloo 2', sans-serif",
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            Zone 2 Trend
          </h3>
          <span
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-muted)',
              fontFamily: "'Mali', sans-serif",
              fontWeight: 500,
            }}
          >
            ({daysRange === 'all' ? 'All Time' : `${daysRange} Days`})
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: '#10B981',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '1px 8px',
              borderRadius: 12,
              fontFamily: 'Barlow Condensed, sans-serif',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Profile Heart Rate Zone 2"
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981' }} />
            Z2: {z2Min}–{z2Max} bpm
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Days range selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              background: 'var(--color-primary-soft)',
              borderRadius: 100,
              padding: '2px 4px',
              border: '1px solid var(--color-border-muted)',
            }}
          >
            {[30, 60, 90].map((d) => {
              const isActive = daysRange === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDaysRange(d)}
                  style={{
                    border: 'none',
                    background: isActive ? 'var(--color-primary)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--color-text-muted)',
                    fontFamily: "'Baloo 2', sans-serif",
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 100,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={`Show last ${d} days`}
                >
                  {d}d
                </button>
              );
            })}
          </div>

          {/* Expand Modal Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            style={{
              background: 'var(--color-primary-soft)',
              border: '1px solid var(--color-border-muted)',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              padding: 5,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Expand detailed analysis"
            aria-label="Expand chart"
          >
            <ArrowsOutSimple size={15} weight="bold" />
          </button>
        </div>
      </div>

      {/* ── Top Metrics Row (2 columns) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* Metric 1: Time in Z2 per Run */}
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 14,
            background: 'var(--color-primary-soft)',
            border: '1px solid var(--color-border-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              fontFamily: "'Mali', sans-serif",
              fontWeight: 600,
            }}
          >
            Time in Z2 / Run
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '1.375rem',
                fontWeight: 800,
                fontFamily: "'Baloo 2', sans-serif",
                color: '#10B981',
                lineHeight: 1,
              }}
            >
              {avgPctZ2}%
            </span>
            {pctDelta !== 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  fontFamily: "'Baloo 2', sans-serif",
                  color: pctDelta >= 0 ? '#10B981' : '#F43F5E',
                  background: pctDelta >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                  padding: '1px 6px',
                  borderRadius: 100,
                }}
              >
                {pctDelta >= 0 ? <CaretUp size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />}
                {Math.abs(pctDelta)}%
              </span>
            )}
          </div>
        </div>

        {/* Metric 2: Pace @ Z2 (Avg) */}
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 14,
            background: 'var(--color-primary-soft)',
            border: '1px solid var(--color-border-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              fontFamily: "'Mali', sans-serif",
              fontWeight: 600,
            }}
          >
            Pace @ Z2 (Avg)
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '1.375rem',
                fontWeight: 800,
                fontFamily: "'Baloo 2', sans-serif",
                color: 'var(--color-primary)',
                lineHeight: 1,
              }}
            >
              {avgPaceStr}
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--color-text-muted)',
                fontFamily: "'Mali', sans-serif",
                fontWeight: 500,
              }}
            >
              /km
            </span>
            {paceDeltaStr && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  fontFamily: "'Baloo 2', sans-serif",
                  color: isPaceBetter ? '#10B981' : '#F43F5E',
                  background: isPaceBetter ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                  padding: '1px 6px',
                  borderRadius: 100,
                }}
              >
                {isPaceBetter ? <CaretUp size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />}
                {paceDeltaStr}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Line Chart with Inverted Pace & Trendline ── */}
      <div style={{ width: '100%', height: 210, position: 'relative' }}>
        {chartData.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--color-text-muted)',
              fontSize: '0.8125rem',
              fontFamily: "'Mali', sans-serif",
              textAlign: 'center',
              padding: 20,
            }}
          >
            No Zone 2 running data available for the last {daysRange === 'all' ? 'all-time' : `${daysRange} days`}.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, bottom: 0, left: -14 }}
            >
              <CartesianGrid
                vertical={false}
                horizontal={true}
                stroke="var(--color-border-muted)"
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="dateLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontFamily: "'Baloo 2', sans-serif", fontWeight: 600 }}
                dy={6}
              />

              <YAxis
                type="number"
                reversed={true}
                domain={yDomain}
                ticks={yTicks}
                tickFormatter={secondsToPace}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontFamily: "'Baloo 2', sans-serif" }}
                width={38}
              />

              <Tooltip content={<Zone2Tooltip />} />

              {/* Trendline (dashed regression line) */}
              <Line
                type="linear"
                dataKey="trendSecs"
                name="Trend"
                stroke="var(--color-text-subtle)"
                strokeDasharray="4 4"
                strokeWidth={1.8}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />

              {/* Pace @ Z2 points connected by line */}
              <Line
                type="monotone"
                dataKey="paceSecs"
                name="Pace @ Z2"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ r: 3.5, fill: 'var(--color-primary)', stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 5.5, fill: 'var(--color-primary)', stroke: 'var(--color-bg-card)', strokeWidth: 2 }}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Bottom Legend ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          marginTop: 8,
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          fontFamily: "'Baloo 2', sans-serif",
          fontWeight: 600,
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
              display: 'inline-block',
              boxShadow: '0 0 5px var(--color-primary)',
            }}
          />
          <span>Pace @ Z2</span>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 16,
              height: 2,
              borderTop: '2px dashed var(--color-text-subtle)',
              display: 'inline-block',
            }}
          />
          <span>Trendline</span>
        </div>
      </div>

      {/* ── Expanded Full Modal ── */}
      {isExpanded && (
        <div
          onClick={() => setIsExpanded(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '2px solid var(--color-border)',
              borderRadius: 24,
              width: '100%',
              maxWidth: 820,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 22,
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    fontFamily: "'Baloo 2', sans-serif",
                    color: 'var(--color-text)',
                    margin: 0,
                  }}
                >
                  Zone 2 Trend Detailed Analysis
                </h3>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-muted)',
                    fontFamily: "'Mali', sans-serif",
                  }}
                >
                  ({daysRange === 'all' ? 'All' : `${daysRange} Days`})
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: '#10B981',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontFamily: 'Barlow Condensed, sans-serif',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981' }} />
                  Profile Z2: {z2Min}–{z2Max} bpm
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                style={{
                  background: 'var(--color-primary-soft)',
                  border: '1px solid var(--color-border-muted)',
                  color: 'var(--color-text)',
                  borderRadius: 100,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                aria-label="Close modal"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Modal Chart */}
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 15, bottom: 0, left: -10 }}>
                  <CartesianGrid vertical={false} horizontal={true} stroke="var(--color-border-muted)" strokeDasharray="3 3" />
                  <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 11, fontFamily: "'Baloo 2', sans-serif" }} />
                  <YAxis type="number" reversed={true} domain={yDomain} ticks={yTicks} tickFormatter={secondsToPace} axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 11, fontFamily: "'Baloo 2', sans-serif" }} />
                  <Tooltip content={<Zone2Tooltip />} />
                  <Line type="linear" dataKey="trendSecs" stroke="var(--color-text-subtle)" strokeDasharray="4 4" strokeWidth={1.8} dot={false} />
                  <Line type="monotone" dataKey="paceSecs" stroke="var(--color-primary)" strokeWidth={2.2} dot={{ r: 4, fill: 'var(--color-primary)', stroke: '#fff', strokeWidth: 1.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Table of runs in the period */}
            <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid var(--color-border-muted)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-primary-soft)', borderBottom: '1px solid var(--color-border-muted)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--color-text)', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700 }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--color-text)', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700 }}>Activity</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--color-text)', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700 }}>Pace @ Z2</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--color-text)', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700 }}>Z2 Duration</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--color-text)', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700 }}>Z2 %</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--color-text)', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700 }}>Avg HR</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.slice().reverse().map((pt, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--color-border-muted)',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,143,163,0.03)',
                      }}
                      className="hover:bg-[rgba(255,143,163,0.08)]"
                    >
                      <td style={{ padding: '8px 12px', color: 'var(--color-text)', fontFamily: "'Baloo 2', sans-serif" }}>{pt.fullDate}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text)', fontFamily: "'Mali', sans-serif", fontWeight: 600 }}>{pt.title}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-primary)', fontWeight: 700, fontFamily: "'Baloo 2', sans-serif" }}>{pt.paceStr} /km</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text)', fontFamily: "'Baloo 2', sans-serif" }}>{formatDurationMin(pt.z2Duration)}</td>
                      <td style={{ padding: '8px 12px', color: '#10B981', fontWeight: 700, fontFamily: "'Baloo 2', sans-serif" }}>{pt.pctZ2}%</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)', fontFamily: "'Baloo 2', sans-serif" }}>{pt.avgHr || '--'} bpm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(Zone2TrendChart);
