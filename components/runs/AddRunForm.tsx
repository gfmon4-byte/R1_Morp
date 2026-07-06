'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import type { Activity } from '@/lib/supabase';
import { SESSION_TYPES, thaiToday } from '@/lib/utils';
import { getHRZoneForBpm } from '@/lib/hrZones';
import type { HRZone } from '@/lib/hrZones';
import { X, Camera, Lightning, CheckCircle, Warning } from '@phosphor-icons/react';

const schema = z.object({
  date: z.string().min(1, 'Date required'),
  session_type: z.string().min(1, 'Session type required'),
  distance_km: z.coerce.number().min(0).max(300),
  duration_hh: z.coerce.number().min(0).max(24),
  duration_mm: z.coerce.number().min(0).max(59),
  duration_ss: z.coerce.number().min(0).max(59),
  avg_hr: z.coerce.number().min(0).max(250).optional().nullable(),
  max_hr: z.coerce.number().min(0).max(250).optional().nullable(),
  elevation_gain_m: z.coerce.number().min(0).max(9000),
  rpe: z.coerce.number().min(1).max(10).optional().nullable(),
  notes: z.string().max(500).optional(),
  route_name: z.string().max(100).optional(),
  z1_minutes: z.coerce.number().min(0).max(1440).optional().nullable(),
  z2_minutes: z.coerce.number().min(0).max(1440).optional().nullable(),
  z3_minutes: z.coerce.number().min(0).max(1440).optional().nullable(),
  z4_minutes: z.coerce.number().min(0).max(1440).optional().nullable(),
  z5_minutes: z.coerce.number().min(0).max(1440).optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  activity: Activity | null;
  onClose: () => void;
  onSaved: () => void;
  hrZones: HRZone[];
  defaultDate?: string;
}

export function AddRunForm({ activity, onClose, onSaved, hrZones, defaultDate }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OCR specific states
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrSuccess, setOcrSuccess] = useState(false);

  const durationSec = activity?.duration_seconds ?? 0;
  const dh = Math.floor(durationSec / 3600);
  const dm = Math.floor((durationSec % 3600) / 60);
  const ds = durationSec % 60;

  const { register, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: activity ? {
      date: activity.date,
      session_type: activity.session_type,
      distance_km: activity.distance_km,
      duration_hh: dh,
      duration_mm: dm,
      duration_ss: ds,
      avg_hr: activity.avg_hr ?? undefined,
      max_hr: activity.max_hr ?? undefined,
      elevation_gain_m: activity.elevation_gain_m,
      rpe: activity.rpe ?? undefined,
      notes: activity.notes ?? '',
      route_name: activity.route_name ?? '',
      z1_minutes: activity.hr_zone_breakdown?.Z1 ? Math.round((activity.hr_zone_breakdown.Z1 / 60) * 100) / 100 : undefined,
      z2_minutes: activity.hr_zone_breakdown?.Z2 ? Math.round((activity.hr_zone_breakdown.Z2 / 60) * 100) / 100 : undefined,
      z3_minutes: activity.hr_zone_breakdown?.Z3 ? Math.round((activity.hr_zone_breakdown.Z3 / 60) * 100) / 100 : undefined,
      z4_minutes: activity.hr_zone_breakdown?.Z4 ? Math.round((activity.hr_zone_breakdown.Z4 / 60) * 100) / 100 : undefined,
      z5_minutes: activity.hr_zone_breakdown?.Z5 ? Math.round((activity.hr_zone_breakdown.Z5 / 60) * 100) / 100 : undefined,
    } : {
      date: defaultDate || thaiToday(),
      session_type: 'Easy Run',
      distance_km: 0,
      duration_hh: 0,
      duration_mm: 0,
      duration_ss: 0,
      elevation_gain_m: 0,
    },
  });

  // API key is handled on the backend via process.env.GEMINI_API_KEY

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrError(null);
    setOcrSuccess(false);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        try {
          const response = await fetch('/api/ocr', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: base64String,
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Failed to scan image');
          }

          // Merge results into form
          if (result.date) setValue('date', result.date, { shouldDirty: true });
          if (result.session_type) setValue('session_type', result.session_type, { shouldDirty: true });
          if (result.distance_km !== null && result.distance_km !== undefined) {
            setValue('distance_km', result.distance_km, { shouldDirty: true });
          }
          if (result.duration_hh !== null && result.duration_hh !== undefined) {
            setValue('duration_hh', result.duration_hh, { shouldDirty: true });
          }
          if (result.duration_mm !== null && result.duration_mm !== undefined) {
            setValue('duration_mm', result.duration_mm, { shouldDirty: true });
          }
          if (result.duration_ss !== null && result.duration_ss !== undefined) {
            setValue('duration_ss', result.duration_ss, { shouldDirty: true });
          }
          if (result.avg_hr !== null && result.avg_hr !== undefined) {
            setValue('avg_hr', result.avg_hr, { shouldDirty: true });
          }
          if (result.max_hr !== null && result.max_hr !== undefined) {
            setValue('max_hr', result.max_hr, { shouldDirty: true });
          }
          if (result.elevation_gain_m !== null && result.elevation_gain_m !== undefined) {
            setValue('elevation_gain_m', result.elevation_gain_m, { shouldDirty: true });
          }
          if (result.rpe !== null && result.rpe !== undefined) {
            setValue('rpe', result.rpe, { shouldDirty: true });
          }
          if (result.route_name) {
            setValue('route_name', result.route_name, { shouldDirty: true });
          }

          // Zone times
          if (result.z1_minutes !== null && result.z1_minutes !== undefined) {
            setValue('z1_minutes', Math.round(result.z1_minutes * 100) / 100, { shouldDirty: true });
          }
          if (result.z2_minutes !== null && result.z2_minutes !== undefined) {
            setValue('z2_minutes', Math.round(result.z2_minutes * 100) / 100, { shouldDirty: true });
          }
          if (result.z3_minutes !== null && result.z3_minutes !== undefined) {
            setValue('z3_minutes', Math.round(result.z3_minutes * 100) / 100, { shouldDirty: true });
          }
          if (result.z4_minutes !== null && result.z4_minutes !== undefined) {
            setValue('z4_minutes', Math.round(result.z4_minutes * 100) / 100, { shouldDirty: true });
          }
          if (result.z5_minutes !== null && result.z5_minutes !== undefined) {
            setValue('z5_minutes', Math.round(result.z5_minutes * 100) / 100, { shouldDirty: true });
          }

          setOcrSuccess(true);
          setTimeout(() => setOcrSuccess(false), 5000);
        } catch (err: any) {
          setOcrError(err.message || 'An error occurred during scanning');
        } finally {
          setOcrLoading(false);
        }
      };

      reader.onerror = () => {
        setOcrError('Failed to read image file');
        setOcrLoading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setOcrError('An error occurred. Please try again.');
      setOcrLoading(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      const confirmClose = confirm('คุณต้องการยกเลิกการกรอกข้อมูลและปิดหน้านี้ใช่หรือไม่? ข้อมูลที่คุณกรอกจะสูญหาย');
      if (!confirmClose) return;
    }
    onClose();
  };

  const watchDist = watch('distance_km');
  const watchHH = watch('duration_hh');
  const watchMM = watch('duration_mm');
  const watchSS = watch('duration_ss');
  const watchAvgHr = watch('avg_hr');

  // Live pace calculation
  const totalSec = (Number(watchHH) || 0) * 3600 + (Number(watchMM) || 0) * 60 + (Number(watchSS) || 0);
  const distNum = Number(watchDist) || 0;
  const livePaceSec = distNum > 0 && totalSec > 0 ? Math.round(totalSec / distNum) : null;
  const livePaceStr = livePaceSec ? `${Math.floor(livePaceSec / 60)}:${String(livePaceSec % 60).padStart(2, '0')}/km` : '—';

  // Live HR zone
  const hrNum = Number(watchAvgHr) || 0;
  const hrZoneNum = hrNum > 0 ? getHRZoneForBpm(hrNum, 185, 42) : null;
  const hrZoneInfo = hrZoneNum ? hrZones[hrZoneNum - 1] : null;

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    setError(null);
    const duration_seconds = data.duration_hh * 3600 + data.duration_mm * 60 + data.duration_ss;
    const avg_pace_sec_per_km = distNum > 0 && duration_seconds > 0 ? Math.round(duration_seconds / distNum) : null;

    const hr_zone_breakdown: Record<string, number> = {};
    if (data.z1_minutes) hr_zone_breakdown.Z1 = Math.round(data.z1_minutes * 60);
    if (data.z2_minutes) hr_zone_breakdown.Z2 = Math.round(data.z2_minutes * 60);
    if (data.z3_minutes) hr_zone_breakdown.Z3 = Math.round(data.z3_minutes * 60);
    if (data.z4_minutes) hr_zone_breakdown.Z4 = Math.round(data.z4_minutes * 60);
    if (data.z5_minutes) hr_zone_breakdown.Z5 = Math.round(data.z5_minutes * 60);

    const payload = {
      date: data.date,
      session_type: data.session_type,
      distance_km: data.distance_km,
      duration_seconds,
      avg_pace_sec_per_km,
      avg_hr: data.avg_hr || null,
      max_hr: data.max_hr || null,
      hr_zone_breakdown: Object.keys(hr_zone_breakdown).length > 0 ? hr_zone_breakdown : {},
      elevation_gain_m: data.elevation_gain_m,
      rpe: data.rpe || null,
      notes: data.notes || null,
      route_name: data.route_name || null,
      updated_at: new Date().toISOString(),
    };

    if (activity?.id) {
      const { error: err } = await supabase.from('activities').update(payload).eq('id', activity.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('activities').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  };

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      window.scrollTo(0, 0);
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
    };
  }, []);

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="sheet animate-slide-up" role="dialog" aria-modal aria-label={activity ? 'Edit activity' : 'Add run'}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.25rem' }}>{activity ? 'Edit Activity' : 'Add a Run'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={handleClose} aria-label="Close" type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* OCR File Upload Card */}
            <div 
              style={{
                padding: '16px',
                border: '2px dashed var(--color-border)',
                borderRadius: '20px',
                background: 'rgba(255, 143, 163, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 200ms ease',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)' }}>
                  <Lightning size={16} weight="fill" />
                  <span style={{ fontFamily: 'Baloo 2', fontWeight: 700, fontSize: '0.9375rem' }}>Auto-fill with AI (OCR)</span>
                </div>
              </div>

              {/* Upload Action area */}
              <label 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px 8px',
                  borderRadius: '14px',
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  cursor: ocrLoading ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                  transition: 'all 200ms ease',
                  boxShadow: 'var(--shadow-sm)'
                }}
                onMouseEnter={(e) => !ocrLoading && (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                onMouseLeave={(e) => !ocrLoading && (e.currentTarget.style.borderColor = 'var(--color-border)')}
              >
                <input 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={handleOcrUpload}
                  disabled={ocrLoading}
                />
                
                {ocrLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      กำลังสแกนรูปภาพด้วย AI... 🏃‍♂️💨
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      ระบบกำลังดึงข้อมูลระยะทาง ความเร็ว และโซนหัวใจ
                    </span>
                  </div>
                ) : ocrSuccess ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'var(--color-accent)' }}>
                    <CheckCircle size={32} weight="fill" />
                    <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                      ดึงข้อมูลสำเร็จแล้ว! 🎉
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      ข้อมูลถูกเติมลงในฟอร์มด้านล่างเรียบร้อยแล้ว
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <Camera size={28} color="var(--color-primary)" />
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      อัปโหลดรูปภาพเพื่อดึงข้อมูล (OCR)
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      ลากวางหรือแตะเพื่อเลือกรูปภาพรายละเอียดการวิ่ง/โซนหัวใจ
                    </span>
                  </div>
                )}
              </label>

              {ocrError && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '8px', 
                  padding: '10px 12px', 
                  background: 'rgba(255,107,129,0.1)', 
                  border: '1px solid rgba(255,107,129,0.2)', 
                  borderRadius: '12px',
                  color: 'var(--color-destructive)',
                  fontSize: '0.8125rem'
                }}>
                  <Warning size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>ไม่สามารถสแกนรูปภาพได้</div>
                    <div>{ocrError}</div>
                  </div>
                </div>
              )}
            </div>
            {/* Date + Session type */}
            <div className="form-grid-2">
              <div>
                <label className="form-label" htmlFor="run-date">Date</label>
                <input id="run-date" type="date" className="form-input" {...register('date')} />
                {errors.date && <p className="form-error">{errors.date.message}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="run-type">Type</label>
                <select id="run-type" className="form-select" {...register('session_type')}>
                  {SESSION_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Distance + Route */}
            <div className="form-grid-2">
              <div>
                <label className="form-label" htmlFor="run-dist">Distance (km)</label>
                <input id="run-dist" type="number" step="0.01" className="form-input" {...register('distance_km')} placeholder="0.00" />
              </div>
              <div>
                <label className="form-label" htmlFor="run-route">Route Name</label>
                <input id="run-route" type="text" className="form-input" {...register('route_name')} placeholder="Optional" />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="form-label">Duration (hh:mm:ss)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <input type="number" min="0" max="23" className="form-input" {...register('duration_hh')} placeholder="hh" style={{ textAlign: 'center' }} aria-label="Hours" />
                </div>
                <div>
                  <input type="number" min="0" max="59" className="form-input" {...register('duration_mm')} placeholder="mm" style={{ textAlign: 'center' }} aria-label="Minutes" />
                </div>
                <div>
                  <input type="number" min="0" max="59" className="form-input" {...register('duration_ss')} placeholder="ss" style={{ textAlign: 'center' }} aria-label="Seconds" />
                </div>
              </div>
              {/* Live pace */}
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Avg Pace:</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {livePaceStr}
                </span>
              </div>
            </div>

            {/* HR */}
            <div className="form-grid-2">
              <div>
                <label className="form-label" htmlFor="run-avghr">
                  Avg HR (bpm)
                  {hrZoneInfo && (
                    <span className="badge" style={{ marginLeft: 8, background: `${hrZoneInfo.color}20`, color: hrZoneInfo.color, border: `1px solid ${hrZoneInfo.color}40` }}>
                      {hrZoneInfo.label}
                    </span>
                  )}
                </label>
                <input id="run-avghr" type="number" className="form-input" {...register('avg_hr')} placeholder="e.g. 152" />
              </div>
              <div>
                <label className="form-label" htmlFor="run-maxhr">Max HR (bpm)</label>
                <input id="run-maxhr" type="number" className="form-input" {...register('max_hr')} placeholder="e.g. 175" />
              </div>
            </div>

            {/* HR Zone Breakdown */}
            <div>
              <label className="form-label" style={{ marginBottom: 6 }}>HR Zone Breakdown (mins)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {hrZones.map((z) => {
                  const fieldName = `z${z.zone}_minutes` as 'z1_minutes' | 'z2_minutes' | 'z3_minutes' | 'z4_minutes' | 'z5_minutes';
                  return (
                    <div key={z.zone} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: z.color }}>
                        {z.label}
                      </span>
                      <input
                        type="number"
                        step="any"
                        className="form-input"
                        placeholder="0"
                        style={{ textAlign: 'center', padding: '6px 4px', fontSize: '0.8125rem', minHeight: 'unset', height: '36px' }}
                        aria-label={`Zone ${z.zone} minutes`}
                        {...register(fieldName)}
                      />
                      <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {z.minBpm}–{z.maxBpm}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Elevation + RPE */}
            <div className="form-grid-2">
              <div>
                <label className="form-label" htmlFor="run-elev">Elevation (m)</label>
                <input id="run-elev" type="number" className="form-input" {...register('elevation_gain_m')} placeholder="0" />
              </div>
              <div>
                <label className="form-label" htmlFor="run-rpe">RPE (1-10)</label>
                <input id="run-rpe" type="number" min="1" max="10" className="form-input" {...register('rpe')} placeholder="—" />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="form-label" htmlFor="run-notes">Notes</label>
              <textarea id="run-notes" className="form-textarea" rows={2} {...register('notes')} placeholder="How did it feel?" />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#EF4444', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%', marginTop: 4 }}>
              {saving ? 'Saving…' : activity ? 'Save Changes' : 'Save Run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
