'use client';

import React, { useState } from 'react';
import styles from './LastRunViewer.module.css';

// SVG Icons
const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconDownload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

const IconExternalLink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </svg>
);

export default function LastRunViewer({ data, onClose }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'laps' | 'hr' | 'raw_json' | 'raw_csv'
  const [copiedKey, setCopiedKey] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!data) return null;

  const {
    activity_id,
    activity_name,
    activity_type,
    start_time_local,
    location_name,
    garmin_connect_url,
    summary = {},
    laps = [],
    hr_zones = [],
    weather = {},
    gear = [],
    csv_exports = {},
  } = data;

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 3000);
    });
  };

  const downloadFile = (filename, content, mimeType = 'text/plain') => {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fullJsonString = JSON.stringify(data, null, 2);
  const formattedDate = start_time_local
    ? new Date(start_time_local.replace('T', ' ').slice(0, 19)).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '--';

  const zoneColors = {
    1: '#94a3b8', // Zone 1 Gray
    2: '#38bdf8', // Zone 2 Blue
    3: '#10b981', // Zone 3 Green
    4: '#f59e0b', // Zone 4 Orange
    5: '#ef4444', // Zone 5 Red
  };

  return (
    <div className={styles.lastRunContainer}>
      {/* Header Row */}
      <div className={styles.headerRow} style={isCollapsed ? { borderBottom: 'none', marginBottom: 0, paddingBottom: 0 } : {}}>
        <div className={styles.titleArea}>
          <div className={styles.activityBadgeRow}>
            <span className={styles.badgeType}>🏃 {activity_type || 'Running'}</span>
            <span className={styles.badgeDate}>📅 {formattedDate}</span>
            <span className={styles.badgeDate} style={{ color: '#10b981', fontWeight: 600 }}>
              💾 Saved
            </span>
            {activity_id && (
              <span className={styles.badgeDate} style={{ opacity: 0.7 }}>
                ID: {activity_id}
              </span>
            )}
          </div>
          <h2 className={styles.activityTitle}>
            {activity_name || 'Latest Run'}
            {isCollapsed && summary.distance_km && (
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#38bdf8', marginLeft: '12px' }}>
                ({summary.distance_km} km · {summary.duration_formatted} · เพซ {summary.avg_pace})
              </span>
            )}
          </h2>
          {!isCollapsed && location_name && (
            <div className={styles.locationText}>
              📍 {location_name}
            </div>
          )}
        </div>

        <div className={styles.headerControls}>
          {garmin_connect_url && (
            <a
              href={garmin_connect_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
            >
              <IconExternalLink /> Garmin Connect
            </a>
          )}
          <button
            className={styles.closeBtn}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'ขยายดูรายละเอียดทั้งหมด (Expand)' : 'ย่อรายละเอียด (Collapse)'}
            aria-label={isCollapsed ? 'Expand run details' : 'Collapse run details'}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>

      {/* Action Bar with Quick Copy & Download */}
      <div className={styles.actionBar}>
        <div className={styles.actionBarLabel}>
          <span>⚡ ส่งออกข้อมูล (Quick Export):</span>
        </div>
        <div className={styles.buttonGroup}>
          <button
            className={`${styles.actionBtn} ${
              copiedKey === 'combined_csv' ? styles.actionBtnSuccess : styles.actionBtnPrimary
            }`}
            onClick={() => copyToClipboard(csv_exports.combined_csv, 'combined_csv')}
            title="Copy summary & splits CSV to clipboard"
          >
            {copiedKey === 'combined_csv' ? <IconCheck /> : <IconCopy />}
            {copiedKey === 'combined_csv' ? 'คัดลอก CSV แล้ว!' : 'Copy CSV'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 ภาพรวม & ตัวชี้วัด (Overview)
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'laps' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('laps')}
        >
          ⏱️ สปลิทรายกิโล ({laps.length} Laps)
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'hr' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('hr')}
        >
          ❤️ โซนหัวใจ (HR Zones)
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'raw_json' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('raw_json')}
        >
          💻 Raw JSON Code
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'raw_csv' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('raw_csv')}
        >
          📄 Raw CSV Preview
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <div className={styles.metricsGrid}>
            <div className={`${styles.metricCard} ${styles.metricCardHighlight}`}>
              <div className={styles.metricLabel}>🎯 ระยะทาง (Distance)</div>
              <div className={styles.metricValue}>
                {summary.distance_km ?? '--'}
                <span className={styles.metricUnit}>km</span>
              </div>
              <div className={styles.metricSubtext}>
                {summary.distance_meters ? `${summary.distance_meters.toLocaleString()} m` : ''}
              </div>
            </div>

            <div className={`${styles.metricCard} ${styles.metricCardHighlight}`}>
              <div className={styles.metricLabel}>⏱️ เวลา (Duration)</div>
              <div className={styles.metricValue}>{summary.duration_formatted ?? '--'}</div>
              <div className={styles.metricSubtext}>
                Moving: {summary.moving_duration_formatted ?? '--'}
              </div>
            </div>

            <div className={`${styles.metricCard} ${styles.metricCardHighlight}`}>
              <div className={styles.metricLabel}>⚡ เพซเฉลี่ย (Avg Pace)</div>
              <div className={styles.metricValue}>
                {summary.avg_pace ?? '--'}
                <span className={styles.metricUnit}>/km</span>
              </div>
              <div className={styles.metricSubtext}>
                Best: {summary.best_pace ?? '--'} ({summary.avg_speed_kph ?? '--'} km/h)
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>❤️ อัตราการเต้นหัวใจ (HR)</div>
              <div className={styles.metricValue}>
                {summary.avg_hr ?? '--'}
                <span className={styles.metricUnit}>bpm</span>
              </div>
              <div className={styles.metricSubtext}>
                Max HR: {summary.max_hr ?? '--'} bpm
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>👟 รอบขา (Cadence)</div>
              <div className={styles.metricValue}>
                {summary.avg_cadence ?? '--'}
                <span className={styles.metricUnit}>spm</span>
              </div>
              <div className={styles.metricSubtext}>
                Max: {summary.max_cadence ?? '--'} spm
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>📏 ความยาวก้าว (Stride)</div>
              <div className={styles.metricValue}>
                {summary.avg_stride_length_m ?? '--'}
                <span className={styles.metricUnit}>m</span>
              </div>
              <div className={styles.metricSubtext}>Stride Length</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>🦶 สัมผัสพื้น (GCT)</div>
              <div className={styles.metricValue}>
                {summary.avg_ground_contact_time_ms ?? '--'}
                <span className={styles.metricUnit}>ms</span>
              </div>
              <div className={styles.metricSubtext}>Ground Contact Time</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>📐 การเด้งตัว (Vert Osc)</div>
              <div className={styles.metricValue}>
                {summary.avg_vertical_oscillation_cm ?? '--'}
                <span className={styles.metricUnit}>cm</span>
              </div>
              <div className={styles.metricSubtext}>
                Ratio: {summary.avg_vertical_ratio_percent ?? '--'}%
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>⛰️ ความชัน (Elevation)</div>
              <div className={styles.metricValue}>
                +{summary.elevation_gain_m ?? 0}
                <span className={styles.metricUnit}>m</span>
              </div>
              <div className={styles.metricSubtext}>
                Loss: -{summary.elevation_loss_m ?? 0} m (Range: {summary.min_elevation_m} - {summary.max_elevation_m}m)
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>🔥 พลังงาน (Calories)</div>
              <div className={styles.metricValue}>
                {summary.calories?.toLocaleString() ?? '--'}
                <span className={styles.metricUnit}>kcal</span>
              </div>
              <div className={styles.metricSubtext}>
                Drain BB: {summary.body_battery_drain ? `-${summary.body_battery_drain}` : '--'}
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>🔋 ผลการฝึกซ้อม (TE)</div>
              <div className={styles.metricValue}>
                {summary.aerobic_training_effect ?? '--'}
                <span className={styles.metricUnit}>Aerobic</span>
              </div>
              <div className={styles.metricSubtext}>
                Anaerobic: {summary.anaerobic_training_effect ?? '0.0'} ({summary.training_effect_label || 'Fitness'})
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>👣 จำนวนก้าว (Steps)</div>
              <div className={styles.metricValue}>
                {summary.steps?.toLocaleString() ?? '--'}
                <span className={styles.metricUnit}>steps</span>
              </div>
              <div className={styles.metricSubtext}>
                Recovery HR: {summary.recovery_hr ? `${summary.recovery_hr} bpm` : '--'}
              </div>
            </div>
          </div>

          {/* Weather & Gear Card */}
          {(weather || (gear && gear.length > 0)) && (
            <div className={styles.weatherCard}>
              {weather?.temperature_c !== undefined && (
                <div className={styles.weatherItem}>
                  <span className={styles.weatherLabel}>🌡️ อุณหภูมิ (Temp)</span>
                  <span className={styles.weatherValue}>
                    {weather.temperature_c} °C
                    {weather.apparent_temperature_c && (
                      <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '6px' }}>
                        (รู้สึก {weather.apparent_temperature_c} °C)
                      </span>
                    )}
                  </span>
                </div>
              )}

              {weather?.relative_humidity_percent !== undefined && (
                <div className={styles.weatherItem}>
                  <span className={styles.weatherLabel}>💧 ความชื้น (Humidity)</span>
                  <span className={styles.weatherValue}>{weather.relative_humidity_percent}%</span>
                </div>
              )}

              {weather?.wind_speed_kph !== undefined && (
                <div className={styles.weatherItem}>
                  <span className={styles.weatherLabel}>💨 กระแสลม (Wind)</span>
                  <span className={styles.weatherValue}>
                    {weather.wind_speed_kph} km/h {weather.wind_direction_compass}
                  </span>
                </div>
              )}

              {weather?.condition && (
                <div className={styles.weatherItem}>
                  <span className={styles.weatherLabel}>⛅ สภาพอากาศ</span>
                  <span className={styles.weatherValue}>{weather.condition}</span>
                </div>
              )}

              {gear && gear.length > 0 && (
                <div className={styles.weatherItem} style={{ gridColumn: 'span 2' }}>
                  <span className={styles.weatherLabel}>👟 รองเท้า / อุปกรณ์ (Gear)</span>
                  <span className={styles.weatherValue}>
                    {gear.map((g) => `${g.gear_name} (${g.total_distance_km} km)`).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LAPS / SPLITS */}
      {activeTab === 'laps' && (
        <div>
          <div className={styles.tableContainer}>
            <table className={styles.splitsTable}>
              <thead>
                <tr>
                  <th>Lap</th>
                  <th>ระยะทาง (km)</th>
                  <th>เวลา</th>
                  <th>เพซ (Pace)</th>
                  <th>ความเร็ว (km/h)</th>
                  <th>Avg HR</th>
                  <th>Max HR</th>
                  <th>Cadence</th>
                  <th>Stride (m)</th>
                  <th>GCT (ms)</th>
                  <th>Vert Osc (cm)</th>
                  <th>Vert Ratio</th>
                  <th>Elev (+/-)</th>
                  <th>แคลอรี</th>
                </tr>
              </thead>
              <tbody>
                {laps.map((lap, idx) => (
                  <tr key={idx}>
                    <td>{lap.lap_index}</td>
                    <td>{lap.distance_km}</td>
                    <td>{lap.duration_formatted}</td>
                    <td style={{ fontWeight: '700', color: '#38bdf8' }}>{lap.avg_pace}</td>
                    <td>{lap.avg_speed_kph ?? '--'}</td>
                    <td>{lap.avg_hr ?? '--'}</td>
                    <td>{lap.max_hr ?? '--'}</td>
                    <td>{lap.avg_cadence ?? '--'}</td>
                    <td>{lap.avg_stride_length_m ?? '--'}</td>
                    <td>{lap.avg_ground_contact_time_ms ?? '--'}</td>
                    <td>{lap.avg_vertical_oscillation_cm ?? '--'}</td>
                    <td>{lap.avg_vertical_ratio_percent ? `${lap.avg_vertical_ratio_percent}%` : '--'}</td>
                    <td>
                      +{lap.elevation_gain_m ?? 0} / -{lap.elevation_loss_m ?? 0}m
                    </td>
                    <td>{lap.calories ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: HR ZONES */}
      {activeTab === 'hr' && (
        <div className={styles.hrZonesList}>
          {hr_zones.map((zone) => (
            <div key={zone.zone_number} className={styles.hrZoneItem}>
              <div className={styles.hrZoneHeader}>
                <span className={styles.hrZoneName}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: zoneColors[zone.zone_number] || '#38bdf8',
                      display: 'inline-block',
                    }}
                  />
                  {zone.zone_name} (≥ {zone.min_bpm} bpm)
                </span>
                <span className={styles.hrZoneMeta}>
                  {zone.duration_formatted} ({zone.percentage}%)
                </span>
              </div>
              <div className={styles.hrZoneProgressBg}>
                <div
                  className={styles.hrZoneProgressBar}
                  style={{
                    width: `${zone.percentage}%`,
                    background: zoneColors[zone.zone_number] || '#38bdf8',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: RAW JSON CODE */}
      {activeTab === 'raw_json' && (
        <div className={styles.codeContainer}>
          <div className={styles.codeHeader}>
            <span className={styles.codeTitle}>garmin_activity_{activity_id}.json</span>
            <button
              className={`${styles.actionBtn} ${
                copiedKey === 'code_json' ? styles.actionBtnSuccess : styles.actionBtnSecondary
              }`}
              onClick={() => copyToClipboard(fullJsonString, 'code_json')}
            >
              {copiedKey === 'code_json' ? <IconCheck /> : <IconCopy />}
              {copiedKey === 'code_json' ? 'คัดลอกแล้ว!' : 'Copy JSON'}
            </button>
          </div>
          <pre className={styles.codeBox}>{fullJsonString}</pre>
        </div>
      )}

      {/* TAB 5: RAW CSV PREVIEW */}
      {activeTab === 'raw_csv' && (
        <div className={styles.codeContainer}>
          <div className={styles.codeHeader}>
            <span className={styles.codeTitle}>garmin_activity_{activity_id}.csv</span>
            <button
              className={`${styles.actionBtn} ${
                copiedKey === 'code_csv' ? styles.actionBtnSuccess : styles.actionBtnSecondary
              }`}
              onClick={() => copyToClipboard(csv_exports.combined_csv, 'code_csv')}
            >
              {copiedKey === 'code_csv' ? <IconCheck /> : <IconCopy />}
              {copiedKey === 'code_csv' ? 'คัดลอกแล้ว!' : 'Copy CSV'}
            </button>
          </div>
          <pre className={styles.codeBox}>{csv_exports.combined_csv}</pre>
        </div>
      )}
        </>
      )}
    </div>
  );
}
