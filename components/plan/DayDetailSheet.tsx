'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Activity, TrainingPlan } from '@/lib/supabase';
import type { HRZone } from '@/lib/hrZones';
import { formatPace, formatDuration, thaiDate, getSessionColor, SESSION_TYPES } from '@/lib/utils';
import { useTheme } from '@/components/layout/ThemeProvider';
import {
  X, CheckCircle, Circle, Lightning, MapPin,
  Heart, TrendUp, ArrowUp, ArrowDown, Minus,
  ClipboardText, CheckFat, ChartBar, PencilSimple,
  Trash, Plus, FloppyDisk,
} from '@phosphor-icons/react';

interface Props {
  date: string;
  plan: TrainingPlan | null;
  activities: Activity[];
  hrZones: HRZone[];
  onClose: () => void;
  onLogRun: () => void;
  onToggleComplete: () => void;
  onPlanUpdated?: () => void;
}

// Parse "M:SS" or "MM:SS/km" → sec/km; takes lower bound if range "6:45-7:10/km"
function parsePaceToSec(paceStr: string | null | undefined): number | null {
  if (!paceStr || paceStr === '-') return null;
  const first = paceStr.split('-')[0].replace('/km', '').trim();
  const parts = first.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1];
  return null;
}

function DeltaChip({ value, unit, lowerIsBetter = false }: { value: number; unit: string; lowerIsBetter?: boolean }) {
  const neutral = Math.abs(value) < 0.01;
  const positive = neutral ? false : lowerIsBetter ? value < 0 : value > 0;
  const color = neutral ? '#6B7280' : positive ? '#059669' : '#EF4444';
  const Icon = neutral ? Minus : positive ? ArrowUp : ArrowDown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: '0.75rem', fontWeight: 600, color,
      background: `${color}18`, borderRadius: 6, padding: '2px 7px',
    }}>
      <Icon size={10} weight="bold" />
      {Math.abs(value).toFixed(Math.abs(value) % 1 < 0.005 ? 0 : 2)}{unit}
    </span>
  );
}

export function DayDetailSheet({ date, plan, activities, hrZones, onClose, onLogRun, onToggleComplete, onPlanUpdated }: Props) {
  const { theme } = useTheme();
  const color = plan ? getSessionColor(plan.session_type ?? '', theme) : (theme === 'dark' ? '#00E676' : '#059669');
  const hasLogged = activities.length > 0;
  const isPlanned = !!plan;

  // Edit plan state
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [sessionType, setSessionType] = useState(plan?.session_type ?? 'Easy Run');
  const [distanceKm, setDistanceKm] = useState(plan?.distance_km !== null && plan?.distance_km !== undefined ? plan.distance_km.toString() : '');
  const [paceTarget, setPaceTarget] = useState(plan?.pace_target ?? '');
  const [hrZone, setHrZone] = useState(plan?.hr_zone ?? '');
  const [rpe, setRpe] = useState(plan?.rpe ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [notes, setNotes] = useState(plan?.notes ?? '');
  const [phase, setPhase] = useState(plan?.phase ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setIsEditingPlan(false);
    setSessionType(plan?.session_type ?? 'Easy Run');
    setDistanceKm(plan?.distance_km !== null && plan?.distance_km !== undefined ? plan.distance_km.toString() : '');
    setPaceTarget(plan?.pace_target ?? '');
    setHrZone(plan?.hr_zone ?? '');
    setRpe(plan?.rpe ?? '');
    setDescription(plan?.description ?? '');
    setNotes(plan?.notes ?? '');
    setPhase(plan?.phase ?? '');
  }, [plan, date]);

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedDist = distanceKm.trim() ? parseFloat(distanceKm) : null;
      const payload = {
        date,
        session_type: sessionType.trim() || 'Easy Run',
        distance_km: parsedDist,
        pace_target: paceTarget.trim() || null,
        hr_zone: hrZone.trim() || null,
        rpe: rpe.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
        phase: phase.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (plan?.id) {
        const { error } = await supabase
          .from('training_plan')
          .update(payload)
          .eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('training_plan')
          .insert({
            ...payload,
            completed: false,
          });
        if (error) throw error;
      }

      setIsEditingPlan(false);
      onPlanUpdated?.();
    } catch (err) {
      console.error('Save plan error:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกแผนวิ่ง');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!plan?.id) return;
    if (!confirm('คุณต้องการลบแผนวิ่งของวันนี้หรือไม่?')) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('training_plan')
        .delete()
        .eq('id', plan.id);
      if (error) throw error;
      setIsEditingPlan(false);
      onPlanUpdated?.();
    } catch (err) {
      console.error('Delete plan error:', err);
      alert('เกิดข้อผิดพลาดในการลบแผนวิ่ง');
    } finally {
      setDeleting(false);
    }
  };

  // Aggregate actual totals across all activities on this day
  const totalDistanceKm = activities.reduce((s, a) => s + (a.distance_km ?? 0), 0);
  const totalDurationSec = activities.reduce((s, a) => s + (a.duration_seconds ?? 0), 0);
  const paceActivities = activities.filter(a => a.avg_pace_sec_per_km);
  const avgPaceSec = paceActivities.length > 0
    ? paceActivities.reduce((s, a) => s + (a.avg_pace_sec_per_km ?? 0), 0) / paceActivities.length
    : null;
  const hrActivities = activities.filter(a => a.avg_hr);
  const avgHR = hrActivities.length > 0
    ? Math.round(hrActivities.reduce((s, a) => s + (a.avg_hr ?? 0), 0) / hrActivities.length)
    : null;
  const rpeActivities = activities.filter(a => a.rpe);
  const avgRPE = rpeActivities.length > 0
    ? rpeActivities.reduce((s, a) => s + (a.rpe ?? 0), 0) / rpeActivities.length
    : null;

  // Plan targets for comparison
  const plannedDistKm = plan?.distance_km ?? null;
  const plannedPaceSec = parsePaceToSec(plan?.pace_target);
  const plannedRPE = plan?.rpe ? Number(plan.rpe) : null;

  // Deltas (actual - plan)
  const distDelta = (plannedDistKm !== null && totalDistanceKm > 0)
    ? totalDistanceKm - plannedDistKm
    : null;
  const paceDelta = (plannedPaceSec !== null && avgPaceSec !== null)
    ? Math.round(avgPaceSec - plannedPaceSec)
    : null;
  const rpeDelta = (plannedRPE !== null && avgRPE !== null)
    ? avgRPE - plannedRPE
    : null;

  // Don't show comparison if no plan AND no logged activities
  const showComparison = isPlanned || hasLogged;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="sheet animate-slide-up"
        role="dialog"
        aria-modal
        aria-label="Day detail"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 640,
        }}
      >
        {/* Sheet handle */}
        <div className="sheet-handle" style={{ margin: '0 auto 16px' }} />

        {/* Date header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
            </div>
            <h2 style={{ fontSize: '1.5rem', lineHeight: 1, marginTop: 2 }}>{thaiDate(date, 'd MMMM yyyy')}</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Planned session */}
        <section style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClipboardText size={14} color="var(--color-secondary)" weight="bold" />
              Planned
            </p>
            {isPlanned && !isEditingPlan && (
              <button
                type="button"
                onClick={() => setIsEditingPlan(true)}
                className="btn btn-ghost btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', padding: '3px 8px' }}
              >
                <PencilSimple size={14} />
                แก้ไขแผน
              </button>
            )}
          </div>

          {isEditingPlan ? (
            <form onSubmit={handleSavePlan} className="card animate-fade-in" style={{
              padding: '16px',
              borderRadius: 16,
              border: '2px solid var(--color-primary)',
              background: 'var(--color-bg-card)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PencilSimple size={16} color="var(--color-primary)" weight="bold" />
                  {isPlanned ? 'แก้ไขแผนวิ่ง' : 'เพิ่มแผนวิ่งใหม่'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: "'Baloo 2', sans-serif" }}>
                  {thaiDate(date)}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Session Type & Distance */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>ประเภทการวิ่ง</label>
                    <select
                      className="form-select"
                      value={sessionType}
                      onChange={(e) => setSessionType(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {SESSION_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>ระยะทาง (km)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value)}
                      placeholder="0.00"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Pace & HR Zone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Target Pace</label>
                    <input
                      type="text"
                      className="form-input"
                      value={paceTarget}
                      onChange={(e) => setPaceTarget(e.target.value)}
                      placeholder="เช่น 5:30/km"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>HR Zone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={hrZone}
                      onChange={(e) => setHrZone(e.target.value)}
                      placeholder="เช่น Z2, Z3"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* RPE & Phase */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>RPE (1-10)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="form-input"
                      value={rpe}
                      onChange={(e) => setRpe(e.target.value)}
                      placeholder="ความเหนื่อย 1-10"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Phase</label>
                    <input
                      type="text"
                      className="form-input"
                      value={phase}
                      onChange={(e) => setPhase(e.target.value)}
                      placeholder="เช่น Base, Build"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>รายละเอียดการฝึกซ้อม</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="เช่น 8 x 400m พัก 90 วินาที"
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>บันทึกเพิ่มเติม (Notes)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="หมายเหตุเพิ่มเติม"
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                  {plan?.id ? (
                    <button
                      type="button"
                      onClick={handleDeletePlan}
                      disabled={deleting || saving}
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Trash size={15} />
                      {deleting ? 'กำลังลบ...' : 'ลบแผน'}
                    </button>
                  ) : <div />}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setIsEditingPlan(false)}
                      disabled={saving || deleting}
                      className="btn btn-ghost btn-sm"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={saving || deleting}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <FloppyDisk size={15} />
                      {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          ) : isPlanned ? (
            <div
              className="card"
              style={{ borderLeft: `3px solid ${color}`, background: `${color}10` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>
                    {plan!.session_type}
                    {plan!.phase && (
                      <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        [{plan!.phase}]
                      </span>
                    )}
                  </div>
                  {plan!.description && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                      {plan!.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={onToggleComplete}
                  aria-label={plan!.completed ? 'Mark incomplete' : 'Mark complete'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}
                >
                  {plan!.completed
                    ? <CheckCircle size={28} color="#059669" weight="fill" />
                    : <Circle size={28} color="var(--color-text-muted)" />
                  }
                </button>
              </div>

              {/* Plan metrics */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                {plan!.distance_km && plan!.distance_km > 0 && (
                  <PlanMetric icon={<TrendUp size={13} />} label="Distance" value={`${plan!.distance_km} km`} />
                )}
                {plan!.pace_target && plan!.pace_target !== '-' && (
                  <PlanMetric label="Target Pace" value={plan!.pace_target} />
                )}
                {plan!.hr_zone && plan!.hr_zone !== '-' && (
                  <PlanMetric icon={<Heart size={13} color="#EF4444" />} label="HR Zone" value={plan!.hr_zone} />
                )}
                {plan!.rpe && plan!.rpe !== '-' && (
                  <PlanMetric icon={<Lightning size={13} color="#FBBF24" />} label="RPE" value={`${plan!.rpe}/10`} />
                )}
              </div>

              {plan!.notes && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 10, fontStyle: 'italic', borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                  {plan!.notes}
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingPlan(true)}
              className="btn btn-ghost"
              style={{
                width: '100%',
                border: '2px dashed var(--color-border)',
                borderRadius: 14,
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                color: 'var(--color-primary)',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              <Plus size={16} weight="bold" />
              เพิ่มแผนวิ่งสำหรับวันนี้
            </button>
          )}
        </section>

        {/* Actual activities */}
        <section style={{ marginBottom: 20 }}>
          <p className="section-title" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckFat size={14} color="#7FDBB6" weight="fill" />
            Actual {hasLogged ? `(${activities.length})` : ''}
          </p>
          {hasLogged ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activities.map((a) => {
                const actColor = getSessionColor(a.session_type, theme);
                return (
                  <div key={a.id} className="card" style={{ borderLeft: `3px solid ${actColor}` }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{a.session_type}</div>
                    {a.route_name && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} />{a.route_name}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                      {a.distance_km > 0 && <ActivityMetric label="Distance" value={`${a.distance_km.toFixed(2)} km`} />}
                      {a.duration_seconds > 0 && <ActivityMetric label="Time" value={formatDuration(a.duration_seconds)} />}
                      {a.avg_pace_sec_per_km && <ActivityMetric label="Pace" value={formatPace(a.avg_pace_sec_per_km)} />}
                      {a.avg_hr && <ActivityMetric label="Avg HR" value={`${a.avg_hr} bpm`} />}
                      {a.rpe && <ActivityMetric label="RPE" value={`${a.rpe}/10`} />}
                    </div>

                    {a.hr_zone_breakdown && Object.keys(a.hr_zone_breakdown).length > 0 && (
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, fontSize: '0.75rem', alignItems: 'center', borderTop: '1px dashed var(--color-border)', paddingTop: 8 }}>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.6875rem', fontWeight: 600 }}>Zones:</span>
                        {hrZones.map((z) => {
                          const sec = a.hr_zone_breakdown?.[`Z${z.zone}`];
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
                    {a.notes && (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 8, fontStyle: 'italic', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                        {a.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '16px', background: 'var(--color-muted)', borderRadius: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No activities logged for this day
            </div>
          )}
        </section>

        {/* ── Plan vs Actual comparison ── */}
        {showComparison && (
          <section style={{ marginBottom: 20 }}>
            <p className="section-title" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ChartBar size={14} color="var(--color-sky)" weight="bold" />
              Plan vs Actual
            </p>
            <div style={{
              background: 'var(--color-bg-card)',
              borderRadius: 16,
              overflow: 'hidden',
              border: '2px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                padding: '8px 14px',
                background: 'var(--color-muted)',
                borderBottom: '1px solid var(--color-border)',
              }}>
                {['Metric', 'Plan', 'Actual'].map((h, i) => (
                  <span key={h} style={{
                    fontSize: '0.6875rem', fontWeight: 700,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    textAlign: i === 0 ? 'left' : 'center',
                  }}>{h}</span>
                ))}
              </div>

              {/* Distance */}
              {plannedDistKm && plannedDistKm > 0 && (
                <CompareRow
                  label="Distance"
                  plan={`${plannedDistKm} km`}
                  actual={totalDistanceKm > 0 ? `${totalDistanceKm.toFixed(2)} km` : '—'}
                  delta={distDelta !== null ? <DeltaChip value={distDelta} unit=" km" /> : null}
                />
              )}

              {/* Pace */}
              {plan?.pace_target && plan.pace_target !== '-' && (
                <CompareRow
                  label="Pace"
                  plan={plan.pace_target}
                  actual={avgPaceSec ? formatPace(Math.round(avgPaceSec)) : '—'}
                  delta={paceDelta !== null ? <DeltaChip value={-paceDelta} unit="s/km" lowerIsBetter /> : null}
                  note={paceDelta !== null
                    ? paceDelta < -5 ? '🔥 Faster than plan'
                      : paceDelta > 30 ? '⚠️ Slower than plan'
                        : '✓ On target'
                    : undefined}
                />
              )}

              {/* RPE */}
              {plannedRPE !== null && (
                <CompareRow
                  label="RPE"
                  plan={`${plannedRPE}/10`}
                  actual={avgRPE !== null ? `${avgRPE.toFixed(1)}/10` : '—'}
                  delta={rpeDelta !== null ? <DeltaChip value={-rpeDelta} unit="" lowerIsBetter /> : null}
                />
              )}

              {/* Duration */}
              {totalDurationSec > 0 && (
                <CompareRow label="Duration" plan="—" actual={formatDuration(totalDurationSec)} delta={null} />
              )}

              {/* HR */}
              {avgHR && (
                <CompareRow
                  label="Avg HR"
                  plan={plan?.hr_zone && plan.hr_zone !== '-' ? plan.hr_zone : '—'}
                  actual={`${avgHR} bpm`}
                  delta={null}
                />
              )}
            </div>

            {/* Summary verdict */}
            {distDelta !== null && (
              <div style={{
                marginTop: 10, padding: '10px 14px', borderRadius: 12,
                background: distDelta >= -0.5 ? 'rgba(127,219,182,0.15)' : 'rgba(255,107,129,0.10)',
                border: `1px solid ${distDelta >= -0.5 ? 'rgba(127,219,182,0.4)' : 'rgba(255,107,129,0.3)'}`,
                fontSize: '0.8125rem',
                color: distDelta >= -0.5 ? '#059669' : '#FF6B81',
                fontWeight: 600,
              }}>
                {distDelta >= 0
                  ? `You ran ${distDelta.toFixed(2)} km more than planned!`
                  : distDelta >= -0.5
                    ? `Very close — only ${Math.abs(distDelta).toFixed(2)} km short of target`
                    : `${Math.abs(distDelta).toFixed(2)} km short of target`}
              </div>
            )}
          </section>
        )}

        {/* CTA: Log run */}
        {!hasLogged && (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={onLogRun}>
            <Lightning size={16} weight="fill" />
            {isPlanned ? 'Add This Run' : 'Log an Activity'}
          </button>
        )}
      </div>
    </div>
  );
}

function CompareRow({
  label, plan, actual, delta, note,
}: {
  label: string;
  plan: string;
  actual: string;
  delta: React.ReactNode;
  note?: string;
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      padding: '10px 14px',
      borderBottom: '1px solid var(--color-border)',
      alignItems: 'center',
    }}>
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{label}</div>
        {note && <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{note}</div>}
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.875rem', fontFamily: "'Baloo 2', sans-serif", fontWeight: 600, color: 'var(--color-text-muted)' }}>{plan}</div>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <span style={{ fontSize: '0.875rem', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, color: 'var(--color-foreground)' }}>{actual}</span>
        {delta}
      </div>
    </div>
  );
}

function PlanMetric({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {icon && <span style={{ color: 'var(--color-text-muted)' }}>{icon}</span>}
      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{label}:</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-foreground)', fontFamily: "'Baloo 2', sans-serif" }}>{value}</span>
    </div>
  );
}

function ActivityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-foreground)', fontFamily: "'Baloo 2', sans-serif" }}>{value}</div>
    </div>
  );
}
