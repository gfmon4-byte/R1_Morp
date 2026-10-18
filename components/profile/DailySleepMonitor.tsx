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
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Moon,
  Bed,
  MoonStars,
  ArrowsClockwise,
  BatteryCharging,
  CheckCircle,
  Warning,
  Heart,
  Lightning,
} from '@phosphor-icons/react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import type { GarminSleepRecord } from '@/lib/supabase';

interface Props {
  sleepRecords?: GarminSleepRecord[];
  onRefresh?: () => Promise<void> | void;
  lastSyncTime?: string | null;
}

const STAGE_COLORS = {
  deep: '#10B981',    // Emerald / Green
  light: '#38BDF8',   // Sky Blue
  rem: '#A855F7',     // Purple
  awake: '#FB7185',   // Coral Pink
};

function formatHoursAndMinutes(hours?: number | null): string {
  if (!hours || isNaN(hours) || hours <= 0) return '0 น.';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h} ชม. ${m} น.`;
  if (h > 0) return `${h} ชม.`;
  return `${m} น.`;
}

function formatShortDuration(hours?: number | null): string {
  if (!hours || isNaN(hours) || hours <= 0) return '0h';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatBedtimeWindow(start?: number | string | null, end?: number | string | null): string | null {
  if (!start || !end) return null;
  try {
    const sDate = typeof start === 'number' ? new Date(start) : new Date(String(start));
    const eDate = typeof end === 'number' ? new Date(end) : new Date(String(end));
    if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) return null;
    const sStr = sDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    const eStr = eDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${sStr} – ${eStr} น.`;
  } catch {
    return null;
  }
}

function getScoreBadge(score?: number | null, qualifier?: string | null) {
  if (score == null) {
    return {
      text: 'ไม่มีคะแนน',
      label: 'N/A',
      bg: 'var(--color-bg-elevated)',
      color: 'var(--color-text-muted)',
      border: 'var(--color-border)',
    };
  }
  if (score >= 80) {
    return {
      text: `${score} ดีเยี่ยม`,
      label: qualifier || 'GOOD',
      bg: 'rgba(16, 185, 129, 0.15)',
      color: '#059669',
      border: 'rgba(16, 185, 129, 0.3)',
    };
  }
  if (score >= 60) {
    return {
      text: `${score} พอใช้`,
      label: qualifier || 'FAIR',
      bg: 'rgba(56, 189, 248, 0.15)',
      color: '#0284C7',
      border: 'rgba(56, 189, 248, 0.3)',
    };
  }
  return {
    text: `${score} ควรพักเพิ่ม`,
    label: qualifier || 'POOR',
    bg: 'rgba(244, 63, 94, 0.15)',
    color: '#E11D48',
    border: 'rgba(244, 63, 94, 0.3)',
  };
}

export function DailySleepMonitor({ sleepRecords = [], onRefresh }: Props) {
  const [activeTab, setActiveTab] = useState<'stages' | 'score' | 'hrv'>('stages');
  const [timeframe, setTimeframe] = useState<'7' | '14' | '30'>('7');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Sort chronological
  const sortedRecords = useMemo(() => {
    if (!sleepRecords || sleepRecords.length === 0) return [];
    return [...sleepRecords].sort((a, b) => a.date.localeCompare(b.date));
  }, [sleepRecords]);

  // Selected date state (default to latest night)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const activeDate = useMemo(() => {
    if (selectedDate && sortedRecords.some((r) => r.date === selectedDate)) {
      return selectedDate;
    }
    return sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1].date : null;
  }, [selectedDate, sortedRecords]);

  const activeRecord = useMemo(() => {
    if (!activeDate) return null;
    return sortedRecords.find((r) => r.date === activeDate) || null;
  }, [activeDate, sortedRecords]);

  // Timeframe slice
  const filteredRecords = useMemo(() => {
    if (sortedRecords.length === 0) return [];
    const count = parseInt(timeframe, 10);
    return sortedRecords.slice(-count);
  }, [sortedRecords, timeframe]);

  // Average metrics
  const avgMetrics = useMemo(() => {
    if (sortedRecords.length === 0) return null;
    const count = sortedRecords.length;
    const totalDuration = sortedRecords.reduce((acc, r) => acc + (r.duration_hours || 0), 0);
    const avgDuration = totalDuration / count;

    const scored = sortedRecords.filter((r) => r.score != null && r.score > 0);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((acc, r) => acc + (r.score || 0), 0) / scored.length)
      : null;

    const totalDeep = sortedRecords.reduce((acc, r) => acc + (r.deep_hours || 0), 0);
    const avgDeep = totalDeep / count;
    const deepPct = avgDuration > 0 ? Math.round((avgDeep / avgDuration) * 100) : 0;

    return {
      avgDuration,
      avgScore,
      avgDeep,
      deepPct,
      totalNights: count,
    };
  }, [sortedRecords]);

  // Chart data formatting
  const chartData = useMemo(() => {
    return filteredRecords.map((r) => {
      let shortDay = r.date;
      let dayName = '';
      try {
        const d = parseISO(r.date);
        shortDay = format(d, 'd/M');
        dayName = format(d, 'EEE', { locale: th });
      } catch (e) {}

      return {
        date: r.date,
        shortDay,
        dayName,
        label: `${dayName} ${shortDay}`,
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
        isSelected: r.date === activeDate,
      };
    });
  }, [filteredRecords, activeDate]);

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

  // Active record computations
  const activeTotalH = activeRecord?.duration_hours || 0;
  const activeDeepPct = activeTotalH > 0 ? Math.round(((activeRecord?.deep_hours || 0) / activeTotalH) * 100) : 0;
  const activeLightPct = activeTotalH > 0 ? Math.round(((activeRecord?.light_hours || 0) / activeTotalH) * 100) : 0;
  const activeRemPct = activeTotalH > 0 ? Math.round(((activeRecord?.rem_hours || 0) / activeTotalH) * 100) : 0;
  const activeAwakePct = activeTotalH > 0 ? Math.max(0, 100 - activeDeepPct - activeLightPct - activeRemPct) : 0;
  const activeBadge = getScoreBadge(activeRecord?.score, activeRecord?.qualifier);
  const activeBedtime = formatBedtimeWindow(activeRecord?.start_time, activeRecord?.end_time);

  let activeDateLabel = activeRecord?.date || '';
  try {
    if (activeRecord?.date) {
      activeDateLabel = format(parseISO(activeRecord.date), 'EEEEที่ d MMMM yyyy', { locale: th });
    }
  } catch (e) {}

  return (
    <div
      style={{
        background: 'var(--color-bg-card)',
        borderRadius: 20,
        border: '1px solid var(--color-border)',
        padding: '16px',
        marginBottom: '20px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(201, 167, 235, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MoonStars size={20} weight="fill" color="var(--color-secondary)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.0625rem',
                  fontWeight: 700,
                  fontFamily: "'Baloo 2', sans-serif",
                  color: 'var(--color-foreground)',
                  lineHeight: 1.2,
                }}
              >
                Sleep Monitor
              </h3>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#059669',
                  padding: '2px 6px',
                  borderRadius: 5,
                  fontFamily: "'Baloo 2', sans-serif",
                }}
              >
                Garmin Venu 3
              </span>
            </div>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: '0.6875rem',
                color: 'var(--color-text-muted)',
                fontFamily: "'Mali', sans-serif",
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              ติดตามคุณภาพการนอน & การฟื้นฟูร่างกาย
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualSync}
          disabled={syncing}
          className="btn btn-ghost btn-sm"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: '0.75rem',
            padding: '6px 10px',
            borderRadius: 10,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            cursor: syncing ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
          title="ซิงค์ข้อมูลจาก Garmin Connect"
        >
          <ArrowsClockwise
            size={13}
            style={{
              animation: syncing ? 'spin 1s linear infinite' : 'none',
            }}
          />
          <span style={{ fontWeight: 600 }}>{syncing ? 'กำลังซิงค์' : 'Sync'}</span>
        </button>
      </div>

      {syncMsg && (
        <div
          style={{
            marginBottom: 14,
            padding: '8px 12px',
            borderRadius: 10,
            fontSize: '0.75rem',
            background: syncMsg.includes('เรียบร้อย')
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(244, 63, 94, 0.15)',
            color: syncMsg.includes('เรียบร้อย') ? '#059669' : 'var(--color-destructive)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {syncMsg.includes('เรียบร้อย') ? <CheckCircle size={15} /> : <Warning size={15} />}
          <span>{syncMsg}</span>
        </div>
      )}

      {/* Empty State */}
      {sortedRecords.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            background: 'var(--color-bg-elevated)',
            borderRadius: 16,
            border: '2px dashed var(--color-border)',
          }}
        >
          <Bed size={32} color="var(--color-secondary)" style={{ marginBottom: 8, opacity: 0.8 }} />
          <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '0.875rem' }}>
            ยังไม่มีข้อมูลการนอนจาก Garmin Connect
          </p>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8 }}
          >
            <ArrowsClockwise size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลการนอน'}
          </button>
        </div>
      ) : (
        <>
          {/* ========================================================
              HERO CARD: Selected Night Spotlight (Mobile Optimized)
             ======================================================== */}
          {activeRecord && (
            <div
              style={{
                background: 'var(--color-bg-elevated)',
                borderRadius: 16,
                padding: '16px',
                border: '1.5px solid var(--color-border)',
                marginBottom: 16,
                position: 'relative',
              }}
            >
              {/* Top Row: Date & Status Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Moon size={15} weight="fill" color="var(--color-secondary)" />
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: 'var(--color-foreground)',
                      fontFamily: "'Baloo 2', sans-serif",
                    }}
                  >
                    {activeDateLabel}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: activeBadge.bg,
                    color: activeBadge.color,
                    border: `1px solid ${activeBadge.border}`,
                    fontFamily: "'Baloo 2', sans-serif",
                  }}
                >
                  {activeBadge.text}
                </span>
              </div>

              {/* Main Numbers: Total Duration + Target Info */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '1.75rem',
                      fontWeight: 800,
                      fontFamily: "'Baloo 2', sans-serif",
                      color: 'var(--color-foreground)',
                      lineHeight: 1,
                      letterSpacing: '-0.5px',
                    }}
                  >
                    {formatHoursAndMinutes(activeTotalH)}
                  </div>
                  {activeBedtime && (
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--color-text-muted)',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Bed size={12} />
                      <span>{activeBedtime}</span>
                    </div>
                  )}
                </div>

                {/* Target badge */}
                <div
                  style={{
                    textAlign: 'right',
                    fontSize: '0.6875rem',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <div>เป้าหมาย 7–8 ชม.</div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: activeTotalH >= 7 ? '#059669' : 'var(--color-primary)',
                      marginTop: 2,
                    }}
                  >
                    {activeTotalH >= 7
                      ? '✓ บรรลุเป้าหมาย'
                      : `ขาดอีก ${formatHoursAndMinutes(Math.max(0, 7 - activeTotalH))}`}
                  </div>
                </div>
              </div>

              {/* Segmented Stage Visual Progress Bar */}
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    height: 10,
                    borderRadius: 6,
                    background: 'var(--color-border-muted)',
                    display: 'flex',
                    overflow: 'hidden',
                    gap: '2px',
                  }}
                >
                  {activeDeepPct > 0 && (
                    <div
                      style={{
                        width: `${activeDeepPct}%`,
                        background: STAGE_COLORS.deep,
                        borderRadius: '4px',
                      }}
                      title={`Deep: ${activeRecord.deep_hours}h (${activeDeepPct}%)`}
                    />
                  )}
                  {activeLightPct > 0 && (
                    <div
                      style={{
                        width: `${activeLightPct}%`,
                        background: STAGE_COLORS.light,
                        borderRadius: '4px',
                      }}
                      title={`Light: ${activeRecord.light_hours}h (${activeLightPct}%)`}
                    />
                  )}
                  {activeRemPct > 0 && (
                    <div
                      style={{
                        width: `${activeRemPct}%`,
                        background: STAGE_COLORS.rem,
                        borderRadius: '4px',
                      }}
                      title={`REM: ${activeRecord.rem_hours}h (${activeRemPct}%)`}
                    />
                  )}
                  {activeAwakePct > 0 && (
                    <div
                      style={{
                        width: `${activeAwakePct}%`,
                        background: STAGE_COLORS.awake,
                        borderRadius: '4px',
                      }}
                      title={`Awake: ${activeRecord.awake_hours}h (${activeAwakePct}%)`}
                    />
                  )}
                </div>
              </div>

              {/* 4 Stage Pills (Mobile 2x2 Grid) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {/* Deep */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: STAGE_COLORS.deep,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>
                      หลับลึก (Deep)
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-foreground)',
                        fontFamily: "'Baloo 2', sans-serif",
                      }}
                    >
                      {formatHoursAndMinutes(activeRecord.deep_hours)}{' '}
                      <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600 }}>
                        ({activeDeepPct}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* REM */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: STAGE_COLORS.rem,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>
                      ช่วงฝัน (REM)
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-foreground)',
                        fontFamily: "'Baloo 2', sans-serif",
                      }}
                    >
                      {formatHoursAndMinutes(activeRecord.rem_hours)}{' '}
                      <span style={{ fontSize: '0.6875rem', color: '#7C3AED', fontWeight: 600 }}>
                        ({activeRemPct}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Light */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: STAGE_COLORS.light,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>
                      หลับตื้น (Light)
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-foreground)',
                        fontFamily: "'Baloo 2', sans-serif",
                      }}
                    >
                      {formatHoursAndMinutes(activeRecord.light_hours)}{' '}
                      <span style={{ fontSize: '0.6875rem', color: '#0284C7', fontWeight: 600 }}>
                        ({activeLightPct}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Awake */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: STAGE_COLORS.awake,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>
                      ตื่น (Awake)
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-foreground)',
                        fontFamily: "'Baloo 2', sans-serif",
                      }}
                    >
                      {formatHoursAndMinutes(activeRecord.awake_hours)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recovery Quick Chips Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                  paddingTop: 10,
                  borderTop: '1px solid var(--color-border-muted)',
                  fontSize: '0.6875rem',
                }}
              >
                {activeRecord.avg_hrv != null && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 8,
                      background: 'rgba(201, 167, 235, 0.2)',
                      color: 'var(--color-secondary)',
                      fontWeight: 600,
                    }}
                  >
                    <Lightning size={12} weight="fill" />
                    HRV {activeRecord.avg_hrv} ms
                  </span>
                )}
                {activeRecord.avg_hr != null && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 8,
                      background: 'rgba(251, 113, 133, 0.15)',
                      color: '#E11D48',
                      fontWeight: 600,
                    }}
                  >
                    <Heart size={12} weight="fill" />
                    HR {Math.round(activeRecord.avg_hr)} bpm
                  </span>
                )}
                {activeRecord.body_battery_change != null && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 8,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#059669',
                      fontWeight: 600,
                    }}
                  >
                    <BatteryCharging size={13} weight="fill" />
                    +{activeRecord.body_battery_change} ชาร์จพลัง
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              3 COMPACT METRIC CARDS (Average stats)
             ======================================================== */}
          {avgMetrics && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  background: 'var(--color-bg-elevated)',
                  borderRadius: 12,
                  padding: '10px 8px',
                  textAlign: 'center',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>
                  เวลานอนเฉลี่ย
                </div>
                <div
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 800,
                    fontFamily: "'Baloo 2', sans-serif",
                    color: 'var(--color-foreground)',
                  }}
                >
                  {formatShortDuration(avgMetrics.avgDuration)}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--color-bg-elevated)',
                  borderRadius: 12,
                  padding: '10px 8px',
                  textAlign: 'center',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>
                  คะแนนเฉลี่ย
                </div>
                <div
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 800,
                    fontFamily: "'Baloo 2', sans-serif",
                    color: avgMetrics.avgScore && avgMetrics.avgScore >= 70 ? '#059669' : '#0284C7',
                  }}
                >
                  {avgMetrics.avgScore ?? '-'}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--color-bg-elevated)',
                  borderRadius: 12,
                  padding: '10px 8px',
                  textAlign: 'center',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>
                  หลับลึกเฉลี่ย
                </div>
                <div
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 800,
                    fontFamily: "'Baloo 2', sans-serif",
                    color: '#059669',
                  }}
                >
                  {avgMetrics.deepPct}%
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              CONTROLS: Tab switcher + Timeframe
             ======================================================== */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 12,
            }}
          >
            {/* Main Tabs (Full width segmented control) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                background: 'var(--color-bg-elevated)',
                borderRadius: 12,
                padding: '3px',
                border: '1px solid var(--color-border)',
                gap: 2,
              }}
            >
              {[
                { key: 'stages', label: 'สเตจการนอน' },
                { key: 'score', label: 'คะแนนการนอน' },
                { key: 'hrv', label: 'HRV & ชีพจร' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as any)}
                  style={{
                    padding: '6px 4px',
                    borderRadius: 9,
                    border: 'none',
                    fontSize: '0.6875rem',
                    fontWeight: activeTab === tab.key ? 700 : 500,
                    cursor: 'pointer',
                    background: activeTab === tab.key ? 'var(--color-bg-card)' : 'transparent',
                    color: activeTab === tab.key ? 'var(--color-foreground)' : 'var(--color-text-muted)',
                    boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Timeframe + Tap Hint */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: '0.625rem',
                  color: 'var(--color-text-muted)',
                  fontFamily: "'Mali', sans-serif",
                }}
              >
                💡 แตะแท่งกราฟเพื่อดูสถิติของวันนั้น
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {[
                  { key: '7', label: '7 วัน' },
                  { key: '14', label: '14 วัน' },
                  { key: '30', label: '30 วัน' },
                ].map((tf) => (
                  <button
                    key={tf.key}
                    type="button"
                    onClick={() => setTimeframe(tf.key as any)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid',
                      borderColor: timeframe === tf.key ? 'var(--color-secondary)' : 'var(--color-border)',
                      background: timeframe === tf.key ? 'rgba(201, 167, 235, 0.15)' : 'transparent',
                      color: timeframe === tf.key ? 'var(--color-secondary)' : 'var(--color-text-muted)',
                      fontSize: '0.625rem',
                      fontWeight: timeframe === tf.key ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================================
              RESPONSIVE RECHARTS CONTAINER
             ======================================================== */}
          <div
            style={{
              width: '100%',
              height: 210,
              background: 'var(--color-bg-elevated)',
              borderRadius: 14,
              padding: '12px 8px 6px 0',
              border: '1px solid var(--color-border)',
              position: 'relative',
              marginBottom: 16,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === 'stages' ? (
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 6, left: -22, bottom: 0 }}
                  onClick={(state: any) => {
                    if (state?.activePayload && state.activePayload.length > 0) {
                      const clicked = state.activePayload[0].payload;
                      if (clicked?.date) setSelectedDate(clicked.date);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-muted)" vertical={false} />
                  <XAxis
                    dataKey="shortDay"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                    unit="h"
                    domain={[0, (dataMax: number) => Math.max(8.5, Math.ceil(dataMax + 0.5))]}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <Tooltip content={<MobileCustomTooltip />} />
                  <ReferenceLine
                    y={7}
                    stroke="var(--color-primary)"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                  />
                  <Bar dataKey="deep" stackId="s" fill={STAGE_COLORS.deep} radius={[0, 0, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-deep-${index}`}
                        stroke={entry.isSelected ? 'var(--color-foreground)' : 'transparent'}
                        strokeWidth={entry.isSelected ? 2 : 0}
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="light" stackId="s" fill={STAGE_COLORS.light} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="rem" stackId="s" fill={STAGE_COLORS.rem} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="awake" stackId="s" fill={STAGE_COLORS.awake} radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : activeTab === 'score' ? (
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 6, left: -22, bottom: 0 }}
                  onClick={(state: any) => {
                    if (state?.activePayload && state.activePayload.length > 0) {
                      const clicked = state.activePayload[0].payload;
                      if (clicked?.date) setSelectedDate(clicked.date);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-muted)" vertical={false} />
                  <XAxis
                    dataKey="shortDay"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <Tooltip content={<MobileCustomTooltip />} />
                  <ReferenceLine y={80} stroke="#10B981" strokeDasharray="3 3" />
                  <ReferenceLine y={60} stroke="#38BDF8" strokeDasharray="3 3" />
                  <Bar dataKey="score" radius={[5, 5, 0, 0]} maxBarSize={28}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.score != null && entry.score >= 80
                            ? STAGE_COLORS.deep
                            : entry.score != null && entry.score >= 60
                            ? STAGE_COLORS.light
                            : STAGE_COLORS.awake
                        }
                        stroke={entry.isSelected ? 'var(--color-foreground)' : 'transparent'}
                        strokeWidth={entry.isSelected ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              ) : (
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 6, left: -22, bottom: 0 }}
                  onClick={(state: any) => {
                    if (state?.activePayload && state.activePayload.length > 0) {
                      const clicked = state.activePayload[0].payload;
                      if (clicked?.date) setSelectedDate(clicked.date);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-muted)" vertical={false} />
                  <XAxis
                    dataKey="shortDay"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <Tooltip content={<MobileCustomTooltip />} />
                  <Line
                    type="monotone"
                    name="HRV (ms)"
                    dataKey="hrv"
                    stroke="var(--color-secondary)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--color-secondary)' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    name="Sleeping HR"
                    dataKey="avgHr"
                    stroke="#FB7185"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#FB7185' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* ========================================================
              RECENT NIGHTS LIST (Clean Mobile Cards)
             ======================================================== */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  fontFamily: "'Baloo 2', sans-serif",
                  color: 'var(--color-foreground)',
                }}
              >
                ประวัติย้อนหลัง ({sortedRecords.length} คืน)
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                แตะเพื่อเลือกดูรายละเอียด
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...sortedRecords]
                .reverse()
                .map((record) => {
                  const isSelected = record.date === activeDate;
                  const totalH = record.duration_hours || 0;
                  const dPct = totalH > 0 ? Math.round(((record.deep_hours || 0) / totalH) * 100) : 0;
                  const lPct = totalH > 0 ? Math.round(((record.light_hours || 0) / totalH) * 100) : 0;
                  const rPct = totalH > 0 ? Math.round(((record.rem_hours || 0) / totalH) * 100) : 0;
                  const badge = getScoreBadge(record.score, record.qualifier);

                  let formattedDay = record.date;
                  try {
                    formattedDay = format(parseISO(record.date), 'EEE d MMM', { locale: th });
                  } catch (e) {}

                  return (
                    <div
                      key={record.date}
                      onClick={() => setSelectedDate(record.date)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: isSelected ? 'var(--color-bg-card)' : 'var(--color-bg-elevated)',
                        border: isSelected ? '2px solid var(--color-secondary)' : '1px solid var(--color-border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: isSelected ? 'var(--color-secondary)' : 'var(--color-foreground)',
                              fontFamily: "'Baloo 2', sans-serif",
                            }}
                          >
                            {formattedDay}
                          </span>
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.text}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 800,
                            fontFamily: "'Baloo 2', sans-serif",
                            color: 'var(--color-foreground)',
                          }}
                        >
                          {formatShortDuration(totalH)}
                        </div>
                      </div>

                      {/* Mini Bar */}
                      <div
                        style={{
                          height: 5,
                          borderRadius: 3,
                          background: 'var(--color-border-muted)',
                          display: 'flex',
                          overflow: 'hidden',
                          gap: '1px',
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ width: `${dPct}%`, background: STAGE_COLORS.deep }} />
                        <div style={{ width: `${lPct}%`, background: STAGE_COLORS.light }} />
                        <div style={{ width: `${rPct}%`, background: STAGE_COLORS.rem }} />
                      </div>

                      {/* Micro Pills */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.625rem',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span>หลับลึก {formatShortDuration(record.deep_hours)}</span>
                          <span>ฝัน {formatShortDuration(record.rem_hours)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {record.avg_hrv != null && <span>HRV {record.avg_hrv} ms</span>}
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

// Mobile Clean Custom Tooltip
function MobileCustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      style={{
        background: 'var(--color-bg-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 10,
        padding: '8px 10px',
        boxShadow: 'var(--shadow-md)',
        fontSize: '0.6875rem',
        minWidth: 140,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '0.75rem', marginBottom: 4, color: 'var(--color-foreground)' }}>
        {data.label || data.date}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: 'var(--color-text-muted)' }}>เวลานอน:</span>
        <strong>{formatShortDuration(data.total)}</strong>
      </div>
      {data.score != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>คะแนน:</span>
          <strong style={{ color: data.score >= 80 ? '#059669' : data.score >= 60 ? '#0284C7' : '#E11D48' }}>
            {data.score}
          </strong>
        </div>
      )}
      {data.hrv != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>HRV:</span>
          <strong>{data.hrv} ms</strong>
        </div>
      )}
    </div>
  );
}
