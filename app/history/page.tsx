'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Activity, Profile } from '@/lib/supabase';
import { formatPace, formatDuration, thaiDate, getSessionColor, SESSION_TYPES } from '@/lib/utils';
import { computeHRZones, getHRZoneForBpm } from '@/lib/hrZones';
import { AddRunForm } from '@/components/runs/AddRunForm';
import { Plus, Funnel, Trash, PencilSimple, Heart, MapPin, ArrowsDownUp } from '@phosphor-icons/react';

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

  return (
    <div>
      {/* Header */}
      <header className="page-header">
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '1.5rem' }}>Run History</h1>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setEditActivity(null); setShowForm(true); }}
            aria-label="Add new run"
          >
            <Plus size={16} weight="bold" />
            Add Run
          </button>
        </div>
      </header>

      <div className="page-content" style={{ paddingTop: 16 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
            <span style={{ fontWeight: 600, fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activity.session_type}
            </span>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {zoneInfo && (
                <span className="badge" style={{ background: `${zoneInfo.color}20`, color: zoneInfo.color, border: `1px solid ${zoneInfo.color}40` }}>
                  {zoneInfo.label}
                </span>
              )}
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {thaiDate(activity.date)}
            {activity.route_name && <> · <MapPin size={11} style={{ verticalAlign: -1 }} /> {activity.route_name}</>}
          </div>

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
