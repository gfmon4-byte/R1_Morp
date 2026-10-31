'use client';

import React, { useState, useMemo } from 'react';
import type { UseFormRegister } from 'react-hook-form';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  TrendUp,
  TrendDown,
  Minus,
  SealCheck,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import type { Profile } from '@/lib/supabase';

interface Vo2MaxChartProps {
  profile: Profile | null;
  watchVo2: number;
  register: UseFormRegister<any>;
  onRefresh?: () => Promise<void> | void;
}

interface MetricPoint {
  date: string;
  displayDate: string;
  vo2max: number;
  resting_hr?: number | null;
  fitness_age?: number | null;
  diff?: number | null;
}

function getVo2Tier(vo2: number) {
  if (vo2 >= 49.0) return { label: 'ยอดเยี่ยม (Superior)', short: 'ยอดเยี่ยม', color: '#A855F7', bg: 'rgba(168, 85, 247, 0.12)' };
  if (vo2 >= 44.0) return { label: 'ดีเยี่ยม (Excellent)', short: 'ดีเยี่ยม', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
  if (vo2 >= 39.0) return { label: 'ดี (Good)', short: 'ดี', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' };
  if (vo2 >= 35.0) return { label: 'ปานกลาง (Fair)', short: 'ปานกลาง', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' };
  return { label: 'ควรปรับปรุง (Poor)', short: 'ควรปรับปรุง', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' };
}

export function Vo2MaxChart({
  profile,
  watchVo2,
  register,
  onRefresh,
}: Vo2MaxChartProps) {
  const [viewMode, setViewMode] = useState<'tests' | '30days'>('tests');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Extract recorded test points from metrics history
  const { testPoints, all30DaysPoints, currentVo2, peakVo2, lowVo2, latestChange } = useMemo(() => {
    const history = profile?.fitness_age_data?.metrics_history || [];
    
    // 1. Valid test entries (where vo2max was evaluated by Garmin)
    const valid = history
      .filter((m: any) => m.vo2max !== null && m.vo2max !== undefined && Number(m.vo2max) > 0)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Fallback if no history yet
    if (valid.length === 0) {
      const val = watchVo2 > 0 ? watchVo2 : (profile?.vo2max || 44.8);
      const today = new Date().toISOString().slice(0, 10);
      const single: MetricPoint[] = [{
        date: today,
        displayDate: format(parseISO(today), 'd MMM', { locale: th }),
        vo2max: val,
        resting_hr: profile?.hr_rest,
        fitness_age: profile?.fitness_age,
        diff: 0,
      }];
      return {
        testPoints: single,
        all30DaysPoints: single,
        currentVo2: val,
        peakVo2: val,
        lowVo2: val,
        latestChange: 0,
      };
    }

    // Map test points with formatted dates and diffs
    const tests: MetricPoint[] = valid.map((item: any, idx: number) => {
      let displayDate = item.date;
      try {
        displayDate = format(parseISO(item.date), 'd MMM', { locale: th });
      } catch {}

      const prev = idx > 0 ? valid[idx - 1] : null;
      const prevVo2 = prev?.vo2max != null ? Number(prev.vo2max) : null;
      const currentVal = Number(item.vo2max);
      const diff = prevVo2 !== null ? Math.round((currentVal - prevVo2) * 10) / 10 : null;

      return {
        date: item.date,
        displayDate,
        vo2max: currentVal,
        resting_hr: item.resting_hr,
        fitness_age: item.fitness_age,
        diff,
      };
    });

    // Map 30-day continuous points
    let lastKnown = tests[0]?.vo2max || 44.8;
    const sortedHistory = [...history].sort((a: any, b: any) => a.date.localeCompare(b.date));
    const all30: MetricPoint[] = sortedHistory.map((item: any) => {
      let displayDate = item.date;
      try {
        displayDate = format(parseISO(item.date), 'd/MM');
      } catch {}
      if (item.vo2max != null && Number(item.vo2max) > 0) {
        lastKnown = Number(item.vo2max);
      }
      return {
        date: item.date,
        displayDate,
        vo2max: lastKnown,
        resting_hr: item.resting_hr,
        fitness_age: item.fitness_age,
      };
    });

    const values = tests.map((t) => t.vo2max);
    const curr = watchVo2 > 0 ? watchVo2 : (tests[tests.length - 1]?.vo2max || profile?.vo2max || 44.8);
    const peak = values.length > 0 ? Math.max(...values) : curr;
    const low = values.length > 0 ? Math.min(...values) : curr;
    const change = tests.length >= 2 ? (tests[tests.length - 1].diff ?? 0) : 0;

    return {
      testPoints: tests,
      all30DaysPoints: all30,
      currentVo2: curr,
      peakVo2: peak,
      lowVo2: low,
      latestChange: change,
    };
  }, [profile?.fitness_age_data?.metrics_history, profile?.vo2max, profile?.hr_rest, profile?.fitness_age, watchVo2]);

  const activeData = viewMode === 'tests' ? testPoints : all30DaysPoints;
  const tier = getVo2Tier(currentVo2);

  // Calculate Y-axis domain
  const yDomain = useMemo(() => {
    const vals = activeData.map((d) => d.vo2max);
    const minVal = vals.length > 0 ? Math.min(...vals) : 40;
    const maxVal = vals.length > 0 ? Math.max(...vals) : 48;
    return [Math.floor(minVal - 1), Math.ceil(maxVal + 1)];
  }, [activeData]);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ── Compact Header Row: Input + Current Value + Garmin Badge ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {/* Left: Input with Garmin indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label
            htmlFor="p-vo2"
            style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--color-text)',
              whiteSpace: 'nowrap',
            }}
          >
            VO₂max
          </label>
          <div style={{ width: 72 }}>
            <input
              id="p-vo2"
              type="number"
              step="0.1"
              className="form-input"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '1rem',
                fontWeight: 700,
                textAlign: 'center',
                padding: '3px 6px',
                height: 30,
                borderRadius: 8,
              }}
              {...register('vo2max')}
              placeholder="44.8"
            />
          </div>
          {profile?.vo2max && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: '0.625rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 6,
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                whiteSpace: 'nowrap',
              }}
              title="Garmin Connect Synced"
            >
              <SealCheck size={11} weight="fill" />
              Garmin {profile.vo2max}
            </span>
          )}
          {onRefresh && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                height: 28,
                width: 28,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
              }}
              title="รีเฟรช Garmin"
            >
              <ArrowsClockwise
                size={13}
                style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}
              />
            </button>
          )}
        </div>

        {/* Right: Current Value, Tier Chip & Trend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '1.25rem',
              fontWeight: 800,
              color: tier.color,
              lineHeight: 1,
            }}
          >
            {currentVo2.toFixed(1)}
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 6,
              background: tier.bg,
              color: tier.color,
              whiteSpace: 'nowrap',
            }}
          >
            {tier.short}
          </span>
          {latestChange !== 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: latestChange > 0 ? '#10B981' : '#EF4444',
                fontFamily: "'Barlow Condensed', sans-serif",
              }}
            >
              {latestChange > 0 ? <TrendUp size={12} weight="bold" /> : <TrendDown size={12} weight="bold" />}
              {latestChange > 0 ? `+${latestChange.toFixed(1)}` : latestChange.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* ── Slim Micro-Stats Row: Peak, Low, and Toggle (Height ~24px) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 6,
          padding: '4px 8px',
          background: 'var(--color-bg-elevated)',
          borderRadius: 8,
          fontSize: '0.6875rem',
          color: 'var(--color-text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>
            สูงสุด: <strong style={{ color: '#10B981', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8125rem' }}>{peakVo2.toFixed(1)}</strong>
          </span>
          <span>
            ต่ำสุด: <strong style={{ color: '#F59E0B', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8125rem' }}>{lowVo2.toFixed(1)}</strong>
          </span>
          {profile?.fitness_age && (
            <span>
              อายุความฟิต: <strong style={{ color: 'var(--color-text)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8125rem' }}>{profile.fitness_age} ปี</strong>
            </span>
          )}
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'inline-flex', gap: 2 }}>
          <button
            type="button"
            onClick={() => setViewMode('tests')}
            style={{
              padding: '1px 6px',
              fontSize: '0.625rem',
              fontWeight: viewMode === 'tests' ? 700 : 500,
              borderRadius: 4,
              border: 'none',
              background: viewMode === 'tests' ? 'var(--color-primary)' : 'transparent',
              color: viewMode === 'tests' ? '#FFF' : 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
          >
            รอบวิ่ง ({testPoints.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('30days')}
            style={{
              padding: '1px 6px',
              fontSize: '0.625rem',
              fontWeight: viewMode === '30days' ? 700 : 500,
              borderRadius: 4,
              border: 'none',
              background: viewMode === '30days' ? 'var(--color-primary)' : 'transparent',
              color: viewMode === '30days' ? '#FFF' : 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
          >
            30 วัน
          </button>
        </div>
      </div>

      {/* ── Compact Line Chart (Height ~140px, perfectly sized for mobile) ── */}
      <div style={{ width: '100%', height: 140, marginTop: 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={activeData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-muted)" vertical={false} />
            <XAxis
              dataKey="displayDate"
              tick={{ fill: 'var(--color-text-muted)', fontSize: 9, fontFamily: 'Mali, sans-serif' }}
              axisLine={{ stroke: 'var(--color-border-muted)' }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 9, fontFamily: 'Barlow Condensed, sans-serif' }}
              axisLine={{ stroke: 'var(--color-border-muted)' }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as MetricPoint;
                  const pointTier = getVo2Tier(data.vo2max);
                  return (
                    <div
                      style={{
                        background: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                        padding: '6px 10px',
                        boxShadow: 'var(--shadow-sm)',
                        fontSize: '0.6875rem',
                        fontFamily: 'Mali, sans-serif',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                        {data.date}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>VO₂max:</span>
                        <span
                          style={{
                            fontFamily: 'Barlow Condensed, sans-serif',
                            fontSize: '1rem',
                            fontWeight: 800,
                            color: pointTier.color,
                          }}
                        >
                          {data.vo2max.toFixed(1)}
                        </span>
                        <span style={{ fontSize: '0.625rem', color: pointTier.color, fontWeight: 600 }}>
                          ({pointTier.short})
                        </span>
                      </div>
                      {data.diff !== null && data.diff !== undefined && (
                        <div style={{ fontSize: '0.625rem', color: data.diff >= 0 ? '#10B981' : '#EF4444' }}>
                          {data.diff > 0 ? `+${data.diff.toFixed(1)}` : data.diff < 0 ? `${data.diff.toFixed(1)}` : '0.0 (คงที่)'}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              y={44.0}
              stroke="#10B981"
              strokeDasharray="3 3"
              strokeWidth={1}
              label={{
                value: 'ดีเยี่ยม (44.0)',
                fill: '#10B981',
                fontSize: 8,
                position: 'insideBottomLeft',
                offset: 4,
              }}
            />
            <Line
              type="monotone"
              dataKey="vo2max"
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              dot={{
                r: 3.5,
                fill: 'var(--color-primary)',
                stroke: 'var(--color-bg-surface)',
                strokeWidth: 1.5,
              }}
              activeDot={{
                r: 5,
                fill: 'var(--color-primary)',
                stroke: 'var(--color-bg-surface)',
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
