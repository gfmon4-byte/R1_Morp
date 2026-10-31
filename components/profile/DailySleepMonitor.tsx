'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  ComposedChart,
  Area,
  Line,
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
  Sun,
  Bed,
  MoonStars,
  ArrowsClockwise,
  BatteryCharging,
  CheckCircle,
  Warning,
  Heart,
  Lightning,
  CaretLeft,
  CaretRight,
  CaretDown,
  CaretUp,
  Sparkle,
  Pulse,
  ChartBar,
  Trophy,
  Drop,
  Wind,
  Clock,
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
  deep: '#10B981',    // Emerald
  rem: '#A855F7',     // Purple
  light: '#38BDF8',   // Sky Blue
  awake: '#FB7185',   // Coral Rose
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

function formatBedtimeParts(start?: number | string | null, end?: number | string | null): { startStr: string; endStr: string } | null {
  if (!start || !end) return null;
  try {
    const sDate = typeof start === 'number' ? new Date(start) : new Date(String(start));
    const eDate = typeof end === 'number' ? new Date(end) : new Date(String(end));
    if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) return null;
    const startStr = sDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    const endStr = eDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    return { startStr, endStr };
  } catch {
    return null;
  }
}

function getScoreTheme(score?: number | null, qualifier?: string | null) {
  if (score == null) {
    return {
      text: 'ไม่มีคะแนน',
      shortText: 'N/A',
      qualifierLabel: 'NO SCORE',
      bg: 'var(--color-bg-elevated)',
      color: 'var(--color-text-muted)',
      stroke: '#94A3B8',
      border: 'var(--color-border)',
    };
  }
  if (score >= 85) {
    return {
      text: 'ยอดเยี่ยม',
      shortText: `${score} ยอดเยี่ยม`,
      qualifierLabel: qualifier || 'EXCELLENT',
      bg: 'rgba(16, 185, 129, 0.14)',
      color: '#059669',
      stroke: '#10B981',
      border: 'rgba(16, 185, 129, 0.32)',
    };
  }
  if (score >= 75) {
    return {
      text: 'ดีมาก',
      shortText: `${score} ดีมาก`,
      qualifierLabel: qualifier || 'GOOD',
      bg: 'rgba(16, 185, 129, 0.12)',
      color: '#10B981',
      stroke: '#10B981',
      border: 'rgba(16, 185, 129, 0.28)',
    };
  }
  if (score >= 60) {
    return {
      text: 'ปานกลาง',
      shortText: `${score} ปานกลาง`,
      qualifierLabel: qualifier || 'FAIR',
      bg: 'rgba(56, 189, 248, 0.14)',
      color: '#0284C7',
      stroke: '#38BDF8',
      border: 'rgba(56, 189, 248, 0.32)',
    };
  }
  return {
    text: 'ควรพักเพิ่ม',
    shortText: `${score} พักผ่อนน้อย`,
    qualifierLabel: qualifier || 'POOR',
    bg: 'rgba(244, 63, 94, 0.14)',
    color: '#E11D48',
    stroke: '#FB7185',
    border: 'rgba(244, 63, 94, 0.32)',
  };
}

function getSleepCoachInsight(record: GarminSleepRecord, deepPct: number, remPct: number): {
  title: string;
  desc: string;
  tone: 'good' | 'fair' | 'warn';
} {
  const score = record.score ?? 0;
  const totalH = record.duration_hours || 0;
  const bb = record.body_battery_change;

  if (score >= 80 && totalH >= 7) {
    return {
      title: 'ร่างกายฟื้นฟูเต็มที่ พร้อมซ้อมหนัก 💪',
      desc: `นอนครบ ${formatHoursAndMinutes(totalH)} (หลับลึก ${deepPct}%, REM ${remPct}%)${bb ? ` ชาร์จพลัง +${bb}%` : ''} เหมาะสำหรับโปรแกรมซ้อมหลักหรือวิ่งทำความเร็ว`,
      tone: 'good',
    };
  }
  if (totalH < 6) {
    return {
      title: 'ชั่วโมงการนอนน้อยกว่าเกณฑ์ 🌙',
      desc: `เมื่อคืนนอนไป ${formatHoursAndMinutes(totalH)} แนะนำให้เน้นวิ่ง Easy Run หรือพักผ่อนให้เร็วขึ้นในคืนนี้เพื่อลดความเสี่ยงบาดเจ็บ`,
      tone: 'warn',
    };
  }
  if (deepPct < 13 && totalH > 0) {
    return {
      title: 'สัดส่วนหลับลึกค่อนข้างน้อย 🧘‍♂️',
      desc: `หลับลึกอยู่ที่ ${deepPct}% (เกณฑ์แนะนำ 15–25%) ลองงดคาเฟอีนช่วงบ่ายและลดแสงหน้าจอก่อนนอน 30 นาที`,
      tone: 'fair',
    };
  }
  return {
    title: 'การฟื้นฟูอยู่ในเกณฑ์สมดุล ✨',
    desc: `คุณภาพการนอนระดับน่าพอใจ (${formatHoursAndMinutes(totalH)})${bb ? ` ชาร์จพลังงานได้ +${bb}%` : ''} รักษาวินัยการเข้านอนเวลาเดิมต่อเนื่อง`,
    tone: 'good',
  };
}

export function DailySleepMonitor({ sleepRecords = [], onRefresh, lastSyncTime }: Props) {
  const [activeTab, setActiveTab] = useState<'stages' | 'score' | 'hrv'>('stages');
  const [timeframe, setTimeframe] = useState<'7' | '14' | '30'>('7');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Sort chronological (oldest -> newest)
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

  const activeIndex = useMemo(() => {
    if (!activeDate) return -1;
    return sortedRecords.findIndex((r) => r.date === activeDate);
  }, [activeDate, sortedRecords]);

  const activeRecord = useMemo(() => {
    if (activeIndex < 0) return null;
    return sortedRecords[activeIndex] || null;
  }, [activeIndex, sortedRecords]);

  const isLatestSelected = activeIndex === sortedRecords.length - 1;

  // Quick 7-day strip (last 7 available records)
  const stripRecords = useMemo(() => {
    return sortedRecords.slice(-7);
  }, [sortedRecords]);

  // Timeframe slice for charts & timeframe averages
  const filteredRecords = useMemo(() => {
    if (sortedRecords.length === 0) return [];
    const count = parseInt(timeframe, 10);
    return sortedRecords.slice(-count);
  }, [sortedRecords, timeframe]);

  // Average metrics for the active timeframe
  const avgMetrics = useMemo(() => {
    if (filteredRecords.length === 0) return null;
    const count = filteredRecords.length;
    const totalDuration = filteredRecords.reduce((acc, r) => acc + (r.duration_hours || 0), 0);
    const avgDuration = totalDuration / count;

    const scored = filteredRecords.filter((r) => r.score != null && r.score > 0);
    const avgScore =
      scored.length > 0
        ? Math.round(scored.reduce((acc, r) => acc + (r.score || 0), 0) / scored.length)
        : null;

    const totalDeep = filteredRecords.reduce((acc, r) => acc + (r.deep_hours || 0), 0);
    const avgDeep = totalDeep / count;
    const deepPct = avgDuration > 0 ? Math.round((avgDeep / avgDuration) * 100) : 0;

    const hrvList = filteredRecords.filter((r) => r.avg_hrv != null && r.avg_hrv > 0);
    const avgHrv =
      hrvList.length > 0
        ? Math.round(hrvList.reduce((acc, r) => acc + (r.avg_hrv || 0), 0) / hrvList.length)
        : null;

    return {
      avgDuration,
      avgScore,
      avgDeep,
      deepPct,
      avgHrv,
      totalNights: count,
    };
  }, [filteredRecords]);

  // Chart data formatting
  const chartData = useMemo(() => {
    return filteredRecords.map((r) => {
      let shortDay = r.date;
      let dayName = '';
      try {
        const d = parseISO(r.date);
        shortDay = format(d, 'd/M');
        dayName = format(d, 'EEE', { locale: th });
      } catch {}

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
        avgHr: r.avg_hr ? Math.round(r.avg_hr) : null,
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
      setSyncMsg('ซิงค์ข้อมูลการนอนจาก Garmin เรียบร้อยแล้ว ✨');
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
  const activeAwakeH = activeRecord?.awake_hours || 0;
  const totalInBedH = activeTotalH + activeAwakeH;
  const sleepEfficiency = totalInBedH > 0 ? Math.round((activeTotalH / totalInBedH) * 100) : 100;

  const stageDenom = totalInBedH > 0 ? totalInBedH : activeTotalH || 1;
  const activeDeepPct = activeTotalH > 0 ? Math.round(((activeRecord?.deep_hours || 0) / activeTotalH) * 100) : 0;
  const activeRemPct = activeTotalH > 0 ? Math.round(((activeRecord?.rem_hours || 0) / activeTotalH) * 100) : 0;
  const activeLightPct = activeTotalH > 0 ? Math.round(((activeRecord?.light_hours || 0) / activeTotalH) * 100) : 0;
  const activeAwakePct = totalInBedH > 0 ? Math.max(0, Math.round((activeAwakeH / stageDenom) * 100)) : 0;

  // Normalized bar widths so the visual bar always sums to 100%
  const rawSum = (activeRecord?.deep_hours || 0) + (activeRecord?.rem_hours || 0) + (activeRecord?.light_hours || 0) + (activeRecord?.awake_hours || 0);
  const barDeepW = rawSum > 0 ? ((activeRecord?.deep_hours || 0) / rawSum) * 100 : 0;
  const barRemW = rawSum > 0 ? ((activeRecord?.rem_hours || 0) / rawSum) * 100 : 0;
  const barLightW = rawSum > 0 ? ((activeRecord?.light_hours || 0) / rawSum) * 100 : 0;
  const barAwakeW = rawSum > 0 ? ((activeRecord?.awake_hours || 0) / rawSum) * 100 : 0;

  const scoreTheme = getScoreTheme(activeRecord?.score, activeRecord?.qualifier);
  const bedtimeParts = formatBedtimeParts(activeRecord?.start_time, activeRecord?.end_time);
  const goalPct = Math.min(100, Math.round((activeTotalH / 7.5) * 100));

  let activeDateLabel = activeRecord?.date || '';
  try {
    if (activeRecord?.date) {
      activeDateLabel = format(parseISO(activeRecord.date), 'EEEEที่ d MMM yyyy', { locale: th });
    }
  } catch {}

  let formattedSyncTime: string | null = null;
  if (lastSyncTime) {
    try {
      formattedSyncTime = format(parseISO(lastSyncTime), 'd MMM HH:mm น.', { locale: th });
    } catch {}
  }

  const coachInsight = useMemo(() => {
    if (!activeRecord) return null;
    return getSleepCoachInsight(activeRecord, activeDeepPct, activeRemPct);
  }, [activeRecord, activeDeepPct, activeRemPct]);

  const reversedHistory = useMemo(() => {
    return [...sortedRecords].reverse();
  }, [sortedRecords]);

  const visibleHistory = showAllHistory ? reversedHistory : reversedHistory.slice(0, 5);

  // Radial gauge parameters
  const ringSize = 92;
  const strokeWidth = 8;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const scoreVal = activeRecord?.score ?? 0;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, scoreVal)) / 100) * circumference;

  return (
    <div
      className="card"
      style={{
        borderRadius: 24,
        padding: '20px 16px',
        marginBottom: '20px',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--color-bg-card)',
        border: '2px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Decorative Ambient Background Glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -60,
          right: -40,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.14) 0%, rgba(56, 189, 248, 0.05) 60%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ========================================================
          1. HEADER BAR
         ======================================================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 16,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.22), rgba(56, 189, 248, 0.22))',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.15)',
            }}
          >
            <MoonStars size={22} weight="fill" color="#A855F7" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  fontWeight: 800,
                  fontFamily: "'Baloo 2', sans-serif",
                  color: 'var(--color-foreground)',
                  lineHeight: 1.15,
                }}
              >
                Sleep & Recovery
              </h3>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#059669',
                  border: '1px solid rgba(16, 185, 129, 0.28)',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontFamily: "'Baloo 2', sans-serif",
                  letterSpacing: '0.02em',
                }}
              >
                ● Garmin Connect
              </span>
            </div>
            <p
              style={{
                margin: '3px 0 0',
                fontSize: '0.72rem',
                color: 'var(--color-text-muted)',
                fontFamily: "'Mali', sans-serif",
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {formattedSyncTime ? `อัปเดตล่าสุด ${formattedSyncTime}` : 'วิเคราะห์คุณภาพการนอนหลับและการฟื้นฟูร่างกาย'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualSync}
          disabled={syncing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.75rem',
            fontWeight: 700,
            fontFamily: "'Baloo 2', sans-serif",
            padding: '8px 14px',
            borderRadius: 999,
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-foreground)',
            border: '1.5px solid var(--color-border)',
            cursor: syncing ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'all 0.2s ease',
            boxShadow: 'var(--shadow-sm)',
          }}
          title="ซิงค์ข้อมูลจาก Garmin Connect"
        >
          <ArrowsClockwise
            size={14}
            weight="bold"
            color="var(--color-primary)"
            style={{
              animation: syncing ? 'spin 1s linear infinite' : 'none',
            }}
          />
          <span>{syncing ? 'กำลังซิงค์...' : 'Sync'}</span>
        </button>
      </div>

      {/* Sync Toast Message */}
      {syncMsg && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 14,
            fontSize: '0.78rem',
            fontWeight: 600,
            background: syncMsg.includes('เรียบร้อย')
              ? 'rgba(16, 185, 129, 0.14)'
              : 'rgba(244, 63, 94, 0.14)',
            border: `1px solid ${
              syncMsg.includes('เรียบร้อย') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'
            }`,
            color: syncMsg.includes('เรียบร้อย') ? '#059669' : 'var(--color-destructive)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {syncMsg.includes('เรียบร้อย') ? <CheckCircle size={16} weight="fill" /> : <Warning size={16} weight="fill" />}
          <span>{syncMsg}</span>
        </div>
      )}

      {/* ========================================================
          EMPTY STATE
         ======================================================== */}
      {sortedRecords.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 20px',
            background: 'var(--color-bg-elevated)',
            borderRadius: 20,
            border: '2px dashed var(--color-border)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(168, 85, 247, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <Bed size={28} color="#A855F7" weight="duotone" />
          </div>
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '0.95rem', fontFamily: "'Baloo 2', sans-serif" }}>
            ยังไม่มีข้อมูลการนอนจาก Garmin Connect
          </p>
          <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            กดซิงค์ข้อมูลเพื่อดึงสถิติการนอนหลับ Deep, REM, HRV และ Body Battery
          </p>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowsClockwise size={14} className={syncing ? 'spin' : ''} />
            {syncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลการนอน'}
          </button>
        </div>
      ) : (
        <>
          {/* ========================================================
              2. QUICK 7-NIGHT DATE SELECTOR STRIP
             ======================================================== */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${stripRecords.length}, minmax(0, 1fr))`,
              gap: 6,
              marginBottom: 14,
            }}
          >
            {stripRecords.map((rec) => {
              const isSelected = rec.date === activeDate;
              const st = getScoreTheme(rec.score, rec.qualifier);
              let dayShort = '';
              let dateNum = '';
              try {
                const d = parseISO(rec.date);
                dayShort = format(d, 'EEE', { locale: th });
                dateNum = format(d, 'd');
              } catch {}

              return (
                <button
                  key={rec.date}
                  type="button"
                  onClick={() => setSelectedDate(rec.date)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '7px 2px',
                    borderRadius: 14,
                    border: isSelected ? '2px solid #A855F7' : '1px solid var(--color-border)',
                    background: isSelected
                      ? 'linear-gradient(180deg, rgba(168, 85, 247, 0.18) 0%, rgba(168, 85, 247, 0.06) 100%)'
                      : 'var(--color-bg-elevated)',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isSelected ? '0 4px 10px rgba(168, 85, 247, 0.15)' : 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      color: isSelected ? '#A855F7' : 'var(--color-text-muted)',
                      lineHeight: 1.1,
                    }}
                  >
                    {dayShort}
                  </span>
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 800,
                      fontFamily: "'Baloo 2', sans-serif",
                      color: 'var(--color-foreground)',
                      lineHeight: 1.25,
                      margin: '1px 0 3px',
                    }}
                  >
                    {dateNum}
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: st.stroke,
                        display: 'inline-block',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        fontFamily: "'Baloo 2', sans-serif",
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {rec.score ?? '-'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ========================================================
              3. HERO SPOTLIGHT CARD (Selected Night)
             ======================================================== */}
          {activeRecord && (
            <div
              style={{
                background: 'linear-gradient(145deg, var(--color-bg-elevated) 0%, var(--color-bg-card) 100%)',
                borderRadius: 20,
                padding: '16px',
                border: '1.5px solid var(--color-border)',
                marginBottom: 16,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Date Navigation Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 14,
                  paddingBottom: 10,
                  borderBottom: '1px solid var(--color-border-muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    disabled={activeIndex <= 0}
                    onClick={() => activeIndex > 0 && setSelectedDate(sortedRecords[activeIndex - 1].date)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-card)',
                      color: 'var(--color-foreground)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: activeIndex <= 0 ? 'not-allowed' : 'pointer',
                      opacity: activeIndex <= 0 ? 0.35 : 1,
                    }}
                    aria-label="คืนก่อนหน้า"
                  >
                    <CaretLeft size={14} weight="bold" />
                  </button>
                  <button
                    type="button"
                    disabled={isLatestSelected}
                    onClick={() =>
                      activeIndex < sortedRecords.length - 1 &&
                      setSelectedDate(sortedRecords[activeIndex + 1].date)
                    }
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-card)',
                      color: 'var(--color-foreground)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isLatestSelected ? 'not-allowed' : 'pointer',
                      opacity: isLatestSelected ? 0.35 : 1,
                    }}
                    aria-label="คืนถัดไป"
                  >
                    <CaretRight size={14} weight="bold" />
                  </button>
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: 'var(--color-foreground)',
                      fontFamily: "'Baloo 2', sans-serif",
                      marginLeft: 2,
                    }}
                  >
                    {activeDateLabel}
                  </span>
                </div>

                {!isLatestSelected ? (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(sortedRecords[sortedRecords.length - 1].date)}
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: 'rgba(168, 85, 247, 0.15)',
                      color: '#A855F7',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      cursor: 'pointer',
                      fontFamily: "'Baloo 2', sans-serif",
                    }}
                  >
                    กลับไปคืนล่าสุด ↻
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: scoreTheme.bg,
                      color: scoreTheme.color,
                      border: `1px solid ${scoreTheme.border}`,
                      fontFamily: "'Baloo 2', sans-serif",
                    }}
                  >
                    คืนล่าสุด • {scoreTheme.text}
                  </span>
                )}
              </div>

              {/* Hero Centerpiece: Radial Score Gauge + Total Sleep Duration */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginBottom: 16,
                  flexWrap: 'wrap',
                }}
              >
                {/* Radial Score Ring */}
                <div
                  style={{
                    position: 'relative',
                    width: ringSize,
                    height: ringSize,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                      cx={ringSize / 2}
                      cy={ringSize / 2}
                      r={radius}
                      fill="transparent"
                      stroke="var(--color-border-muted)"
                      strokeWidth={strokeWidth}
                    />
                    <circle
                      cx={ringSize / 2}
                      cy={ringSize / 2}
                      r={radius}
                      fill="transparent"
                      stroke={scoreTheme.stroke}
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
                    />
                  </svg>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        fontFamily: "'Baloo 2', sans-serif",
                        color: 'var(--color-foreground)',
                        lineHeight: 1,
                      }}
                    >
                      {activeRecord.score ?? '—'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        color: scoreTheme.color,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginTop: 2,
                        fontFamily: "'Baloo 2', sans-serif",
                      }}
                    >
                      {scoreTheme.text}
                    </span>
                  </div>
                </div>

                {/* Duration & Bedtime Window */}
                <div style={{ flex: 1, minWidth: 170 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    เวลานอนหลับจริง (Total Sleep)
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '1.85rem',
                        fontWeight: 800,
                        fontFamily: "'Baloo 2', sans-serif",
                        color: 'var(--color-foreground)',
                        lineHeight: 1.05,
                        letterSpacing: '-0.5px',
                      }}
                    >
                      {formatHoursAndMinutes(activeTotalH)}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: activeTotalH >= 7 ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255, 143, 163, 0.16)',
                        color: activeTotalH >= 7 ? '#059669' : 'var(--color-primary)',
                        fontFamily: "'Baloo 2', sans-serif",
                      }}
                    >
                      {activeTotalH >= 7
                        ? '✓ เป้าหมาย 7–8 ชม.'
                        : `ขาดอีก ${formatHoursAndMinutes(Math.max(0, 7 - activeTotalH))}`}
                    </span>
                  </div>

                  {/* Bedtime -> Wakeup Pill & Efficiency */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 8,
                    }}
                  >
                    {bedtimeParts && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 10,
                          background: 'var(--color-bg-card)',
                          border: '1px solid var(--color-border)',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: 'var(--color-foreground)',
                        }}
                      >
                        <Moon size={12} weight="fill" color="#A855F7" />
                        <span>{bedtimeParts.startStr}</span>
                        <span style={{ color: 'var(--color-text-subtle)' }}>→</span>
                        <Sun size={13} weight="fill" color="#F59E0B" />
                        <span>{bedtimeParts.endStr} น.</span>
                      </div>
                    )}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: 10,
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        fontSize: '0.68rem',
                        color: 'var(--color-text-muted)',
                        fontWeight: 600,
                      }}
                      title="สัดส่วนเวลาหลับจริงเทียบกับเวลาบนเตียงทั้งหมด"
                    >
                      <Clock size={12} color="#10B981" />
                      <span>หลับจริง {sleepEfficiency}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================
                  SLEEP ARCHITECTURE BAR & 4 BENTO STAGE CARDS
                 ======================================================== */}
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                    fontSize: '0.72rem',
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--color-foreground)', fontFamily: "'Baloo 2', sans-serif" }}>
                    โครงสร้างการนอน (Sleep Stages)
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.65rem' }}>
                    เป้าหมาย {goalPct}% ของ 7.5 ชม.
                  </span>
                </div>

                {/* Multi-Segment Proportion Bar */}
                <div
                  style={{
                    height: 14,
                    borderRadius: 999,
                    background: 'var(--color-border-muted)',
                    display: 'flex',
                    overflow: 'hidden',
                    gap: 3,
                    padding: 2,
                    marginBottom: 12,
                  }}
                >
                  {barDeepW > 0 && (
                    <div
                      style={{
                        width: `${barDeepW}%`,
                        background: 'linear-gradient(90deg, #059669, #10B981)',
                        borderRadius: 999,
                        transition: 'width 0.35s ease',
                      }}
                      title={`หลับลึก (Deep): ${formatHoursAndMinutes(activeRecord.deep_hours)} (${activeDeepPct}%)`}
                    />
                  )}
                  {barRemW > 0 && (
                    <div
                      style={{
                        width: `${barRemW}%`,
                        background: 'linear-gradient(90deg, #9333EA, #A855F7)',
                        borderRadius: 999,
                        transition: 'width 0.35s ease',
                      }}
                      title={`ช่วงฝัน (REM): ${formatHoursAndMinutes(activeRecord.rem_hours)} (${activeRemPct}%)`}
                    />
                  )}
                  {barLightW > 0 && (
                    <div
                      style={{
                        width: `${barLightW}%`,
                        background: 'linear-gradient(90deg, #0284C7, #38BDF8)',
                        borderRadius: 999,
                        transition: 'width 0.35s ease',
                      }}
                      title={`หลับตื้น (Light): ${formatHoursAndMinutes(activeRecord.light_hours)} (${activeLightPct}%)`}
                    />
                  )}
                  {barAwakeW > 0 && (
                    <div
                      style={{
                        width: `${barAwakeW}%`,
                        background: 'linear-gradient(90deg, #E11D48, #FB7185)',
                        borderRadius: 999,
                        transition: 'width 0.35s ease',
                      }}
                      title={`ตื่นระหว่างคืน (Awake): ${formatHoursAndMinutes(activeRecord.awake_hours)}`}
                    />
                  )}
                </div>

                {/* 4 Stage Bento Cards (2x2 Grid) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 8,
                  }}
                >
                  {[
                    {
                      key: 'deep',
                      label: 'หลับลึก (Deep)',
                      sub: 'ซ่อมแซมกล้ามเนื้อ',
                      hours: activeRecord.deep_hours,
                      pct: activeDeepPct,
                      color: STAGE_COLORS.deep,
                      textColor: '#059669',
                      ideal: 'เกณฑ์ 15–25%',
                    },
                    {
                      key: 'rem',
                      label: 'ช่วงฝัน (REM)',
                      sub: 'ฟื้นฟูสมอง & ความจำ',
                      hours: activeRecord.rem_hours,
                      pct: activeRemPct,
                      color: STAGE_COLORS.rem,
                      textColor: '#9333EA',
                      ideal: 'เกณฑ์ 20–25%',
                    },
                    {
                      key: 'light',
                      label: 'หลับตื้น (Light)',
                      sub: 'ผ่อนคลายระบบประสาท',
                      hours: activeRecord.light_hours,
                      pct: activeLightPct,
                      color: STAGE_COLORS.light,
                      textColor: '#0284C7',
                      ideal: 'เกณฑ์ 45–55%',
                    },
                    {
                      key: 'awake',
                      label: 'ตื่น (Awake)',
                      sub: 'รู้สึกตัวระหว่างคืน',
                      hours: activeRecord.awake_hours,
                      pct: activeAwakePct,
                      color: STAGE_COLORS.awake,
                      textColor: '#E11D48',
                      ideal: 'ยิ่งน้อยยิ่งดี',
                    },
                  ].map((st) => (
                    <div
                      key={st.key}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 14,
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: '50%',
                              background: st.color,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-foreground)' }}>
                            {st.label}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: st.textColor,
                            background: `${st.color}18`,
                            padding: '1px 6px',
                            borderRadius: 999,
                            fontFamily: "'Baloo 2', sans-serif",
                          }}
                        >
                          {st.pct}%
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.92rem',
                            fontWeight: 800,
                            fontFamily: "'Baloo 2', sans-serif",
                            color: 'var(--color-foreground)',
                          }}
                        >
                          {formatHoursAndMinutes(st.hours)}
                        </span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>{st.ideal}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ========================================================
                  OVERNIGHT BIOMETRICS & RECOVERY VITALS GRID
                 ======================================================== */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
                  gap: 8,
                  marginBottom: coachInsight ? 12 : 0,
                }}
              >
                {activeRecord.avg_hrv != null && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: 'rgba(168, 85, 247, 0.08)',
                      border: '1px solid rgba(168, 85, 247, 0.22)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(168, 85, 247, 0.18)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Pulse size={15} weight="bold" color="#A855F7" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        Overnight HRV
                      </div>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          fontFamily: "'Baloo 2', sans-serif",
                          color: 'var(--color-foreground)',
                        }}
                      >
                        {activeRecord.avg_hrv} ms
                      </div>
                    </div>
                  </div>
                )}

                {activeRecord.avg_hr != null && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: 'rgba(251, 113, 133, 0.08)',
                      border: '1px solid rgba(251, 113, 133, 0.22)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(251, 113, 133, 0.18)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Heart size={15} weight="fill" color="#E11D48" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        ชีพจรขณะหลับ
                      </div>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          fontFamily: "'Baloo 2', sans-serif",
                          color: 'var(--color-foreground)',
                        }}
                      >
                        {Math.round(activeRecord.avg_hr)} bpm
                      </div>
                    </div>
                  </div>
                )}

                {activeRecord.body_battery_change != null && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.22)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(16, 185, 129, 0.18)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <BatteryCharging size={16} weight="fill" color="#059669" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        Body Battery
                      </div>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          fontFamily: "'Baloo 2', sans-serif",
                          color: '#059669',
                        }}
                      >
                        +{activeRecord.body_battery_change}%
                      </div>
                    </div>
                  </div>
                )}

                {activeRecord.avg_stress != null && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.22)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(56, 189, 248, 0.18)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Lightning size={15} weight="fill" color="#0284C7" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        ความเครียดขณะหลับ
                      </div>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          fontFamily: "'Baloo 2', sans-serif",
                          color: 'var(--color-foreground)',
                        }}
                      >
                        {Math.round(activeRecord.avg_stress)}{' '}
                        <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                          {activeRecord.avg_stress <= 25 ? '(ต่ำ)' : activeRecord.avg_stress <= 50 ? '(ปกติ)' : '(สูง)'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activeRecord.avg_spo2 != null && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: 'rgba(14, 165, 233, 0.08)',
                      border: '1px solid rgba(14, 165, 233, 0.22)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(14, 165, 233, 0.18)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Drop size={15} weight="fill" color="#0284C7" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        ออกซิเจน (SpO₂)
                      </div>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          fontFamily: "'Baloo 2', sans-serif",
                          color: 'var(--color-foreground)',
                        }}
                      >
                        {Math.round(activeRecord.avg_spo2)}%
                      </div>
                    </div>
                  </div>
                )}

                {activeRecord.avg_respiration != null && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: 'rgba(20, 184, 166, 0.08)',
                      border: '1px solid rgba(20, 184, 166, 0.22)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(20, 184, 166, 0.18)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Wind size={15} weight="bold" color="#0D9488" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        การหายใจ
                      </div>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          fontFamily: "'Baloo 2', sans-serif",
                          color: 'var(--color-foreground)',
                        }}
                      >
                        {activeRecord.avg_respiration.toFixed(1)} brpm
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Smart Sleep Coach Insight Banner */}
              {coachInsight && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 14,
                    background:
                      coachInsight.tone === 'good'
                        ? 'rgba(16, 185, 129, 0.1)'
                        : coachInsight.tone === 'warn'
                        ? 'rgba(244, 63, 94, 0.1)'
                        : 'rgba(168, 85, 247, 0.1)',
                    border: `1px solid ${
                      coachInsight.tone === 'good'
                        ? 'rgba(16, 185, 129, 0.25)'
                        : coachInsight.tone === 'warn'
                        ? 'rgba(244, 63, 94, 0.25)'
                        : 'rgba(168, 85, 247, 0.25)'
                    }`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <Sparkle
                    size={16}
                    weight="fill"
                    color={
                      coachInsight.tone === 'good'
                        ? '#059669'
                        : coachInsight.tone === 'warn'
                        ? '#E11D48'
                        : '#A855F7'
                    }
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <div style={{ fontSize: '0.72rem', lineHeight: 1.4 }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-foreground)' }}>{coachInsight.title}</div>
                    <div style={{ color: 'var(--color-text-muted)', marginTop: 1 }}>{coachInsight.desc}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              4. TRENDS & TIMEFRAME AVERAGES SECTION
             ======================================================== */}
          <div
            style={{
              background: 'var(--color-bg-elevated)',
              borderRadius: 20,
              padding: '14px 12px',
              border: '1px solid var(--color-border)',
              marginBottom: 16,
            }}
          >
            {/* Section Title + Timeframe Pills */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    fontFamily: "'Baloo 2', sans-serif",
                    color: 'var(--color-foreground)',
                  }}
                >
                  แนวโน้มการนอน ({timeframe} วันล่าสุด)
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)' }}>
                  แตะที่แท่งกราฟเพื่อดูข้อมูลรายคืน
                </div>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  background: 'var(--color-bg-card)',
                  padding: 3,
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  gap: 2,
                }}
              >
                {[
                  { key: '7', label: '7 วัน' },
                  { key: '14', label: '14 วัน' },
                  { key: '30', label: '30 วัน' },
                ].map((tf) => {
                  const active = timeframe === tf.key;
                  return (
                    <button
                      key={tf.key}
                      type="button"
                      onClick={() => setTimeframe(tf.key as any)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 7,
                        border: 'none',
                        background: active ? '#A855F7' : 'transparent',
                        color: active ? '#FFFFFF' : 'var(--color-text-muted)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        fontFamily: "'Baloo 2', sans-serif",
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {tf.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3 Summary KPI Cards for Selected Timeframe */}
            {avgMetrics && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    background: 'var(--color-bg-card)',
                    borderRadius: 12,
                    padding: '8px 10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    เฉลี่ย {avgMetrics.totalNights} คืน
                  </div>
                  <div
                    style={{
                      fontSize: '0.95rem',
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
                    background: 'var(--color-bg-card)',
                    borderRadius: 12,
                    padding: '8px 10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    คะแนนเฉลี่ย
                  </div>
                  <div
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      fontFamily: "'Baloo 2', sans-serif",
                      color: avgMetrics.avgScore && avgMetrics.avgScore >= 75 ? '#059669' : '#0284C7',
                    }}
                  >
                    {avgMetrics.avgScore ?? '—'} <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>/100</span>
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--color-bg-card)',
                    borderRadius: 12,
                    padding: '8px 10px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {avgMetrics.avgHrv ? 'HRV เฉลี่ย' : 'หลับลึกเฉลี่ย'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      fontFamily: "'Baloo 2', sans-serif",
                      color: '#A855F7',
                    }}
                  >
                    {avgMetrics.avgHrv ? `${avgMetrics.avgHrv} ms` : `${avgMetrics.deepPct}%`}
                  </div>
                </div>
              </div>
            )}

            {/* Chart Mode Switcher */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                background: 'var(--color-bg-card)',
                borderRadius: 12,
                padding: 3,
                border: '1px solid var(--color-border)',
                gap: 3,
                marginBottom: 12,
              }}
            >
              {[
                { key: 'stages', label: 'สเตจการนอน', icon: <ChartBar size={13} weight="fill" /> },
                { key: 'score', label: 'คะแนนการนอน', icon: <Trophy size={13} weight="fill" /> },
                { key: 'hrv', label: 'HRV & ชีพจร', icon: <Pulse size={13} weight="bold" /> },
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      padding: '7px 4px',
                      borderRadius: 9,
                      border: 'none',
                      fontSize: '0.7rem',
                      fontWeight: isActive ? 700 : 600,
                      fontFamily: "'Baloo 2', sans-serif",
                      cursor: 'pointer',
                      background: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                      color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Chart Canvas */}
            <div
              style={{
                width: '100%',
                height: 215,
                background: 'var(--color-bg-card)',
                borderRadius: 14,
                padding: '12px 8px 4px 0',
                border: '1px solid var(--color-border)',
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                {activeTab === 'stages' ? (
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
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
                    <Tooltip content={<ModernSleepTooltip />} cursor={{ fill: 'rgba(168, 85, 247, 0.08)' }} />
                    <ReferenceLine
                      y={7}
                      stroke="var(--color-primary)"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                    <Bar dataKey="deep" stackId="s" fill={STAGE_COLORS.deep} maxBarSize={26}>
                      {chartData.map((entry, idx) => (
                        <Cell
                          key={`deep-${idx}`}
                          opacity={entry.isSelected ? 1 : 0.78}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="rem" stackId="s" fill={STAGE_COLORS.rem} maxBarSize={26}>
                      {chartData.map((entry, idx) => (
                        <Cell
                          key={`rem-${idx}`}
                          opacity={entry.isSelected ? 1 : 0.78}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="light" stackId="s" fill={STAGE_COLORS.light} maxBarSize={26}>
                      {chartData.map((entry, idx) => (
                        <Cell
                          key={`light-${idx}`}
                          opacity={entry.isSelected ? 1 : 0.78}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="awake" stackId="s" fill={STAGE_COLORS.awake} radius={[5, 5, 0, 0]} maxBarSize={26}>
                      {chartData.map((entry, idx) => (
                        <Cell
                          key={`awake-${idx}`}
                          opacity={entry.isSelected ? 1 : 0.78}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                ) : activeTab === 'score' ? (
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
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
                    <Tooltip content={<ModernSleepTooltip />} cursor={{ fill: 'rgba(168, 85, 247, 0.08)' }} />
                    <ReferenceLine y={80} stroke="#10B981" strokeDasharray="3 3" />
                    <ReferenceLine y={60} stroke="#38BDF8" strokeDasharray="3 3" />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={26}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`score-${index}`}
                          fill={
                            entry.score != null && entry.score >= 80
                              ? STAGE_COLORS.deep
                              : entry.score != null && entry.score >= 60
                              ? STAGE_COLORS.light
                              : STAGE_COLORS.awake
                          }
                          opacity={entry.isSelected ? 1 : 0.72}
                          stroke={entry.isSelected ? 'var(--color-foreground)' : 'transparent'}
                          strokeWidth={entry.isSelected ? 2 : 0}
                        />
                      ))}
                    </Bar>
                  </ComposedChart>
                ) : (
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                    onClick={(state: any) => {
                      if (state?.activePayload && state.activePayload.length > 0) {
                        const clicked = state.activePayload[0].payload;
                        if (clicked?.date) setSelectedDate(clicked.date);
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="hrvFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#A855F7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
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
                    <Tooltip content={<ModernSleepTooltip />} />
                    <Area
                      type="monotone"
                      name="HRV (ms)"
                      dataKey="hrv"
                      stroke="#A855F7"
                      strokeWidth={2.5}
                      fill="url(#hrvFill)"
                      dot={{ r: 3, fill: '#A855F7' }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      name="Sleeping HR (bpm)"
                      dataKey="avgHr"
                      stroke="#FB7185"
                      strokeWidth={2.2}
                      dot={{ r: 3, fill: '#FB7185' }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* ========================================================
              5. COLLAPSIBLE RECENT NIGHTS TIMELINE
             ======================================================== */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  fontFamily: "'Baloo 2', sans-serif",
                  color: 'var(--color-foreground)',
                }}
              >
                บันทึกการนอนย้อนหลัง ({sortedRecords.length} คืน)
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                แตะเพื่อดูสรุปรายคืน
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleHistory.map((record) => {
                const isSelected = record.date === activeDate;
                const totalH = record.duration_hours || 0;
                const dPct = totalH > 0 ? Math.round(((record.deep_hours || 0) / totalH) * 100) : 0;
                const rPct = totalH > 0 ? Math.round(((record.rem_hours || 0) / totalH) * 100) : 0;
                const lPct = totalH > 0 ? Math.max(0, 100 - dPct - rPct) : 0;
                const st = getScoreTheme(record.score, record.qualifier);
                const bt = formatBedtimeParts(record.start_time, record.end_time);

                let formattedDay = record.date;
                try {
                  formattedDay = format(parseISO(record.date), 'EEE d MMM', { locale: th });
                } catch {}

                return (
                  <div
                    key={record.date}
                    onClick={() => setSelectedDate(record.date)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 16,
                      background: isSelected ? 'var(--color-bg-card)' : 'var(--color-bg-elevated)',
                      border: isSelected ? '2px solid #A855F7' : '1px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(168, 85, 247, 0.12)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    {/* Mini Score Circle */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: st.bg,
                        border: `1.5px solid ${st.border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 800,
                          fontFamily: "'Baloo 2', sans-serif",
                          color: st.color,
                          lineHeight: 1,
                        }}
                      >
                        {record.score ?? '-'}
                      </span>
                      <span style={{ fontSize: '0.5rem', fontWeight: 700, color: st.color }}>SCORE</span>
                    </div>

                    {/* Main Row Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: 'var(--color-foreground)',
                              fontFamily: "'Baloo 2', sans-serif",
                            }}
                          >
                            {formattedDay}
                          </span>
                          {bt && (
                            <span style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)' }}>
                              {bt.startStr}–{bt.endStr}
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: '0.88rem',
                            fontWeight: 800,
                            fontFamily: "'Baloo 2', sans-serif",
                            color: 'var(--color-foreground)',
                          }}
                        >
                          {formatShortDuration(totalH)}
                        </span>
                      </div>

                      {/* Mini Stage Bar */}
                      <div
                        style={{
                          height: 5,
                          borderRadius: 999,
                          background: 'var(--color-border-muted)',
                          display: 'flex',
                          overflow: 'hidden',
                          gap: 1.5,
                          marginBottom: 5,
                        }}
                      >
                        <div style={{ width: `${dPct}%`, background: STAGE_COLORS.deep }} />
                        <div style={{ width: `${rPct}%`, background: STAGE_COLORS.rem }} />
                        <div style={{ width: `${lPct}%`, background: STAGE_COLORS.light }} />
                      </div>

                      {/* Micro Vitals Row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.63rem',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span>หลับลึก {formatShortDuration(record.deep_hours)}</span>
                          <span>REM {formatShortDuration(record.rem_hours)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {record.avg_hrv != null && (
                            <span style={{ color: '#A855F7', fontWeight: 600 }}>HRV {record.avg_hrv}</span>
                          )}
                          {record.body_battery_change != null && (
                            <span style={{ color: '#059669', fontWeight: 700 }}>
                              ⚡ +{record.body_battery_change}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Show More / Collapse Button */}
            {reversedHistory.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllHistory((prev) => !prev)}
                style={{
                  width: '100%',
                  marginTop: 10,
                  padding: '9px 12px',
                  borderRadius: 12,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-foreground)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  fontFamily: "'Baloo 2', sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                {showAllHistory ? (
                  <>
                    <CaretUp size={14} weight="bold" />
                    <span>ย่อรายการประวัติ</span>
                  </>
                ) : (
                  <>
                    <CaretDown size={14} weight="bold" />
                    <span>ดูประวัติทั้งหมด ({reversedHistory.length} คืน)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Glassmorphic Custom Tooltip
function ModernSleepTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      style={{
        background: 'var(--color-bg-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 14,
        padding: '10px 12px',
        boxShadow: 'var(--shadow-md)',
        fontSize: '0.7rem',
        minWidth: 155,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontWeight: 800,
          fontSize: '0.78rem',
          marginBottom: 6,
          color: 'var(--color-foreground)',
          fontFamily: "'Baloo 2', sans-serif",
          borderBottom: '1px solid var(--color-border-muted)',
          paddingBottom: 4,
        }}
      >
        {data.label || data.date}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: 'var(--color-text-muted)' }}>เวลานอนรวม:</span>
        <strong style={{ color: 'var(--color-foreground)' }}>{formatShortDuration(data.total)}</strong>
      </div>
      {data.score != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Sleep Score:</span>
          <strong style={{ color: data.score >= 80 ? '#059669' : data.score >= 60 ? '#0284C7' : '#E11D48' }}>
            {data.score} / 100
          </strong>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: STAGE_COLORS.deep }}>● หลับลึก:</span>
        <strong>{formatShortDuration(data.deep)}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: STAGE_COLORS.rem }}>● REM:</span>
        <strong>{formatShortDuration(data.rem)}</strong>
      </div>
      {data.hrv != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, paddingTop: 3, borderTop: '1px dashed var(--color-border-muted)' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>HRV / HR:</span>
          <strong>
            {data.hrv} ms {data.avgHr ? `• ${data.avgHr} bpm` : ''}
          </strong>
        </div>
      )}
    </div>
  );
}
