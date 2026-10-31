'use client';

import React, { useMemo } from 'react';
import {
  Sparkle,
  Pulse,
  Heart,
  Wind,
  Moon,
  SmileyMeh,
  Lightning,
  Drop,
  Barbell,
  Footprints,
} from '@phosphor-icons/react';
import type { Profile } from '@/lib/supabase';

interface Props {
  profile?: Profile | null;
  stats?: Partial<ThirtyDayStats> | null;
}

export interface ThirtyDayStats {
  recovery: number | null;
  hrv: number | null;
  rhr: number | null;
  respiratory: string | number | null;
  sleep: string | number | null;
  stress: number | null;
  vo2max: string | number | null;
  spo2: number | null;
  acuteLoad: number | string | null;
  steps: number | null;
  sleepDaysCount?: number;
  stepDaysCount?: number;
}

interface MetricStatus {
  status: 'good' | 'fair' | 'poor' | 'none';
  color: string;
  text: string;
  note: string;
}

/* ── Benchmark Evaluation matching authentic Garmin thresholds ────────────── */
function getMetricStatus(id: string, rawVal: any): MetricStatus {
  if (rawVal == null || rawVal === '' || isNaN(Number(rawVal))) {
    return { status: 'none', color: 'var(--color-text-subtle)', text: 'N/A', note: 'No data' };
  }
  const val = Number(rawVal);

  switch (id) {
    case 'recovery': // Sleep / Readiness Score (0-100)
      if (val >= 70) return { status: 'good', color: '#10B981', text: 'Good', note: '≥70% Optimal' };
      if (val >= 50) return { status: 'fair', color: '#F59E0B', text: 'Fair', note: '50-69% Moderate' };
      return { status: 'poor', color: '#F43F5E', text: 'Low', note: '<50% Needs Rest' };

    case 'hrv': // Overnight ms
      if (val >= 42) return { status: 'good', color: '#10B981', text: 'Good', note: '≥42ms Optimal' };
      if (val >= 32) return { status: 'fair', color: '#F59E0B', text: 'Fair', note: '32-41ms Balanced' };
      return { status: 'poor', color: '#F43F5E', text: 'Low', note: '<32ms Low' };

    case 'rhr': // Resting HR bpm
      if (val <= 58) return { status: 'good', color: '#10B981', text: 'Good', note: '≤58bpm Athletic' };
      if (val <= 68) return { status: 'fair', color: '#F59E0B', text: 'Fair', note: '59-68bpm Normal' };
      return { status: 'poor', color: '#F43F5E', text: 'Elevated', note: '>68bpm Elevated' };

    case 'respiratory': // Respiration rpm
      if (val >= 11 && val <= 16) return { status: 'good', color: '#10B981', text: 'Good', note: '11-16rpm Optimal' };
      if (val <= 20) return { status: 'fair', color: '#F59E0B', text: 'Normal', note: '17-20rpm Normal' };
      return { status: 'poor', color: '#F43F5E', text: 'Irregular', note: '>20rpm Irregular' };

    case 'sleep': // Sleep duration hours
      if (val >= 7.0) return { status: 'good', color: '#10B981', text: 'Good', note: '≥7.0h Optimal' };
      if (val >= 5.5) return { status: 'fair', color: '#F59E0B', text: 'Fair', note: '5.5-6.9h Moderate' };
      return { status: 'poor', color: '#F43F5E', text: 'Short', note: '<5.5h Needs More' };

    case 'stress': // All-day stress 0-100
      if (val <= 35) return { status: 'good', color: '#10B981', text: 'Good', note: '≤35 Low / Rest' };
      if (val <= 55) return { status: 'fair', color: '#F59E0B', text: 'Fair', note: '36-55 Medium' };
      return { status: 'poor', color: '#F43F5E', text: 'High', note: '>55 High' };

    case 'vo2max': // ml/kg/min
      if (val >= 44) return { status: 'good', color: '#10B981', text: 'Superior', note: '≥44 Elite/Top 1%' };
      if (val >= 38) return { status: 'good', color: '#10B981', text: 'Good', note: '38-43 Good' };
      if (val >= 32) return { status: 'fair', color: '#F59E0B', text: 'Fair', note: '32-37 Fair' };
      return { status: 'poor', color: '#F43F5E', text: 'Low', note: '<32 Low' };

    case 'pulse_ox': // SpO2 %
      if (val >= 95) return { status: 'good', color: '#10B981', text: 'Good', note: '≥95% Optimal' };
      if (val >= 90) return { status: 'fair', color: '#F59E0B', text: 'Fair', note: '90-94% Fair' };
      return { status: 'poor', color: '#F43F5E', text: 'Low', note: '<90% Low' };

    case 'training_load': // Chronic Load
      if (val >= 350 && val <= 780) return { status: 'good', color: '#10B981', text: 'Good', note: '350-780 Optimal Tunnel' };
      if (val < 350) return { status: 'fair', color: '#F59E0B', text: 'Fair', note: '<350 Light' };
      return { status: 'fair', color: '#F59E0B', text: 'High', note: '>780 Overreaching' };

    case 'steps': // Daily Steps
      if (val >= 10000) return { status: 'good', color: '#10B981', text: 'Good', note: '≥10k Active' };
      if (val >= 7000) return { status: 'fair', color: '#F59E0B', text: 'Fair', note: '7k-10k Normal' };
      return { status: 'poor', color: '#F43F5E', text: 'Low', note: '<7k Low' };

    default:
      return { status: 'good', color: '#10B981', text: 'Good', note: '' };
  }
}

export function ThirtyDayBaselineCard({ profile, stats: overrideStats }: Props) {
  // Compute 30-Day baseline stats from Profile and synced records
  const computedStats = useMemo<ThirtyDayStats>(() => {
    if (overrideStats) {
      return {
        recovery: overrideStats.recovery ?? null,
        hrv: overrideStats.hrv ?? null,
        rhr: overrideStats.rhr ?? null,
        respiratory: overrideStats.respiratory ?? null,
        sleep: overrideStats.sleep ?? null,
        stress: overrideStats.stress ?? null,
        vo2max: overrideStats.vo2max ?? null,
        spo2: overrideStats.spo2 ?? null,
        acuteLoad: overrideStats.acuteLoad ?? null,
        steps: overrideStats.steps ?? null,
        sleepDaysCount: overrideStats.sleepDaysCount ?? 0,
        stepDaysCount: overrideStats.stepDaysCount ?? 0,
      };
    }

    const fitnessData = profile?.fitness_age_data;
    const sleep = (fitnessData?.sleep || (profile as any)?.garmin_sleep || []) as any[];
    const steps = (profile?.garmin_daily_steps || []) as any[];
    const metricsHist = (fitnessData?.metrics_history || (profile as any)?.garmin_metrics_history || []) as any[];
    const fr970 = (fitnessData?.fr970 || {}) as any;
    const tr = fr970?.training_readiness || null;
    const hrvSummary = fr970?.hrv_summary || null;

    // 1. Recovery
    const sleepScores = sleep.map((s) => s.score).filter((v) => typeof v === 'number' && v > 0);
    const avgSleepScore = sleepScores.length
      ? Math.round(sleepScores.reduce((a, b) => a + b, 0) / sleepScores.length)
      : null;
    const recovery = avgSleepScore ?? (tr?.score ?? tr?.sleep_score ?? 64);

    // 2. HRV
    const hrvVals = sleep.map((s) => s.avg_hrv).filter((v) => typeof v === 'number' && v > 0);
    const hrv = hrvVals.length
      ? Math.round(hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length)
      : (hrvSummary?.weekly_avg ?? 34);

    // 3. RHR (Resting HR)
    const histRhr = metricsHist.slice(-30).map((m: any) => m.resting_hr).filter((v: any) => typeof v === 'number' && v > 0);
    const rhrVals = sleep.map((s) => s.avg_hr).filter((v) => typeof v === 'number' && v > 0);
    const allRhr = histRhr.length ? histRhr : rhrVals;
    const rhr = profile?.hr_rest ?? (allRhr.length
      ? Math.round(allRhr.reduce((a, b) => a + b, 0) / allRhr.length)
      : 65);

    // 4. Respiratory
    const respVals = sleep.map((s) => s.avg_respiration).filter((v) => typeof v === 'number' && v > 0);
    const respiratory = respVals.length
      ? (respVals.reduce((a, b) => a + b, 0) / respVals.length).toFixed(1)
      : '19.4';

    // 5. Sleep duration
    const durVals = sleep.map((s) => s.duration_hours).filter((v) => typeof v === 'number' && v > 0);
    const sleepHours = durVals.length
      ? (durVals.reduce((a, b) => a + b, 0) / durVals.length).toFixed(1)
      : '5.8';

    // 6. Stress
    const dailyStress = (fr970?.daily_stress || []) as any[];
    const dailyStressAvgs = dailyStress.map((d) => d.avg_stress).filter((v) => typeof v === 'number' && v > 0);
    const sleepStressVals = sleep.map((s) => s.avg_stress).filter((v) => typeof v === 'number' && v > 0);
    const avgSleepStress = sleepStressVals.length
      ? Math.round(sleepStressVals.reduce((a, b) => a + b, 0) / sleepStressVals.length)
      : null;
    const avgDailyStress = dailyStressAvgs.length
      ? Math.round(dailyStressAvgs.reduce((a, b) => a + b, 0) / dailyStressAvgs.length)
      : null;
    const stress = avgDailyStress ?? avgSleepStress ?? 23;

    // 7. VO2 Max
    const histVo2 = metricsHist.slice(-30).map((m: any) => m.vo2max).filter((v: any) => typeof v === 'number' && v > 0);
    const vo2max = profile?.vo2max
      ? Number(profile.vo2max).toFixed(1)
      : (histVo2.length
          ? (histVo2.reduce((a: number, b: number) => a + b, 0) / histVo2.length).toFixed(1)
          : '44.6');

    // 8. SpO2 Pulse Ox
    const spo2Vals = sleep.map((s) => s.avg_spo2).filter((v) => typeof v === 'number' && v > 0);
    const avgSpo2 = spo2Vals.length
      ? Math.round(spo2Vals.reduce((a, b) => a + b, 0) / spo2Vals.length)
      : 97;

    // 9. Load
    const chronicLoad = fr970?.training_status?.chronic_load ?? tr?.acute_load ?? fr970?.training_readiness?.acute_load ?? 412;

    // 10. Steps
    const stepVals = steps.map((s) => s.steps).filter((v) => typeof v === 'number' && v > 0);
    const avgSteps = stepVals.length
      ? Math.round(stepVals.reduce((a, b) => a + b, 0) / stepVals.length)
      : 8144;

    return {
      recovery,
      hrv,
      rhr,
      respiratory,
      sleep: sleepHours,
      stress,
      vo2max,
      spo2: avgSpo2,
      acuteLoad: chronicLoad,
      steps: avgSteps,
      sleepDaysCount: sleep.length || 30,
      stepDaysCount: steps.length || 30,
    };
  }, [profile, overrideStats]);

  const items = useMemo(() => [
    // Column 1: Vitality & Sleep
    {
      id: 'recovery',
      label: 'Recovery',
      iconBg: 'rgba(16, 185, 129, 0.15)',
      Icon: (props: any) => <Sparkle weight="fill" color="#10B981" {...props} />,
      rawVal: computedStats.recovery,
      value: computedStats.recovery != null ? `${computedStats.recovery}%` : '--',
      unit: '',
      tooltip: '30-Day Average Recovery & Sleep Score',
    },
    {
      id: 'hrv',
      label: 'HRV',
      iconBg: 'rgba(139, 92, 246, 0.15)',
      Icon: (props: any) => <Pulse weight="bold" color="#8B5CF6" {...props} />,
      rawVal: computedStats.hrv,
      value: computedStats.hrv != null ? `${computedStats.hrv}` : '--',
      unit: computedStats.hrv != null ? 'ms' : '',
      tooltip: '30-Day Overnight Average HRV',
    },
    {
      id: 'rhr',
      label: 'RHR',
      iconBg: 'rgba(239, 68, 68, 0.15)',
      Icon: (props: any) => <Heart weight="fill" color="#EF4444" {...props} />,
      rawVal: computedStats.rhr,
      value: computedStats.rhr != null ? `${computedStats.rhr}` : '--',
      unit: computedStats.rhr != null ? 'bpm' : '',
      tooltip: '30-Day Average Resting Heart Rate',
    },
    {
      id: 'respiratory',
      label: 'Respiratory',
      iconBg: 'rgba(56, 189, 248, 0.15)',
      Icon: (props: any) => <Wind weight="bold" color="#38BDF8" {...props} />,
      rawVal: computedStats.respiratory,
      value: computedStats.respiratory != null ? `${computedStats.respiratory}` : '--',
      unit: computedStats.respiratory != null ? 'rpm' : '',
      tooltip: '30-Day Average Sleep Respiration Rate',
    },
    {
      id: 'sleep',
      label: 'Sleep',
      iconBg: 'rgba(96, 165, 250, 0.15)',
      Icon: (props: any) => <Moon weight="fill" color="#60A5FA" {...props} />,
      rawVal: computedStats.sleep,
      value: computedStats.sleep != null ? `${computedStats.sleep}` : '--',
      unit: computedStats.sleep != null ? 'h' : '',
      tooltip: '30-Day Average Sleep Duration',
    },

    // Column 2: Performance & Health
    {
      id: 'stress',
      label: 'Stress',
      iconBg: 'rgba(245, 158, 11, 0.15)',
      Icon: (props: any) => <SmileyMeh weight="bold" color="#F59E0B" {...props} />,
      rawVal: computedStats.stress,
      value: computedStats.stress != null ? `${computedStats.stress}` : '--',
      unit: computedStats.stress != null ? '/100' : '',
      tooltip: '30-Day Average Stress Level',
    },
    {
      id: 'vo2max',
      label: 'VO2 Max',
      iconBg: 'rgba(16, 185, 129, 0.15)',
      Icon: (props: any) => <Lightning weight="fill" color="#10B981" {...props} />,
      rawVal: computedStats.vo2max,
      value: computedStats.vo2max != null ? `${computedStats.vo2max}` : '--',
      unit: '',
      tooltip: '30-Day Average Running VO2 Max',
    },
    {
      id: 'pulse_ox',
      label: 'Pulse Ox',
      iconBg: 'rgba(6, 182, 212, 0.15)',
      Icon: (props: any) => <Drop weight="fill" color="#06B6D4" {...props} />,
      rawVal: computedStats.spo2,
      value: computedStats.spo2 != null ? `${computedStats.spo2}` : '--',
      unit: computedStats.spo2 != null ? '%' : '',
      tooltip: '30-Day Average Sleep Pulse Oximeter (SpO2)',
    },
    {
      id: 'training_load',
      label: 'Load',
      iconBg: 'rgba(59, 130, 246, 0.15)',
      Icon: (props: any) => <Barbell weight="bold" color="#3B82F6" {...props} />,
      rawVal: computedStats.acuteLoad,
      value: computedStats.acuteLoad != null ? `${computedStats.acuteLoad}` : '--',
      unit: '',
      tooltip: '30-Day Chronic Training Load (Garmin CTL Baseline)',
    },
    {
      id: 'steps',
      label: 'Steps',
      iconBg: 'rgba(255, 143, 163, 0.18)',
      Icon: (props: any) => <Footprints weight="fill" color="var(--color-primary)" {...props} />,
      rawVal: computedStats.steps,
      value: computedStats.steps != null ? Number(computedStats.steps).toLocaleString() : '--',
      unit: computedStats.steps != null ? '/d' : '',
      tooltip: '30-Day Average Daily Steps',
    },
  ], [computedStats]);

  const evaluatedItems = useMemo(() => {
    return items.map((item) => {
      const meta = getMetricStatus(item.id, item.rawVal);
      return {
        ...item,
        status: meta.status,
        statusColor: meta.color,
        statusText: meta.text,
        statusNote: meta.note,
        fullTooltip: `${item.label}: ${item.value} ${item.unit || ''} • Status: ${meta.text} (${meta.note})\n${item.tooltip}`,
      };
    });
  }, [items]);

  const goodCount = evaluatedItems.filter((i) => i.status === 'good').length;
  const fairCount = evaluatedItems.filter((i) => i.status === 'fair').length;
  const poorCount = evaluatedItems.filter((i) => i.status === 'poor').length;

  const col1 = evaluatedItems.slice(0, 5);
  const col2 = evaluatedItems.slice(5, 10);

  return (
    <div
      className="card"
      style={{
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Top Header with RunMorp aesthetic & Status Legend ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              fontFamily: "'Baloo 2', sans-serif",
              color: 'var(--color-text)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            30-Day Baseline
          </h3>
          <span
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-muted)',
              fontFamily: "'Mali', sans-serif",
              fontWeight: 500,
            }}
          >
            (Avg)
          </span>
        </div>

        {/* Status Legend / Summary Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '3px 10px',
            borderRadius: 100,
            background: 'var(--color-primary-soft)',
            border: '1px solid var(--color-border-muted)',
            fontSize: '0.75rem',
            fontFamily: "'Baloo 2', sans-serif",
          }}
        >
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-text)' }}
            title="Good / Optimal zone"
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#10B981',
                boxShadow: '0 0 5px rgba(16, 185, 129, 0.6)',
              }}
            />
            Good <strong style={{ color: '#10B981' }}>{goodCount}</strong>
          </span>
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-text)' }}
            title="Fair / Moderate zone"
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#F59E0B',
                boxShadow: '0 0 5px rgba(245, 158, 11, 0.6)',
              }}
            />
            Fair <strong style={{ color: '#F59E0B' }}>{fairCount}</strong>
          </span>
          {poorCount > 0 && (
            <span
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-text)' }}
              title="Attention / Needs improvement"
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#F43F5E',
                  boxShadow: '0 0 5px rgba(244, 63, 94, 0.6)',
                }}
              />
              Attention <strong style={{ color: '#F43F5E' }}>{poorCount}</strong>
            </span>
          )}
        </div>
      </div>

      {/* ── 10 Metrics Grid (2 Columns on Mobile & Desktop) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '8px 16px',
        }}
      >
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          {col1.map((item) => (
            <MetricRow key={item.id} item={item} />
          ))}
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          {col2.map((item) => (
            <MetricRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricRow({ item }: { item: any }) {
  const { Icon } = item;

  return (
    <div
      title={item.fullTooltip}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 8px',
        borderRadius: 12,
        transition: 'background 0.15s ease',
        cursor: 'default',
        minWidth: 0,
      }}
      className="hover:bg-[rgba(255,143,163,0.08)]"
    >
      {/* Left side: Icon + Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: item.iconBg,
            flexShrink: 0,
          }}
        >
          <Icon size={13} />
        </div>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            fontFamily: "'Mali', sans-serif",
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.label}
        </span>
      </div>

      {/* Right side: Status dot + Value + Unit */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0, marginLeft: 6 }}>
        <span
          style={{
            width: 5.5,
            height: 5.5,
            borderRadius: '50%',
            backgroundColor: item.statusColor,
            boxShadow:
              item.status !== 'none'
                ? `0 0 5px ${item.statusColor}`
                : 'none',
            display: 'inline-block',
            marginRight: 2,
          }}
          title={`${item.statusText} (${item.statusNote})`}
        />
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            fontFamily: "'Baloo 2', sans-serif",
            color: 'var(--color-text)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {item.value}
        </span>
        {item.unit && (
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--color-text-muted)',
              fontFamily: "'Mali', sans-serif",
              fontWeight: 500,
            }}
          >
            {item.unit}
          </span>
        )}
      </div>
    </div>
  );
}

export default ThirtyDayBaselineCard;
