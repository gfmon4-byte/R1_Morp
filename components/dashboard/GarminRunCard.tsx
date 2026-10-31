'use client';

import React, { useMemo } from 'react';
import {
  Timer,
  ArrowSquareOut,
  ArrowsClockwise,
  Copy,
  Check,
  DownloadSimple,
  Heart,
  Fire,
  Drop,
} from '@phosphor-icons/react';
import { IconShoe, IconRunner } from '@/components/Icons';
import styles from './GarminRunCard.module.css';

const EN_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function formatGarminEnDate(dateStr?: string, timeStr?: string) {
  if (!dateStr) return '--';
  const parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateFormatted = `${d} ${EN_MONTHS_SHORT[m] || ''} ${y}`;
    let timeFormatted = '';
    const rawTime = timeStr || '';
    if (rawTime.includes(':')) {
      const match = String(rawTime).match(/(\d{1,2}:\d{2})/);
      if (match) timeFormatted = ` · ${match[1]}`;
    }
    return `${dateFormatted}${timeFormatted}`;
  }
  return dateStr;
}

function formatDurationSec(seconds?: number | null) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Convert polyline lat/lon array into scaled SVG path
function generateSvgPath(points: Array<{ lat: number; lon: number }>, width = 140, height = 98, padding = 12) {
  if (!points || points.length < 2) return null;
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }

  const latRange = maxLat - minLat || 0.0001;
  const lonRange = maxLon - minLon || 0.0001;

  const w = width - padding * 2;
  const h = height - padding * 2;

  const coords = points.map((p) => {
    const x = padding + ((p.lon - minLon) / lonRange) * w;
    const y = height - padding - ((p.lat - minLat) / latRange) * h;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });

  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c[0]} ${c[1]}`).join(' ');
  return { d, start: coords[0], end: coords[coords.length - 1] };
}

// Default aesthetic loop route if no polyline points are stored yet
const DEFAULT_ROUTE_PATH = 'M 28 72 C 20 54, 22 36, 42 24 C 62 14, 88 16, 108 28 C 122 38, 126 56, 116 72 C 104 86, 82 86, 68 84 C 52 82, 38 84, 28 72 Z';

export interface ShoeInfo {
  hasShoe: boolean;
  title: string;
  subtitle: string;
  brandModel?: string | null;
  nickname?: string | null;
  totalDistanceKm?: number | null;
  wearPct?: number | null;
}

export interface GarminRunCardProps {
  activityName?: string;
  activityType?: string;
  sessionDate?: string;
  startTimeLocal?: string;
  summary?: any;
  sweatLoss?: number | null;
  hrZones?: any[];
  geoPolyline?: any;
  garminConnectUrl?: string | null;
  shoeInfo?: ShoeInfo;
  partType?: string;
  onResync?: () => void;
  refreshing?: boolean;
  onCopyCsv?: () => void;
  copiedCsv?: boolean;
  onDownloadCsv?: () => void;
}

export default function GarminRunCard({
  activityName,
  activityType = 'Running',
  sessionDate,
  startTimeLocal,
  summary = {},
  sweatLoss = null,
  hrZones = [],
  geoPolyline = null,
  garminConnectUrl,
  shoeInfo,
  partType,
  onResync,
  refreshing = false,
  onCopyCsv,
  copiedCsv = false,
  onDownloadCsv,
}: GarminRunCardProps) {
  // Format English date & time: e.g. "29 Oct 2026 · 18:01"
  const formattedDate = useMemo(() => {
    return formatGarminEnDate(sessionDate, startTimeLocal);
  }, [sessionDate, startTimeLocal]);

  // SVG route path
  const svgRoute = useMemo(() => {
    if (geoPolyline?.polyline && geoPolyline.polyline.length >= 2) {
      return generateSvgPath(geoPolyline.polyline);
    }
    return null;
  }, [geoPolyline]);

  // HR Zones mapped and sorted Z5 down to Z1 (Profile Zones: Garmin Venu 3)
  const zonesList = useMemo(() => {
    const config: Record<number, { label: string; color: string; defaultBpm: string }> = {
      5: { label: 'Z5', color: '#A855F7', defaultBpm: '174–199 bpm' },
      4: { label: 'Z4', color: '#EF4444', defaultBpm: '158–173 bpm' },
      3: { label: 'Z3', color: '#F59E0B', defaultBpm: '145–157 bpm' },
      2: { label: 'Z2', color: '#10B981', defaultBpm: '116–144 bpm' },
      1: { label: 'Z1', color: '#0284C7', defaultBpm: '97–115 bpm' },
    };

    const zoneMap: Record<number, any> = {};
    (hrZones || []).forEach((z: any) => {
      const num = Number(z.zone_number ?? z.zoneNumber);
      if (num >= 1 && num <= 5) {
        const minB = z.min_bpm ?? z.minBpm ?? z.zoneLowBoundary;
        const maxB = z.max_bpm ?? z.maxBpm ?? z.zoneHighBoundary;
        const bpmRange = (minB && maxB) ? `${minB}–${maxB} bpm` : (minB ? `≥ ${minB} bpm` : config[num]?.defaultBpm);
        zoneMap[num] = {
          number: num,
          label: `Z${num}`,
          color: config[num]?.color || '#64748B',
          percentage: Number(z.percentage) || 0,
          durationFormatted: z.duration_formatted || (z.seconds_in_zone ? formatDurationSec(z.seconds_in_zone) : '0:00'),
          bpmRange,
        };
      }
    });

    const list = [5, 4, 3, 2, 1].map((n) => {
      if (zoneMap[n]) return zoneMap[n];
      return {
        number: n,
        label: `Z${n}`,
        color: config[n]?.color || '#64748B',
        percentage: 0,
        durationFormatted: '0:00',
        bpmRange: config[n]?.defaultBpm || '',
      };
    });

    const maxPct = Math.max(...list.map((z) => z.percentage), 1);
    return list.map((z) => ({
      ...z,
      barWidthPct: z.percentage > 0 ? Math.max(6, Math.round((z.percentage / maxPct) * 100)) : 0,
    }));
  }, [hrZones]);

  // 1. Distance
  const distKm = summary.distance_km != null ? Number(summary.distance_km).toFixed(2) : '--';

  // 2. Duration & Elapsed
  const durationStr = summary.moving_duration_formatted || summary.duration_formatted || '--';
  const elapsedStr = summary.elapsed_duration_formatted || null;

  // 3. Avg Pace & Best Pace
  const paceStr = summary.avg_pace || '--';
  const bestPaceStr = summary.best_pace || null;

  // 4. Avg Heart Rate & Max HR
  const avgHr = summary.avg_hr != null ? Math.round(summary.avg_hr) : '--';
  const maxHr = summary.max_hr != null ? Math.round(summary.max_hr) : null;

  // 5. Calories & Steps
  const calories = summary.calories != null ? Math.round(summary.calories) : '--';
  const stepsStr = summary.steps ? `${Number(summary.steps).toLocaleString()} steps` : null;

  // 6. Est. Sweat Loss & Liters
  const sweatVal = sweatLoss != null
    ? Math.round(sweatLoss)
    : (summary.water_estimated_ml != null ? Math.round(summary.water_estimated_ml) : (summary.calories ? Math.round(summary.calories * 1.4) : null));
  const sweatLitersStr = sweatVal != null ? `${(sweatVal / 1000).toFixed(2)} L` : null;

  return (
    <div className={styles.cardContainer}>
      {/* ── 1. Top Header Row ─────────────────────────────────────────── */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <div className={styles.runnerIconWrap}>
            <IconRunner size={18} />
          </div>
        </div>

        <div className={styles.headerRight}>
          {onCopyCsv && (
            <button
              type="button"
              onClick={onCopyCsv}
              className={`${styles.headerActionBtn} ${styles.copyHighlightBtn} ${copiedCsv ? styles.copiedActive : ''}`}
              title="Copy CSV to clipboard"
            >
              {copiedCsv ? <Check size={12} weight="bold" /> : <Copy size={12} weight="bold" />}
              <span>{copiedCsv ? 'Copied' : 'CSV'}</span>
            </button>
          )}

          {onDownloadCsv && (
            <button
              type="button"
              onClick={onDownloadCsv}
              className={styles.headerActionBtn}
              title="Download CSV file"
            >
              <DownloadSimple size={12} />
              <span>.csv</span>
            </button>
          )}

          {onResync && (
            <button
              type="button"
              onClick={onResync}
              disabled={refreshing}
              className={styles.headerActionBtn}
              title="Re-sync activity from Garmin"
            >
              <ArrowsClockwise size={12} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Re-sync'}</span>
            </button>
          )}

          {garminConnectUrl ? (
            <a
              href={garminConnectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.headerActionBtn} ${styles.garminBtn}`}
              title="Open activity in Garmin Connect"
            >
              <span>GARMIN</span>
              <ArrowSquareOut size={11} />
            </a>
          ) : (
            <span className={`${styles.headerActionBtn} ${styles.garminBtn}`}>
              <span>GARMIN</span>
            </span>
          )}
        </div>
      </div>

      {/* ── 2. Hero Row: Left (Date & Title & Shoe) + Right (Map Preview) ─ */}
      <div className={styles.heroRow}>
        <div className={styles.heroLeft}>
          <div className={styles.dateRow}>{formattedDate}</div>
          <div className={styles.activityTitleWrap}>
            <span className={styles.activityTitle}>
              {activityName || 'Easy Run'}
            </span>
            {shoeInfo?.hasShoe && (
              <span className={styles.shoeBadge}>
                <IconShoe size={13} style={{ marginRight: 4, verticalAlign: -1 }} />
                {shoeInfo.brandModel}
              </span>
            )}
            {partType && partType !== 'Part 1' && (
              <span className={styles.partBadge}>
                {partType}
              </span>
            )}
          </div>
        </div>

        {/* Map Route Thumbnail Preview */}
        <div className={styles.mapBoxWrap} title="GPS Route Preview">
          <div className={styles.mapGridTexture} />
          <svg className={styles.mapSvg} viewBox="0 0 140 98" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="garminRouteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06B6D4" />
                <stop offset="30%" stopColor="#10B981" />
                <stop offset="65%" stopColor="#EAB308" />
                <stop offset="100%" stopColor="#EF4444" />
              </linearGradient>
              <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {svgRoute ? (
              <>
                <path
                  d={svgRoute.d}
                  fill="none"
                  stroke="url(#garminRouteGrad)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#routeGlow)"
                />
                <circle cx={svgRoute.start[0]} cy={svgRoute.start[1]} r="3.2" fill="#22C55E" stroke="#FFFFFF" strokeWidth="1.2" />
                <circle cx={svgRoute.end[0]} cy={svgRoute.end[1]} r="3.2" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.2" />
              </>
            ) : (
              <>
                <path
                  d={DEFAULT_ROUTE_PATH}
                  fill="none"
                  stroke="url(#garminRouteGrad)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#routeGlow)"
                />
                <circle cx="28" cy="72" r="3.2" fill="#22C55E" stroke="#FFFFFF" strokeWidth="1.2" />
                <circle cx="34" cy="70" r="3.2" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.2" />
              </>
            )}
          </svg>
        </div>
      </div>

      {/* ── 3. Primary Running Metrics Grid ───────────────────────────── */}
      <div className={styles.primaryGrid}>
        {/* 1. Distance */}
        <div className={styles.metricCell}>
          <span className={styles.metricLabel}>Distance</span>
          <div className={styles.metricValueWrap}>
            <span className={styles.metricNum}>{distKm}</span>
            <span className={styles.metricUnit}>km</span>
          </div>
          <span className={styles.metricSubHidden}>&nbsp;</span>
        </div>

        {/* 2. Duration & Elapsed */}
        <div className={styles.metricCell}>
          <span className={styles.metricLabel}>Duration</span>
          <div className={styles.metricValueWrap}>
            <Timer size={14} style={{ opacity: 0.75, marginRight: 2 }} />
            <span className={styles.metricNum}>{durationStr}</span>
          </div>
          <span className={styles.metricSub}>
            {elapsedStr ? `Elapsed: ${elapsedStr}` : '\u00A0'}
          </span>
        </div>

        {/* 3. Avg Pace & Best Pace */}
        <div className={styles.metricCell}>
          <span className={styles.metricLabel}>Avg Pace</span>
          <div className={styles.metricValueWrap}>
            <span className={styles.metricNum}>{paceStr}</span>
            <span className={styles.metricUnit}>/km</span>
          </div>
          <span className={styles.metricSub}>
            {bestPaceStr ? `Best: ${bestPaceStr}` : '\u00A0'}
          </span>
        </div>
      </div>

      {/* ── 4. Physiology Metrics Grid ───────────────────────────────── */}
      <div className={styles.physioGrid}>
        {/* 4. Avg Heart Rate */}
        <div className={styles.metricCell}>
          <span className={styles.metricLabel}>
            <Heart size={12} weight="fill" style={{ color: '#EF4444' }} />
            Avg HR
          </span>
          <div className={styles.metricValueWrap}>
            <span className={styles.metricNum}>{avgHr}</span>
            <span className={styles.metricUnit}>bpm</span>
          </div>
          <span className={styles.metricSub}>
            {maxHr ? `Max: ${maxHr} bpm` : '\u00A0'}
          </span>
        </div>

        {/* 5. Calories & Steps */}
        <div className={styles.metricCell}>
          <span className={styles.metricLabel}>
            <Fire size={12} weight="fill" style={{ color: '#F59E0B' }} />
            Calories
          </span>
          <div className={styles.metricValueWrap}>
            <span className={styles.metricNum}>{calories}</span>
            <span className={styles.metricUnit}>kcal</span>
          </div>
          <span className={styles.metricSub}>
            {stepsStr || '\u00A0'}
          </span>
        </div>

        {/* 6. Est. Sweat Loss */}
        <div className={styles.metricCell}>
          <span className={styles.metricLabel}>
            <Drop size={12} weight="fill" style={{ color: '#38BDF8' }} />
            Est. Sweat Loss
          </span>
          <div className={styles.metricValueWrap}>
            <span className={styles.metricNum}>{sweatVal != null ? sweatVal : '--'}</span>
            <span className={styles.metricUnit}>ml</span>
          </div>
          <span className={styles.metricSub}>
            {sweatLitersStr || '\u00A0'}
          </span>
        </div>
      </div>

      {/* ── 5. Heart Rate Zones (Z5 down to Z1) ───────────────────────── */}
      <div className={styles.hrZonesSection}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
          <span className={styles.hrZonesTitle} style={{ margin: 0 }}>HR Zones</span>
          <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Profile Zones (Garmin Venu 3)
          </span>
        </div>
        <div className={styles.hrZonesList}>
          {zonesList.map((z) => (
            <div key={z.number} className={styles.zoneRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span className={styles.zoneLabel}>{z.label}</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  {z.bpmRange}
                </span>
              </div>
              <div className={styles.zoneTrack}>
                <div
                  className={styles.zoneFill}
                  style={{
                    width: `${z.barWidthPct}%`,
                    backgroundColor: z.color,
                  }}
                />
              </div>
              <span className={styles.zonePct}>{Math.round(z.percentage)}%</span>
              <span className={styles.zoneTime}>{z.durationFormatted}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
