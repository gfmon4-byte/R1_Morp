'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { Heart } from '@phosphor-icons/react';
import { formatDuration } from '@/lib/utils';
import type { Activity } from '@/lib/supabase';
import type { HRZone } from '@/lib/hrZones';
import {
  format,
  parseISO,
  startOfWeek,
  startOfMonth,
  subMonths,
  eachMonthOfInterval,
  subWeeks,
  eachWeekOfInterval,
} from 'date-fns';

interface Props {
  activities: Activity[];
  allActivities?: Activity[];
  hrZones: HRZone[];
}

const CHART_STYLE = {
  background: 'transparent',
  fontFamily: 'Barlow, sans-serif',
};

const CustomTooltipStyle = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: '0.8125rem',
  color: '#F8FAFC',
};

export function DashboardCharts({ activities, allActivities, hrZones }: Props) {
  const [paceHrFilter, setPaceHrFilter] = useState<string>('All');
  const sourceActivities = allActivities ?? activities;

  // ---- Weekly Distance (last 8 weeks, sorted left to right) ----
  const weeklyData = useMemo(() => {
    const now = new Date();
    const endWeek = startOfWeek(now, { weekStartsOn: 1 });
    const startWeek = subWeeks(endWeek, 7);
    const intervals = eachWeekOfInterval({ start: startWeek, end: endWeek }, { weekStartsOn: 1 });

    const totals: Record<string, number> = {};
    sourceActivities.forEach((a) => {
      if (!a.date || a.distance_km <= 0) return;
      const key = format(startOfWeek(parseISO(a.date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      totals[key] = (totals[key] || 0) + a.distance_km;
    });

    return intervals.map((w) => {
      const key = format(w, 'yyyy-MM-dd');
      return {
        week: format(w, 'MMM d'),
        km: parseFloat((totals[key] || 0).toFixed(1)),
      };
    });
  }, [sourceActivities]);

  // ---- Monthly Volume (last 12 months, fixed 1 year back, sorted left to right) ----
  const monthlyData = useMemo(() => {
    const now = new Date();
    const endMonth = startOfMonth(now);
    const startMonth = subMonths(endMonth, 11);
    const intervals = eachMonthOfInterval({ start: startMonth, end: endMonth });

    const totals: Record<string, number> = {};
    sourceActivities.forEach((a) => {
      if (!a.date || a.distance_km <= 0) return;
      const key = format(startOfMonth(parseISO(a.date)), 'yyyy-MM');
      totals[key] = (totals[key] || 0) + a.distance_km;
    });

    return intervals.map((m) => {
      const key = format(m, 'yyyy-MM');
      return {
        month: format(m, 'MMM yy'),
        km: parseFloat((totals[key] || 0).toFixed(1)),
      };
    });
  }, [sourceActivities]);

  // ---- Pace vs HR (last 20 running activities, filterable, sorted left to right) ----
  const paceHrData = useMemo(() => {
    const filtered = paceHrFilter === 'All'
      ? sourceActivities
      : sourceActivities.filter((a) => a.session_type === paceHrFilter);

    return filtered
      .filter((a) => a.date && a.avg_pace_sec_per_km && a.avg_hr && a.distance_km > 0)
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((a) => ({
        date: format(parseISO(a.date), 'MMM d'),
        pace: parseFloat((a.avg_pace_sec_per_km! / 60).toFixed(2)),
        hr: a.avg_hr,
        type: a.session_type,
      }));
  }, [sourceActivities, paceHrFilter]);

  // ---- HR Zone Distribution Stats ----
  const zoneStats = useMemo(() => {
    // Prefer filtered activities if they have zone breakdown, else fallback to sourceActivities
    const hasFilteredData = activities.some((a) => {
      const b = a.hr_zone_breakdown as Record<string, number> | null;
      return b && Object.values(b).some((v) => typeof v === 'number' && v > 0);
    });
    const target = hasFilteredData ? activities : sourceActivities;

    const rawTotals: Record<string, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
    target.forEach((a) => {
      const breakdown = a.hr_zone_breakdown as Record<string, number> | null;
      if (!breakdown) return;
      Object.entries(breakdown).forEach(([k, v]) => {
        if (typeof v === 'number' && v > 0) {
          rawTotals[k] = (rawTotals[k] || 0) + v;
        }
      });
    });

    const totalSeconds = Object.values(rawTotals).reduce((sum, s) => sum + s, 0);

    const zones = hrZones.map((z) => {
      const seconds = rawTotals[`Z${z.zone}`] || 0;
      const pct = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0;
      return {
        zone: z.zone,
        name: z.label,
        description: z.description,
        minBpm: z.minBpm,
        maxBpm: z.maxBpm,
        bpm: `${z.minBpm}–${z.maxBpm}`,
        color: z.color,
        seconds,
        formattedTime: formatDuration(seconds),
        percentage: pct,
      };
    });

    const donutData = zones
      .filter((z) => z.seconds > 0)
      .map((z) => ({
        name: `${z.name} (${z.description})`,
        label: z.name,
        description: z.description,
        value: z.seconds,
        percentage: z.percentage,
        color: z.color,
      }));

    return {
      totalSeconds,
      formattedTotalTime: formatDuration(totalSeconds),
      zones,
      donutData,
    };
  }, [activities, sourceActivities, hrZones]);

  const runTypes = ['All', 'Easy Run', 'Long Run', 'Tempo', 'Intervals', 'Recovery Run'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Weekly Distance */}
      <ChartCard title="Weekly Distance" unit="km">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyData} style={CHART_STYLE} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="week" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={CustomTooltipStyle}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              formatter={(v) => [`${v ?? 0} km`, 'Distance']}
            />
            <Bar dataKey="km" fill="var(--color-primary)" radius={[5, 5, 0, 0]}>
              {weeklyData.map((_, i) => (
                <Cell key={i} fill={i === weeklyData.length - 1 ? 'var(--color-primary)' : 'rgba(255,118,216,0.55)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Monthly Volume */}
      <ChartCard title="Monthly Volume" unit="km">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={monthlyData} style={CHART_STYLE}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={CustomTooltipStyle}
              formatter={(v) => [`${v ?? 0} km`, 'Volume']}
            />
            <Line
              type="monotone"
              dataKey="km"
              stroke="#059669"
              strokeWidth={2.5}
              dot={{ fill: '#059669', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#059669' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Pace vs HR */}
      <ChartCard
        title="Pace vs Heart Rate"
        unit=""
        action={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {runTypes.map((t) => (
              <button
                key={t}
                onClick={() => setPaceHrFilter(t)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 100,
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  fontFamily: 'Barlow, sans-serif',
                  border: 'none',
                  cursor: 'pointer',
                  background: paceHrFilter === t ? 'var(--color-primary)' : 'rgba(255,255,255,0.07)',
                  color: paceHrFilter === t ? '#fff' : '#64748B',
                  transition: 'all 0.15s',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        }
      >
        {paceHrData.length === 0 ? (
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            No data for this filter
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={paceHrData} style={CHART_STYLE}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="pace"
                orientation="left"
                tick={{ fill: 'var(--color-primary)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`}
              />
              <YAxis
                yAxisId="hr"
                orientation="right"
                tick={{ fill: '#EF4444', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={CustomTooltipStyle}
                formatter={(value, name) => {
                  const v = Number(value ?? 0);
                  if (name === 'pace') {
                    const m = Math.floor(v);
                    const s = Math.round((v % 1) * 60);
                    return [`${m}:${String(s).padStart(2, '0')}/km`, 'Pace'];
                  }
                  return [`${v} bpm`, 'HR'];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '0.75rem', color: '#64748B' }}
              />
              <Bar yAxisId="pace" dataKey="pace" name="pace" fill="rgba(255,118,216,0.4)" radius={[3, 3, 0, 0]} />
              <Line yAxisId="hr" type="monotone" dataKey="hr" name="hr" stroke="#EF4444" strokeWidth={2} dot={{ r: 3, fill: '#EF4444', strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* HR Zone Distribution */}
      <ChartCard
        title="HR Zone Distribution"
        unit=""
        action={
          zoneStats.totalSeconds > 0 ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                borderRadius: 100,
                background: 'rgba(255,143,163,0.12)',
                border: '1px solid rgba(255,143,163,0.25)',
                color: 'var(--color-primary)',
                fontSize: '0.75rem',
                fontWeight: 700,
                fontFamily: "'Baloo 2', sans-serif",
              }}
            >
              <Heart size={13} weight="fill" />
              <span>{zoneStats.formattedTotalTime}</span>
            </div>
          ) : undefined
        }
      >
        {zoneStats.totalSeconds === 0 ? (
          <div
            style={{
              padding: '20px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(255,143,163,0.12)',
                border: '1px solid rgba(255,143,163,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <Heart size={22} weight="fill" />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-foreground)', fontFamily: "'Baloo 2', sans-serif" }}>
                ยังไม่มีข้อมูล HR Zone
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                บันทึกการวิ่งที่มีข้อมูล Heart Rate เพื่อดูสัดส่วนความเข้มข้นของการซ้อม
              </p>
            </div>

            {/* Target Zones Reference */}
            <div
              style={{
                width: '100%',
                marginTop: 6,
                padding: '12px',
                borderRadius: 12,
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                โซนเป้าหมายของคุณ (Karvonen HRR)
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
                {zoneStats.zones.map((z) => (
                  <div
                    key={z.zone}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 8px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                      borderLeft: `3px solid ${z.color}`,
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: z.color }}>{z.name}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, textAlign: 'left' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {z.description}
                      </span>
                      <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>
                        {z.bpm}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Multi-Zone Segmented Proportion Bar */}
            <div
              style={{
                display: 'flex',
                height: 8,
                borderRadius: 999,
                overflow: 'hidden',
                gap: 2,
                background: 'rgba(255,255,255,0.06)',
              }}
            >
              {zoneStats.zones.map((z) =>
                z.percentage > 0 ? (
                  <div
                    key={z.zone}
                    style={{
                      width: `${z.percentage}%`,
                      backgroundColor: z.color,
                      borderRadius: 2,
                      transition: 'width 0.4s ease',
                    }}
                    title={`${z.name} (${z.description}): ${z.percentage.toFixed(1)}%`}
                  />
                ) : null
              )}
            </div>

            {/* Donut Chart & Detailed Zone Rows */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              {/* Donut with Center Stat */}
              <div
                style={{
                  position: 'relative',
                  width: 150,
                  height: 150,
                  margin: '0 auto',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={zoneStats.donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={68}
                      dataKey="value"
                      paddingAngle={3}
                      stroke="none"
                    >
                      {zoneStats.donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CustomTooltipStyle}
                      formatter={(v, name, item) => [
                        `${formatDuration(Number(v))} (${(item.payload as any)?.percentage?.toFixed(1) ?? 0}%)`,
                        item.payload.name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut Center Display */}
                <div
                  style={{
                    position: 'absolute',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <Heart size={15} weight="fill" color="#FF8FA3" />
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 800,
                      color: 'var(--color-text)',
                      fontFamily: "'Baloo 2', sans-serif",
                      lineHeight: 1.1,
                      marginTop: 2,
                    }}
                  >
                    {zoneStats.formattedTotalTime}
                  </span>
                  <span
                    style={{
                      fontSize: '0.625rem',
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      fontWeight: 600,
                    }}
                  >
                    Total
                  </span>
                </div>
              </div>

              {/* Zone Cards List */}
              <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {zoneStats.zones.map((z) => (
                  <div
                    key={z.zone}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderLeft: `3.5px solid ${z.color}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: 5,
                            background: `${z.color}22`,
                            color: z.color,
                            fontFamily: "'Baloo 2', sans-serif",
                          }}
                        >
                          {z.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>
                          {z.description}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                          · {z.bpm}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            fontFamily: "'Baloo 2', sans-serif",
                            color: z.seconds > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
                          }}
                        >
                          {z.seconds > 0 ? z.formattedTime : '0m'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            color: z.seconds > 0 ? z.color : 'var(--color-text-muted)',
                            minWidth: 32,
                            textAlign: 'right',
                          }}
                        >
                          {z.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Mini Progress Bar */}
                    <div
                      style={{
                        width: '100%',
                        height: 3.5,
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.06)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${z.percentage}%`,
                          height: '100%',
                          backgroundColor: z.color,
                          borderRadius: 999,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, unit, children, action }: { title: string; unit: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <div>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text)' }}>{title}</h3>
          {unit && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{unit}</span>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}
