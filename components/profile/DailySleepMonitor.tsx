'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Moon,
  Bed,
  MoonStars,
  Sparkle,
  Heartbeat,
  Waveform,
  ArrowsClockwise,
  BatteryCharging,
  CheckCircle,
  WarningCircle,
  Info,
} from '@phosphor-icons/react';
import { format, parseISO } from 'date-fns';
import type { GarminSleepRecord } from '@/lib/supabase';

interface Props {
  sleepRecords?: GarminSleepRecord[];
  onRefresh?: () => Promise<void> | void;
  lastSyncTime?: string | null;
}

const STAGE_COLORS = {
  deep: '#7FDBB6',    // Pastel Mint
  light: '#8ECDF0',   // Pastel Sky Blue
  rem: '#C9A7EB',     // Pastel Lavender
  awake: '#FF8FA3',   // Pastel Coral Pink
};

function formatHoursAndMinutes(hours: number): string {
  if (!hours || isNaN(hours)) return '0 ชม.';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h} ชม. ${m} น.`;
  if (h > 0) return `${h} ชม.`;
  return `${m} น.`;
}

function getScoreBadge(score?: number | null, qualifier?: string | null) {
  if (score == null) return { text: 'ไม่มีคะแนน', bg: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' };
  if (score >= 80) return { text: `${score} ดีเยี่ยม (${qualifier || 'GOOD'})`, bg: 'rgba(127, 219, 182, 0.2)', color: '#059669' };
  if (score >= 60) return { text: `${score} พอใช้ (${qualifier || 'FAIR'})`, bg: 'rgba(142, 205, 240, 0.2)', color: '#0284C7' };
  return { text: `${score} ควรพักเพิ่ม (${qualifier || 'POOR'})`, bg: 'rgba(255, 143, 163, 0.2)', color: '#E11D48' };
}

export function DailySleepMonitor({ sleepRecords = [], onRefresh, lastSyncTime }: Props) {
  const [activeTab, setActiveTab] = useState<'stages' | 'score' | 'hrv'>('stages');
  const [timeframe, setTimeframe] = useState<'7' | '14' | '30' | 'all'>('14');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Filter and sort records chronologically
  const filteredRecords = useMemo(() => {
    if (!sleepRecords || sleepRecords.length === 0) return [];
    const sorted = [...sleepRecords].sort((a, b) => a.date.localeCompare(b.date));
    if (timeframe === '7') return sorted.slice(-7);
    if (timeframe === '14') return sorted.slice(-14);
    if (timeframe === '30') return sorted.slice(-30);
    return sorted;
  }, [sleepRecords, timeframe]);

  // Summary Metrics computed from all or filtered records
  const metrics = useMemo(() => {
    if (!sleepRecords || sleepRecords.length === 0) return null;
    const sorted = [...sleepRecords].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];

    const count = sorted.length;
    const totalDuration = sorted.reduce((acc, r) => acc + (r.duration_hours || 0), 0);
    const avgDuration = totalDuration / count;

    const scoredRecords = sorted.filter((r) => r.score != null && r.score > 0);
    const avgScore = scoredRecords.length > 0
      ? Math.round(scoredRecords.reduce((acc, r) => acc + (r.score || 0), 0) / scoredRecords.length)
      : null;

    const totalDeep = sorted.reduce((acc, r) => acc + (r.deep_hours || 0), 0);
    const avgDeep = totalDeep / count;
    const deepPct = avgDuration > 0 ? Math.round((avgDeep / avgDuration) * 100) : 0;

    const totalRem = sorted.reduce((acc, r) => acc + (r.rem_hours || 0), 0);
    const avgRem = totalRem / count;
    const remPct = avgDuration > 0 ? Math.round((avgRem / avgDuration) * 100) : 0;

    const hrvRecords = sorted.filter((r) => r.avg_hrv != null && r.avg_hrv > 0);
    const avgHrv = hrvRecords.length > 0
      ? Math.round(hrvRecords.reduce((acc, r) => acc + (r.avg_hrv || 0), 0) / hrvRecords.length)
      : null;

    const hrRecords = sorted.filter((r) => r.avg_hr != null && r.avg_hr > 0);
    const avgSleepingHr = hrRecords.length > 0
      ? Math.round(hrRecords.reduce((acc, r) => acc + (r.avg_hr || 0), 0) / hrRecords.length)
      : null;

    return {
      latest,
      avgDuration,
      avgScore,
      avgDeep,
      deepPct,
      avgRem,
      remPct,
      avgHrv,
      avgSleepingHr,
      totalNights: count,
    };
  }, [sleepRecords]);

  // Prepare chart dataset
  const chartData = useMemo(() => {
    return filteredRecords.map((r) => {
      let label = r.date;
      try {
        label = format(parseISO(r.date), 'dd/MM');
      } catch (e) {}

      return {
        date: r.date,
        label,
        deep: r.deep_hours || 0,
        light: r.light_hours || 0,
        rem: r.rem_hours || 0,
        awake: r.awake_hours || 0,
        total: r.duration_hours || 0,
        score: r.score ?? null,
        qualifier: r.qualifier || '',
        hrv: r.avg_hrv ?? null,
        avgHr: r.avg_hr ?? null,
        bodyBattery: r.body_battery_change ?? null,
      };
    });
  }, [filteredRecords]);

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/garmin-profile-sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Sync failed');
      }
      setSyncMsg('ซิงค์ข้อมูลการนอนเรียบร้อยแล้ว ✨');
      if (onRefresh) {
        await onRefresh();
      }
      setTimeout(() => setSyncMsg(null), 3500);
    } catch (err: any) {
      setSyncMsg(`เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถเชื่อมต่อได้'}`);
      setTimeout(() => setSyncMsg(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--color-bg-card)',
        borderRadius: 20,
        border: '1px solid var(--color-border)',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'rgba(201, 167, 235, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MoonStars size={22} weight="fill" color="var(--color-secondary)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  fontFamily: "'Baloo 2', sans-serif",
                  color: 'var(--color-foreground)',
                }}
              >
                Daily Sleep Monitor
              </h3>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  background: 'rgba(127, 219, 182, 0.2)',
                  color: '#059669',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontFamily: "'Baloo 2', sans-serif",
                }}
              >
                Garmin Venu 3
              </span>
            </div>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                fontFamily: "'Mali', sans-serif",
              }}
            >
              ติดตามระยะเวลา คุณภาพการนอน และการฟื้นฟูร่างกายแต่ละคืน
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing}
            className="btn btn-ghost btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.75rem',
              padding: '6px 12px',
              borderRadius: 10,
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              cursor: syncing ? 'not-allowed' : 'pointer',
            }}
            title="ดึงข้อมูลการนอนล่าสุดจาก Garmin Connect"
          >
            <ArrowsClockwise
              size={14}
              style={{
                animation: syncing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            {syncing ? 'กำลังซิงค์...' : 'Sync Sleep'}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div
          style={{
            marginBottom: 16,
            padding: '8px 12px',
            borderRadius: 10,
            fontSize: '0.8125rem',
            background: syncMsg.includes('เรียบร้อย')
              ? 'rgba(127, 219, 182, 0.15)'
              : 'rgba(255, 107, 129, 0.15)',
            color: syncMsg.includes('เรียบร้อย') ? '#059669' : 'var(--color-destructive)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {syncMsg.includes('เรียบร้อย') ? <CheckCircle size={16} /> : <WarningCircle size={16} />}
          <span>{syncMsg}</span>
        </div>
      )}

      {/* Empty State */}
      {(!sleepRecords || sleepRecords.length === 0) ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 16px',
            background: 'var(--color-bg-elevated)',
            borderRadius: 16,
            border: '2px dashed var(--color-border)',
          }}
        >
          <Bed size={36} color="var(--color-secondary)" style={{ marginBottom: 10, opacity: 0.8 }} />
          <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '0.9375rem' }}>
            ยังไม่มีข้อมูลการนอนจาก Garmin Connect
          </p>
          <p
            style={{
              margin: '0 0 16px',
              fontSize: '0.8125rem',
              color: 'var(--color-text-muted)',
              maxWidth: 400,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            กดปุ่มซิงค์เพื่อเชื่อมต่อและดึงสถิติการนอนจากนาฬิกา Garmin Venu 3 ของคุณ
          </p>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowsClockwise size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'กำลังดึงข้อมูล...' : 'ซิงค์ข้อมูลการนอนตอนนี้'}
          </button>
        </div>
      ) : (
        <>
          {/* Metric Summary Cards Grid */}
          {metrics && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                marginBottom: 20,
              }}
            >
              {/* Card 1: Latest Night */}
              <div
                style={{
                  background: 'var(--color-bg-elevated)',
                  borderRadius: 16,
                  padding: '14px',
                  border: '1px solid var(--color-border)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    คืนล่าสุด ({metrics.latest?.date ? format(parseISO(metrics.latest.date), 'dd MMM') : '-'})
                  </span>
                  <Moon size={14} color="var(--color-secondary)" weight="fill" />
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    fontFamily: "'Baloo 2', sans-serif",
                    color: 'var(--color-foreground)',
                    lineHeight: 1.1,
                    marginBottom: 4,
                  }}
                >
                  {formatHoursAndMinutes(metrics.latest?.duration_hours || 0)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {(() => {
                    const badge = getScoreBadge(metrics.latest?.score, metrics.latest?.qualifier);
                    return (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {badge.text}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Card 2: Average Duration */}
              <div
                style={{
                  background: 'var(--color-bg-elevated)',
                  borderRadius: 16,
                  padding: '14px',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    เวลานอนเฉลี่ย
                  </span>
                  <Bed size={14} color="var(--color-sky)" weight="fill" />
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    fontFamily: "'Baloo 2', sans-serif",
                    color: 'var(--color-foreground)',
                    lineHeight: 1.1,
                    marginBottom: 4,
                  }}
                >
                  {formatHoursAndMinutes(metrics.avgDuration)}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                  เป้าหมาย: 7–8 ชม./คืน
                </div>
              </div>

              {/* Card 3: Deep Sleep Ratio */}
              <div
                style={{
                  background: 'var(--color-bg-elevated)',
                  borderRadius: 16,
                  padding: '14px',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    หลับลึก (Deep Sleep)
                  </span>
                  <Sparkle size={14} color="var(--color-accent)" weight="fill" />
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    fontFamily: "'Baloo 2', sans-serif",
                    color: '#059669',
                    lineHeight: 1.1,
                    marginBottom: 4,
                  }}
                >
                  {formatHoursAndMinutes(metrics.avgDeep)}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                  สัดส่วน <strong>{metrics.deepPct}%</strong> (เกณฑ์ 15–25%)
                </div>
              </div>

              {/* Card 4: Overnight HRV & Battery */}
              <div
                style={{
                  background: 'var(--color-bg-elevated)',
                  borderRadius: 16,
                  padding: '14px',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    HRV / การฟื้นฟู
                  </span>
                  <Waveform size={14} color="var(--color-primary)" weight="bold" />
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    fontFamily: "'Baloo 2', sans-serif",
                    color: 'var(--color-foreground)',
                    lineHeight: 1.1,
                    marginBottom: 4,
                  }}
                >
                  {metrics.latest?.avg_hrv ? `${metrics.latest.avg_hrv} ms` : '-'}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {metrics.latest?.body_battery_change != null && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#059669', fontWeight: 600 }}>
                      <BatteryCharging size={12} />+{metrics.latest.body_battery_change}
                    </span>
                  )}
                  {metrics.latest?.avg_hr && (
                    <span>HR {Math.round(metrics.latest.avg_hr)} bpm</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Controls: Chart Mode Tabs & Timeframe */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 16,
            }}
          >
            {/* Chart Type Tabs */}
            <div
              style={{
                display: 'flex',
                background: 'var(--color-bg-elevated)',
                borderRadius: 12,
                padding: '3px',
                border: '1px solid var(--color-border)',
              }}
            >
              {[
                { key: 'stages', label: 'ระยะเวลานอน & Stages' },
                { key: 'score', label: 'คะแนนการนอน (Score)' },
                { key: 'hrv', label: 'HRV & ชีพจร' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as any)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 9,
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: activeTab === tab.key ? 700 : 500,
                    cursor: 'pointer',
                    background: activeTab === tab.key ? 'var(--color-bg-card)' : 'transparent',
                    color: activeTab === tab.key ? 'var(--color-foreground)' : 'var(--color-text-muted)',
                    boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Timeframe Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[
                { key: '7', label: '7 วัน' },
                { key: '14', label: '14 วัน' },
                { key: '30', label: '30 วัน' },
                { key: 'all', label: 'ทั้งหมด' },
              ].map((tf) => (
                <button
                  key={tf.key}
                  type="button"
                  onClick={() => setTimeframe(tf.key as any)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: timeframe === tf.key ? 'var(--color-secondary)' : 'var(--color-border)',
                    background: timeframe === tf.key ? 'rgba(201, 167, 235, 0.15)' : 'transparent',
                    color: timeframe === tf.key ? 'var(--color-secondary)' : 'var(--color-text-muted)',
                    fontSize: '0.6875rem',
                    fontWeight: timeframe === tf.key ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Rendering Container */}
          <div
            style={{
              width: '100%',
              height: 260,
              background: 'var(--color-bg-elevated)',
              borderRadius: 16,
              padding: '16px 12px 10px 0',
              border: '1px solid var(--color-border)',
              position: 'relative',
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === 'stages' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-muted)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    unit="h"
                    domain={[0, (dataMax: number) => Math.max(9, Math.ceil(dataMax + 0.5))]}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomSleepTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '0.75rem', paddingBottom: 10, fontFamily: "'Mali', sans-serif" }}
                  />
                  <ReferenceLine
                    y={7}
                    stroke="var(--color-primary)"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: 'เป้าหมาย 7 ชม.',
                      position: 'insideTopLeft',
                      fill: 'var(--color-primary)',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  />
                  <Bar dataKey="deep" name="Deep (หลับลึก)" stackId="sleep" fill={STAGE_COLORS.deep} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="light" name="Light (หลับตื้น)" stackId="sleep" fill={STAGE_COLORS.light} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="rem" name="REM (ช่วงฝัน)" stackId="sleep" fill={STAGE_COLORS.rem} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="awake" name="Awake (ตื่น)" stackId="sleep" fill={STAGE_COLORS.awake} radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : activeTab === 'score' ? (
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-muted)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomScoreTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '0.75rem', paddingBottom: 10, fontFamily: "'Mali', sans-serif" }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#059669"
                    strokeDasharray="3 3"
                    label={{ value: 'Good (80)', position: 'insideTopLeft', fill: '#059669', fontSize: 10 }}
                  />
                  <ReferenceLine
                    y={60}
                    stroke="#EAB308"
                    strokeDasharray="3 3"
                    label={{ value: 'Fair (60)', position: 'insideTopLeft', fill: '#EAB308', fontSize: 10 }}
                  />
                  <Bar dataKey="score" name="Sleep Score" radius={[6, 6, 0, 0]} maxBarSize={36}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.score != null && entry.score >= 80
                            ? '#7FDBB6'
                            : entry.score != null && entry.score >= 60
                            ? '#8ECDF0'
                            : '#FF8FA3'
                        }
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-muted)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomRecoveryTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '0.75rem', paddingBottom: 10, fontFamily: "'Mali', sans-serif" }}
                  />
                  <Line
                    type="monotone"
                    name="Overnight HRV (ms)"
                    dataKey="hrv"
                    stroke="var(--color-secondary)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: 'var(--color-secondary)' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    name="Sleeping HR (bpm)"
                    dataKey="avgHr"
                    stroke="#FF8FA3"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#FF8FA3' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Stage Guide Badges */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: 12,
              background: 'var(--color-bg-elevated)',
              fontSize: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: STAGE_COLORS.deep }} />
              <span style={{ color: 'var(--color-text-muted)' }}>
                <strong>Deep Sleep</strong> (ฟื้นฟูกล้ามเนื้อ & ร่างกาย)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: STAGE_COLORS.rem }} />
              <span style={{ color: 'var(--color-text-muted)' }}>
                <strong>REM Sleep</strong> (ฟื้นฟูสมอง & อารมณ์)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: STAGE_COLORS.light }} />
              <span style={{ color: 'var(--color-text-muted)' }}>
                <strong>Light Sleep</strong> (การพักผ่อนทั่วไป)
              </span>
            </div>
          </div>

          {/* Recent Nights Breakdown List */}
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  fontFamily: "'Baloo 2', sans-serif",
                  color: 'var(--color-foreground)',
                }}
              >
                ประวัติการนอนแต่ละคืน (Recent Nights)
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {filteredRecords.length} คืนล่าสุด
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...filteredRecords]
                .reverse()
                .map((record) => {
                  let formattedDate = record.date;
                  try {
                    formattedDate = format(parseISO(record.date), 'EEEE dd MMMM yyyy');
                  } catch (e) {}

                  const totalH = record.duration_hours || 0;
                  const deepPct = totalH > 0 ? Math.round(((record.deep_hours || 0) / totalH) * 100) : 0;
                  const lightPct = totalH > 0 ? Math.round(((record.light_hours || 0) / totalH) * 100) : 0;
                  const remPct = totalH > 0 ? Math.round(((record.rem_hours || 0) / totalH) * 100) : 0;
                  const badge = getScoreBadge(record.score, record.qualifier);

                  return (
                    <div
                      key={record.date}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-foreground)' }}>
                            {record.date}
                          </span>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 6,
                              background: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.text}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontSize: '0.9375rem',
                              fontWeight: 800,
                              fontFamily: "'Baloo 2', sans-serif",
                              color: 'var(--color-foreground)',
                            }}
                          >
                            {formatHoursAndMinutes(totalH)}
                          </span>
                        </div>
                      </div>

                      {/* Mini Stage Stack Bar */}
                      <div
                        style={{
                          height: 8,
                          borderRadius: 4,
                          background: 'var(--color-border-muted)',
                          display: 'flex',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ width: `${deepPct}%`, background: STAGE_COLORS.deep }} title={`Deep: ${record.deep_hours}h (${deepPct}%)`} />
                        <div style={{ width: `${lightPct}%`, background: STAGE_COLORS.light }} title={`Light: ${record.light_hours}h (${lightPct}%)`} />
                        <div style={{ width: `${remPct}%`, background: STAGE_COLORS.rem }} title={`REM: ${record.rem_hours}h (${remPct}%)`} />
                      </div>

                      {/* Detail Footer */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.6875rem',
                          color: 'var(--color-text-muted)',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 10 }}>
                          <span>Deep: <strong>{formatHoursAndMinutes(record.deep_hours)}</strong> ({deepPct}%)</span>
                          <span>Light: <strong>{formatHoursAndMinutes(record.light_hours)}</strong></span>
                          <span>REM: <strong>{formatHoursAndMinutes(record.rem_hours)}</strong> ({remPct}%)</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          {record.avg_hrv != null && <span>HRV: <strong>{record.avg_hrv} ms</strong></span>}
                          {record.avg_hr != null && <span>HR: <strong>{Math.round(record.avg_hr)} bpm</strong></span>}
                          {record.body_battery_change != null && (
                            <span style={{ color: '#059669', fontWeight: 600 }}>
                              🔋 +{record.body_battery_change}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Custom Tooltip for Stages
function CustomSleepTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: 'var(--shadow-md)',
        fontSize: '0.75rem',
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 6, color: 'var(--color-foreground)' }}>
        วันที่ {data.date}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: 'var(--color-text-muted)' }}>เวลานอนทั้งหมด:</span>
        <strong style={{ color: 'var(--color-foreground)' }}>{formatHoursAndMinutes(data.total)}</strong>
      </div>
      {data.score != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Sleep Score:</span>
          <strong>{data.score} ({data.qualifier || 'FAIR'})</strong>
        </div>
      )}
      <div style={{ borderTop: '1px solid var(--color-border-muted)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
          <span>Deep Sleep:</span>
          <span>{formatHoursAndMinutes(data.deep)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0284C7' }}>
          <span>Light Sleep:</span>
          <span>{formatHoursAndMinutes(data.light)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7C3AED' }}>
          <span>REM Sleep:</span>
          <span>{formatHoursAndMinutes(data.rem)}</span>
        </div>
        {data.awake > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#E11D48' }}>
            <span>Awake (ตื่น):</span>
            <span>{formatHoursAndMinutes(data.awake)}</span>
          </div>
        )}
      </div>
      {(data.hrv || data.bodyBattery) && (
        <div style={{ borderTop: '1px solid var(--color-border-muted)', marginTop: 6, paddingTop: 4, display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
          {data.hrv && <span>HRV: {data.hrv} ms</span>}
          {data.bodyBattery && <span style={{ color: '#059669' }}>🔋 +{data.bodyBattery}</span>}
        </div>
      )}
    </div>
  );
}

// Custom Tooltip for Score
function CustomScoreTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: 'var(--shadow-md)',
        fontSize: '0.75rem',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>วันที่ {data.date}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>Sleep Score:</span>
        <strong style={{ fontSize: '0.9375rem', color: data.score >= 80 ? '#059669' : data.score >= 60 ? '#0284C7' : '#E11D48' }}>
          {data.score ?? '-'}
        </strong>
        <span>({data.qualifier || '-'})</span>
      </div>
      <div style={{ marginTop: 4, color: 'var(--color-text-muted)' }}>
        รวม: {formatHoursAndMinutes(data.total)}
      </div>
    </div>
  );
}

// Custom Tooltip for Recovery
function CustomRecoveryTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: 'var(--shadow-md)',
        fontSize: '0.75rem',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>วันที่ {data.date}</div>
      {data.hrv != null && (
        <div style={{ color: 'var(--color-secondary)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span>Overnight HRV:</span>
          <strong>{data.hrv} ms</strong>
        </div>
      )}
      {data.avgHr != null && (
        <div style={{ color: '#FF8FA3', display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 2 }}>
          <span>Sleeping HR:</span>
          <strong>{Math.round(data.avgHr)} bpm</strong>
        </div>
      )}
    </div>
  );
}
