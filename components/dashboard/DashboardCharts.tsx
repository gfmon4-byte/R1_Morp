'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import type { Activity } from '@/lib/supabase';
import type { HRZone } from '@/lib/hrZones';
import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns';

interface Props {
  activities: Activity[];
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

export function DashboardCharts({ activities, hrZones }: Props) {
  const [paceHrFilter, setPaceHrFilter] = useState<string>('All');

  // ---- Weekly Distance (last 8 weeks) ----
  const weeklyData = useMemo(() => {
    const weeks: Record<string, number> = {};
    activities.forEach((a) => {
      if (!a.date || a.distance_km <= 0) return;
      const weekKey = format(startOfWeek(parseISO(a.date), { weekStartsOn: 1 }), 'MMM d');
      weeks[weekKey] = (weeks[weekKey] || 0) + a.distance_km;
    });
    return Object.entries(weeks)
      .slice(-8)
      .map(([week, km]) => ({ week, km: parseFloat(km.toFixed(1)) }));
  }, [activities]);

  // ---- Monthly Volume (last 12 months) ----
  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    activities.forEach((a) => {
      if (!a.date || a.distance_km <= 0) return;
      const mKey = format(startOfMonth(parseISO(a.date)), 'MMM yy');
      months[mKey] = (months[mKey] || 0) + a.distance_km;
    });
    return Object.entries(months)
      .slice(-12)
      .map(([month, km]) => ({ month, km: parseFloat(km.toFixed(1)) }));
  }, [activities]);

  // ---- Pace vs HR (last 20 running activities, filterable) ----
  const paceHrData = useMemo(() => {
    const filtered = paceHrFilter === 'All'
      ? activities
      : activities.filter((a) => a.session_type === paceHrFilter);
    return filtered
      .filter((a) => a.avg_pace_sec_per_km && a.avg_hr && a.distance_km > 0)
      .slice(0, 20)
      .map((a) => ({
        date: format(parseISO(a.date), 'MMM d'),
        pace: parseFloat((a.avg_pace_sec_per_km! / 60).toFixed(2)),
        hr: a.avg_hr,
        type: a.session_type,
      }))
      .reverse();
  }, [activities, paceHrFilter]);

  // ---- HR Zone Distribution ----
  const zoneDistribution = useMemo(() => {
    return hrZones.map((z) => ({
      name: z.label,
      description: z.description,
      bpm: `${z.minBpm}–${z.maxBpm}`,
      value: activities.reduce((sum, a) => {
        const breakdown = a.hr_zone_breakdown as Record<string, number> | null;
        if (!breakdown) return sum;
        return sum + (breakdown[`Z${z.zone}`] || 0);
      }, 0),
      color: z.color,
    })).filter((d) => d.value > 0);
  }, [activities, hrZones]);

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
      <ChartCard title="HR Zone Distribution" unit="">
        {zoneDistribution.length === 0 ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', flexDirection: 'column', gap: 8 }}>
            <span>No HR zone data yet.</span>
            <span style={{ fontSize: '0.75rem' }}>Add activities with zone breakdown to see this chart.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={zoneDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={72}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {zoneDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CustomTooltipStyle} formatter={(v) => [`${v ?? 0}s`, 'Time']} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hrZones.map((z) => (
                <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: z.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{z.label} </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{z.description}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: z.color, fontWeight: 600, fontFamily: 'Barlow Condensed, sans-serif' }}>
                    {z.minBpm}–{z.maxBpm}
                  </span>
                </div>
              ))}
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
