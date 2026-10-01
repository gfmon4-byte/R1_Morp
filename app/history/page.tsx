'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Activity, Profile } from '@/lib/supabase';
import { formatPace, formatDuration, thaiDate, getSessionColor, SESSION_TYPES } from '@/lib/utils';
import { computeHRZones, getHRZoneForBpm } from '@/lib/hrZones';
import { AddRunForm } from '@/components/runs/AddRunForm';
import { Plus, Funnel, Trash, PencilSimple, Heart, MapPin, ArrowsDownUp, ArrowsClockwise } from '@phosphor-icons/react';

export default function HistoryPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('All');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncDays, setSyncDays] = useState<'7' | '30' | 'all'>('7');
  const [syncing, setSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchData = useCallback(async () => {
    const [profileRes, activitiesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', 1).single(),
      supabase.from('activities').select('*').order('date', { ascending: false }),
    ]);
    setProfile(profileRes.data);
    setActivities(activitiesRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hrZones = computeHRZones(profile?.hr_max ?? 185, profile?.hr_rest ?? 42);

  const filtered = activities.filter((a) => {
    if (filterType !== 'All' && a.session_type !== filterType) return false;
    if (filterFrom && a.date < filterFrom) return false;
    if (filterTo && a.date > filterTo) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this activity?')) return;
    setDeleting(id);
    await supabase.from('activities').delete().eq('id', id);
    setActivities((prev) => prev.filter((a) => a.id !== id));
    setDeleting(null);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditActivity(null);
    fetchData();
  };

  const handleSyncGarmin = async (range: '7' | '30' | 'all' = syncDays) => {
    try {
      setSyncing(true);
      setSyncToast(null);

      const payload = range === 'all'
        ? { all: true, days: 'all' }
        : { days: parseInt(range, 10) };

      const res = await fetch('/api/garmin-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        const rangeLabel = range === 'all' ? 'All-time' : `${range} วันล่าสุด`;
        if (data.inserted > 0) {
          setSyncToast({
            ok: true,
            message: `Synced ${data.inserted} new run${data.inserted > 1 ? 's' : ''} from Garmin (${rangeLabel}) into database!`,
          });
        } else if (data.total > 0) {
          setSyncToast({
            ok: true,
            message: `All runs up to date (${data.skipped} runs already in database, ${rangeLabel})`,
          });
        } else {
          setSyncToast({
            ok: true,
            message: `No running activities found in Garmin (${rangeLabel})`,
          });
        }
        await fetchData();
      } else {
        setSyncToast({
          ok: false,
          message: data.error || 'Garmin sync failed',
        });
      }
    } catch (err: any) {
      setSyncToast({
        ok: false,
        message: err.message || 'Network error while syncing with Garmin',
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncToast(null), 5000);
    }
  };

  return (
    <div>
      {/* Header */}
      <header className="page-header">
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Run History</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Sync Days Selector & Sync Button */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--color-bg-card, #FFFFFF)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: '2px 4px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <select
                value={syncDays}
                onChange={(e) => setSyncDays(e.target.value as '7' | '30' | 'all')}
                disabled={syncing}
                aria-label="Garmin sync range"
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="7">7 วัน</option>
                <option value="30">30 วัน</option>
                <option value="all">ทั้งหมด (All)</option>
              </select>
              <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 2px' }} />
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleSyncGarmin(syncDays)}
                disabled={syncing}
                title={`Sync runs from Garmin Connect (${syncDays === 'all' ? 'All-time' : syncDays + ' days'})`}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '5px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.8125rem',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  boxShadow: 'none',
                }}
              >
                <ArrowsClockwise size={15} weight="bold" className={syncing ? 'spin' : ''} />
                <span>{syncing ? 'Syncing…' : 'Sync Garmin'}</span>
              </button>
            </div>

            {/* Add Run Button */}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setEditActivity(null); setShowForm(true); }}
              aria-label="Add new run"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} weight="bold" />
              Add Run
            </button>
          </div>
        </div>
      </header>

      <div className="page-content" style={{ paddingTop: 16 }}>
        {/* Sync Toast Notification */}
        {syncToast && (
          <div
            className="animate-fade-in"
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              marginBottom: 14,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              background: syncToast.ok ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${syncToast.ok ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: syncToast.ok ? '#a7f3d0' : '#fca5a5',
            }}
          >
            <span>{syncToast.ok ? '✓ ' : '⚠️ '}{syncToast.message}</span>
            <button
              onClick={() => setSyncToast(null)}
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }}
            >
              ✕
            </button>
          </div>
        )}
        {/* Filters */}
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Funnel size={14} color="var(--color-text-muted)" />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filters</span>
          </div>
          <select
            className="form-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter by session type"
          >
            <option value="All">All Session Types</option>
            {SESSION_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label className="form-label">From</label>
              <input type="date" className="form-input" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} aria-label="From date" />
            </div>
            <div>
              <label className="form-label">To</label>
              <input type="date" className="form-input" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} aria-label="To date" />
            </div>
          </div>
          {(filterType !== 'All' || filterFrom || filterTo) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setFilterType('All'); setFilterFrom(''); setFilterTo(''); }}>
              Clear filters
            </button>
          )}
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {filtered.length} {filtered.length === 1 ? 'activity' : 'activities'}
          </span>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
            {filtered.reduce((sum, a) => sum + (a.distance_km || 0), 0).toFixed(1)} km total
          </span>
        </div>

        {/* Activity list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 96, borderRadius: 16 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
            <ArrowsDownUp size={32} style={{ margin: '0 auto 12px' }} />
            <p>No activities found</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>
              Log your first run
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                hrZones={hrZones}
                onEdit={() => { setEditActivity(activity); setShowForm(true); }}
                onDelete={() => handleDelete(activity.id)}
                deleting={deleting === activity.id}
              />
            ))}
          </div>
        )}
        <div style={{ height: 16 }} />
      </div>

      {/* Add/Edit Form Sheet */}
      {showForm && (
        <AddRunForm
          activity={editActivity}
          onClose={() => { setShowForm(false); setEditActivity(null); }}
          onSaved={handleSaved}
          hrZones={hrZones}
        />
      )}
    </div>
  );
}

function ActivityCard({
  activity, hrZones, onEdit, onDelete, deleting,
}: {
  activity: Activity;
  hrZones: ReturnType<typeof computeHRZones>;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const color = getSessionColor(activity.session_type);
  const hrZone = activity.avg_hr ? getHRZoneForBpm(activity.avg_hr, 185, 42) : null;
  const zoneInfo = hrZone ? hrZones[hrZone - 1] : null;

  return (
    <div className="card animate-fade-in" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Type indicator */}
        <div
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: `${color}20`, border: `1px solid ${color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: 2,
          }}
        >
          <span style={{ fontSize: '0.625rem', fontWeight: 700, color, fontFamily: 'Barlow Condensed', letterSpacing: '0.03em' }}>
            {activity.session_type.split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase()}
          </span>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activity.title && activity.title !== activity.session_type ? activity.title : activity.session_type}
              </span>
              {activity.garmin_activity_id && (
                <span
                  title={`Synced from Garmin Connect (#${activity.garmin_activity_id})`}
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    color: '#007cc3',
                    background: 'rgba(0, 124, 195, 0.12)',
                    border: '1px solid rgba(0, 124, 195, 0.28)',
                    borderRadius: 9999,
                    padding: '1px 6px',
                    letterSpacing: '0.03em',
                    flexShrink: 0,
                  }}
                >
                  Garmin
                </span>
              )}
              {zoneInfo && (
                <span className="badge" style={{ background: `${zoneInfo.color}20`, color: zoneInfo.color, border: `1px solid ${zoneInfo.color}40`, fontSize: '0.625rem', padding: '1px 6px', flexShrink: 0 }}>
                  {zoneInfo.label}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
              {thaiDate(activity.date)}
            </span>
          </div>
          {(activity.route_name && activity.route_name !== activity.title) && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activity.route_name}
              </span>
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
            {activity.distance_km > 0 && (
              <MetricItem label="Distance" value={`${activity.distance_km.toFixed(2)} km`} />
            )}
            {activity.duration_seconds > 0 && (
              <MetricItem label="Time" value={formatDuration(activity.duration_seconds)} />
            )}
            {activity.avg_pace_sec_per_km && (
              <MetricItem label="Pace" value={formatPace(activity.avg_pace_sec_per_km)} />
            )}
            {activity.avg_hr && (
              <MetricItem label="Avg HR" value={`${activity.avg_hr} bpm`} icon={<Heart size={11} color="#EF4444" weight="fill" />} />
            )}
            {activity.elevation_gain_m > 0 && (
              <MetricItem label="Elev" value={`${activity.elevation_gain_m} m`} />
            )}
            {activity.rpe && (
              <MetricItem label="RPE" value={`${activity.rpe}/10`} />
            )}
          </div>

          {activity.hr_zone_breakdown && Object.keys(activity.hr_zone_breakdown).length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, fontSize: '0.75rem', alignItems: 'center', borderTop: '1px dashed var(--color-border)', paddingTop: 8 }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.6875rem', fontWeight: 600 }}>Zones:</span>
              {hrZones.map((z) => {
                const sec = activity.hr_zone_breakdown?.[`Z${z.zone}`];
                if (!sec) return null;
                const mins = Math.round(sec / 60);
                if (mins === 0) return null;
                return (
                  <span key={z.zone} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: z.color }} />
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{z.label}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{mins}m</span>
                  </span>
                );
              })}
            </div>
          )}

          {activity.notes && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 8, fontStyle: 'italic', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
              {activity.notes}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onEdit} aria-label="Edit activity">
          <PencilSimple size={14} />
          Edit
        </button>
        <button
          className="btn btn-danger btn-sm"
          onClick={onDelete}
          disabled={deleting}
          aria-label="Delete activity"
        >
          <Trash size={14} />
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

function MetricItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 3 }}>
        {icon}{value}
      </div>
    </div>
  );
}
