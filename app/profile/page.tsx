'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/supabase';
import { computeHRZones } from '@/lib/hrZones';
import { computeAutoPaceZones, computeManualPaceZones } from '@/lib/paceZones';
import { secondsToHMMSS, mmssToSeconds, thaiToday } from '@/lib/utils';
import { User, Lightning, FloppyDisk, Heart, Gauge, Trophy, ArrowsClockwise, CalendarBlank, Trash, PencilSimple, Plus, X } from '@phosphor-icons/react';
import { parseISO, differenceInCalendarDays } from 'date-fns';
import { useTheme } from '@/components/layout/ThemeProvider';
import { gitInfo } from '@/lib/git-info';

const pbToMMSS = (sec: number | null | undefined): string => {
  if (!sec) return '';
  return secondsToHMMSS(sec);
};

const schema = z.object({
  name: z.string().min(1, 'Name required').max(60),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  birth_date: z.string().optional().nullable(),
  vo2max: z.coerce.number().min(20).max(100).optional().nullable(),
  vt2_percent: z.coerce.number().min(50).max(100).optional().nullable(),
  weight_kg: z.coerce.number().min(30).max(200).optional().nullable(),
  height_cm: z.coerce.number().min(100).max(250).optional().nullable(),
  pb_5k: z.string().optional(),
  pb_10k: z.string().optional(),
  pb_half: z.string().optional(),
  pb_marathon: z.string().optional(),
  hr_max: z.coerce.number().min(100).max(230),
  hr_rest: z.coerce.number().min(20).max(100),
  pace_zone_mode: z.enum(['auto', 'manual']),
  pace_zone_1_min: z.string().optional().nullable(),
  pace_zone_1_max: z.string().optional().nullable(),
  pace_zone_2_min: z.string().optional().nullable(),
  pace_zone_2_max: z.string().optional().nullable(),
  pace_zone_3_min: z.string().optional().nullable(),
  pace_zone_3_max: z.string().optional().nullable(),
  pace_zone_4_min: z.string().optional().nullable(),
  pace_zone_4_max: z.string().optional().nullable(),
  pace_zone_5_min: z.string().optional().nullable(),
  pace_zone_5_max: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const { theme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [races, setRaces] = useState<Array<{ id: string; name: string; date: string; distance?: string }>>([]);
  const [newRaceName, setNewRaceName] = useState('');
  const [newRaceDate, setNewRaceDate] = useState('');
  const [newRaceDistance, setNewRaceDistance] = useState('10k');
  const [newRaceError, setNewRaceError] = useState<string | null>(null);
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null);
  const [isRaceModalOpen, setIsRaceModalOpen] = useState(false);

  const handleAddRace = () => {
    setNewRaceError(null);
    if (!newRaceName.trim()) {
      setNewRaceError('กรุณากรอกชื่องานวิ่ง');
      return;
    }
    if (!newRaceDate) {
      setNewRaceError('กรุณาเลือกวันที่');
      return;
    }

    if (editingRaceId) {
      // Update existing race
      setRaces((prev) =>
        prev.map((r) =>
          r.id === editingRaceId
            ? { ...r, name: newRaceName.trim(), date: newRaceDate, distance: newRaceDistance }
            : r
        )
      );
      setEditingRaceId(null);
    } else {
      // Add new race
      const newRace = {
        id: Math.random().toString(36).substring(2, 9),
        name: newRaceName.trim(),
        date: newRaceDate,
        distance: newRaceDistance,
      };
      setRaces((prev) => [...prev, newRace]);
    }

    setNewRaceName('');
    setNewRaceDate('');
    setNewRaceDistance('10k');
    setIsRaceModalOpen(false);
  };

  const handleStartEdit = (race: { id: string; name: string; date: string; distance?: string }) => {
    setEditingRaceId(race.id);
    setNewRaceName(race.name);
    setNewRaceDate(race.date);
    setNewRaceDistance(race.distance || '10k');
    setNewRaceError(null);
    setIsRaceModalOpen(true);
  };

  const handleCancelEdit = () => {
    const isDirty = !!newRaceName.trim() || !!newRaceDate;
    if (isDirty) {
      const confirmClose = confirm('คุณต้องการยกเลิกการกรอกข้อมูลและปิดหน้านี้ใช่หรือไม่? ข้อมูลที่คุณกรอกจะสูญหาย');
      if (!confirmClose) return;
    }
    setEditingRaceId(null);
    setNewRaceName('');
    setNewRaceDate('');
    setNewRaceDistance('10k');
    setNewRaceError(null);
    setIsRaceModalOpen(false);
  };

  const handleDeleteRace = (id: string) => {
    if (editingRaceId === id) {
      handleCancelEdit();
    }
    setRaces((prev) => prev.filter((r) => r.id !== id));
  };

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { pace_zone_mode: 'auto', hr_max: 185, hr_rest: 42 },
  });

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) {
        setProfile(data as Profile);
        reset({
          name: data.name,
          gender: data.gender,
          birth_date: data.birth_date,
          vo2max: data.vo2max,
          vt2_percent: data.vt2_percent ?? 85,
          weight_kg: data.weight_kg,
          height_cm: data.height_cm,
          pb_5k: pbToMMSS(data.pb_5k),
          pb_10k: pbToMMSS(data.pb_10k),
          pb_half: pbToMMSS(data.pb_half),
          pb_marathon: pbToMMSS(data.pb_marathon),
          hr_max: data.hr_max,
          hr_rest: data.hr_rest,
          pace_zone_mode: data.pace_zone_mode,
          pace_zone_1_min: data.pace_zone_1_min,
          pace_zone_1_max: data.pace_zone_1_max,
          pace_zone_2_min: data.pace_zone_2_min,
          pace_zone_2_max: data.pace_zone_2_max,
          pace_zone_3_min: data.pace_zone_3_min,
          pace_zone_3_max: data.pace_zone_3_max,
          pace_zone_4_min: data.pace_zone_4_min,
          pace_zone_4_max: data.pace_zone_4_max,
          pace_zone_5_min: data.pace_zone_5_min,
          pace_zone_5_max: data.pace_zone_5_max,
        });

        const localRaces = typeof window !== 'undefined' ? localStorage.getItem('profile_races') : null;
        let loadedRaces: any[] = [];
        if (data.races) {
          loadedRaces = Array.isArray(data.races) ? data.races : JSON.parse(data.races);
        } else if (localRaces) {
          try {
            loadedRaces = JSON.parse(localRaces);
          } catch (e) {
            loadedRaces = [];
          }
        }
        setRaces(loadedRaces);
      }
      setLoading(false);
    });
  }, [reset]);

  // Prevent body scroll when race modal is open
  useEffect(() => {
    if (isRaceModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isRaceModalOpen]);

  const watchHrMax = Number(watch('hr_max') || 185);
  const watchHrRest = Number(watch('hr_rest') || 42);
  const watchVo2 = Number(watch('vo2max') || 0);
  const watchVt2 = Number(watch('vt2_percent') || 85);
  const watchPaceMode = watch('pace_zone_mode');
  const watchPb10k = watch('pb_10k');
  const watchPbHalf = watch('pb_half');

  const hrZones = computeHRZones(watchHrMax, watchHrRest);

  const getCountdownText = (raceDateStr: string | null | undefined) => {
    if (!raceDateStr) return null;
    try {
      const todayStr = thaiToday(); // "yyyy-MM-dd"
      const raceDate = parseISO(raceDateStr);
      const today = parseISO(todayStr);
      const diff = differenceInCalendarDays(raceDate, today);
      
      if (diff > 0) {
        return {
          diff,
          text: `เหลือเวลาอีก ${diff} วัน จะถึงวันแข่ง! 🏁`,
          status: 'future'
        };
      } else if (diff === 0) {
        return {
          diff: 0,
          text: `วันนี้เป็นวันแข่งของคุณแล้ว! สู้ๆ นะครับ! 🎉🏆`,
          status: 'today'
        };
      } else {
        return {
          diff,
          text: `แข่งเสร็จสิ้นแล้วเมื่อ ${Math.abs(diff)} วันก่อน 🏅`,
          status: 'past'
        };
      }
    } catch (e) {
      return null;
    }
  };

  // countdown helper inside map loop will use getCountdownText directly

  const paceZones = watchPaceMode === 'auto'
    ? computeAutoPaceZones(
        mmssToSeconds(watchPb10k ?? ''),
        mmssToSeconds(watchPbHalf ?? ''),
      )
    : computeManualPaceZones({
        zone1Min: watch('pace_zone_1_min'), zone1Max: watch('pace_zone_1_max'),
        zone2Min: watch('pace_zone_2_min'), zone2Max: watch('pace_zone_2_max'),
        zone3Min: watch('pace_zone_3_min'), zone3Max: watch('pace_zone_3_max'),
        zone4Min: watch('pace_zone_4_min'), zone4Max: watch('pace_zone_4_max'),
        zone5Min: watch('pace_zone_5_min'), zone5Max: watch('pace_zone_5_max'),
      });

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    setError(null);
    const payload = {
      id: 1,
      name: data.name,
      gender: data.gender || null,
      birth_date: data.birth_date || null,
      vo2max: data.vo2max || null,
      vt2_percent: data.vt2_percent || null,
      weight_kg: data.weight_kg || null,
      height_cm: data.height_cm || null,
      pb_5k: data.pb_5k ? mmssToSeconds(data.pb_5k) : null,
      pb_10k: data.pb_10k ? mmssToSeconds(data.pb_10k) : null,
      pb_half: data.pb_half ? mmssToSeconds(data.pb_half) : null,
      pb_marathon: data.pb_marathon ? mmssToSeconds(data.pb_marathon) : null,
      hr_max: data.hr_max,
      hr_rest: data.hr_rest,
      pace_zone_mode: data.pace_zone_mode,
      pace_zone_1_min: data.pace_zone_1_min || null,
      pace_zone_1_max: data.pace_zone_1_max || null,
      pace_zone_2_min: data.pace_zone_2_min || null,
      pace_zone_2_max: data.pace_zone_2_max || null,
      pace_zone_3_min: data.pace_zone_3_min || null,
      pace_zone_3_max: data.pace_zone_3_max || null,
      pace_zone_4_min: data.pace_zone_4_min || null,
      pace_zone_4_max: data.pace_zone_4_max || null,
      pace_zone_5_min: data.pace_zone_5_min || null,
      pace_zone_5_max: data.pace_zone_5_max || null,
      updated_at: new Date().toISOString(),
    };

    const payloadWithRaces = {
      ...payload,
      races: races,
    };

    let { error: err } = await supabase.from('profiles').upsert(payloadWithRaces, { onConflict: 'id' });
    
    // Fallback if races column does not exist in database yet
    if (err && (err.message.includes('column') || err.code === '42703')) {
      console.warn('Races column does not exist in DB yet. Saving locally to localStorage...', err);
      const { error: fallbackErr } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
      err = fallbackErr;
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('profile_races', JSON.stringify(races));
      }
    } else {
      if (!err && typeof window !== 'undefined') {
        localStorage.setItem('profile_races', JSON.stringify(races));
      }
    }

    if (err) { setError(err.message); }
    else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div>
        <header className="page-header">
          <div style={{ maxWidth: 640, margin: '0 auto' }}><h1 style={{ fontSize: '1.5rem' }}>Profile</h1></div>
        </header>
        <div className="page-content" style={{ paddingTop: 20 }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 12 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={20} color="var(--color-primary)" weight="fill" />
            </div>
            <h1 style={{ fontSize: '1.5rem' }}>Profile</h1>
          </div>
        </div>
      </header>

      <div className="page-content" style={{ paddingTop: 20 }}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>

          {/* Personal Info */}
          <Section title="Personal Info" icon={<User size={16} color="var(--color-primary)" />}>
            <div className="form-grid-2" style={{ gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="p-name">Name</label>
                <input id="p-name" type="text" className="form-input" {...register('name')} />
                {errors.name && <p className="form-error">{errors.name.message}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="p-gender">Gender</label>
                <select id="p-gender" className="form-select" {...register('gender')}>
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="p-dob">Birth Date</label>
                <input id="p-dob" type="date" className="form-input" {...register('birth_date')} />
              </div>
              <div>
                <label className="form-label" htmlFor="p-weight">Weight (kg)</label>
                <input id="p-weight" type="number" step="0.1" className="form-input" {...register('weight_kg')} />
              </div>
              <div>
                <label className="form-label" htmlFor="p-height">Height (cm)</label>
                <input id="p-height" type="number" className="form-input" {...register('height_cm')} />
              </div>
            </div>
          </Section>

          {/* VO2max / VT2 */}
          <Section title="Performance Metrics" icon={<Gauge size={16} color="var(--color-primary)" />}>
            <div className="form-grid-2" style={{ gap: 12 }}>
              <div>
                <label className="form-label" htmlFor="p-vo2">VO₂max (ml/kg/min)</label>
                <input id="p-vo2" type="number" step="0.1" className="form-input" {...register('vo2max')} placeholder="e.g. 72" />
              </div>
              <div>
                <label className="form-label" htmlFor="p-vt2">VT2 (% VO₂max)</label>
                <input id="p-vt2" type="number" step="0.5" className="form-input" {...register('vt2_percent')} placeholder="e.g. 85" />
              </div>
            </div>

            {/* VO2max benchmark bar */}
            {watchVo2 > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8125rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>VO₂max comparison</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Barlow Condensed' }}>{watchVo2.toFixed(1)} ml/kg/min</span>
                </div>
                <div style={{ height: 8, background: 'var(--color-bg-elevated)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  {/* Elite range band 85-90 → but we normalize against 85 ml/kg/min max */}
                  <div style={{ position: 'absolute', left: `${(80 / 90) * 100}%`, width: `${(5 / 90) * 100}%`, height: '100%', background: 'rgba(5,150,105,0.3)', borderRadius: 2 }} title="Elite 80–85" />
                  <div style={{
                    height: '100%',
                    width: `${Math.min((watchVo2 / 90) * 100, 100)}%`,
                    background: watchVo2 >= 75 ? '#059669' : watchVo2 >= 60 ? 'var(--color-primary)' : '#FBBF24',
                    borderRadius: 4,
                    transition: 'width 0.4s',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.6875rem', color: 'var(--color-text-subtle)' }}>
                  <span>Beginner 35</span>
                  <span style={{ color: '#059669' }}>Elite 75–90+</span>
                  <span>90 ml/kg/min</span>
                </div>
                {/* VT2 indicator */}
                {watchVt2 > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>VT2 performance threshold:</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: watchVt2 >= 85 ? '#059669' : '#FBBF24', fontFamily: 'Barlow Condensed' }}>
                      {watchVt2}% {watchVt2 >= 85 ? '🏆 Elite range' : watchVt2 >= 80 ? '↑ Good' : 'Build target'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Personal Bests */}
          <Section title="Personal Bests" icon={<Trophy size={16} color="var(--color-primary)" />}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>Format: H:MM:SS or MM:SS</p>
            <div className="form-grid-2" style={{ gap: 12 }}>
              {[
                { id: 'pb-5k', field: 'pb_5k' as const, label: '5K' },
                { id: 'pb-10k', field: 'pb_10k' as const, label: '10K' },
                { id: 'pb-half', field: 'pb_half' as const, label: 'Half Marathon' },
                { id: 'pb-marathon', field: 'pb_marathon' as const, label: 'Marathon' },
              ].map(({ id, field, label }) => (
                <div key={id}>
                  <label className="form-label" htmlFor={id}>{label}</label>
                  <input id={id} type="text" className="form-input" {...register(field)} placeholder="e.g. 38:30" />
                </div>
              ))}
            </div>
          </Section>

          {/* Races & Events */}
          <Section title="Races & Events" icon={<CalendarBlank size={16} color="var(--color-primary)" />}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0, color: 'var(--color-foreground)', fontFamily: "'Baloo 2', sans-serif" }}>
                Your Race List ({races.length})
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '0 14px', height: '36px', minHeight: '36px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => {
                  setEditingRaceId(null);
                  setNewRaceName('');
                  setNewRaceDate('');
                  setNewRaceDistance('10k');
                  setNewRaceError(null);
                  setIsRaceModalOpen(true);
                }}
              >
                <Plus size={14} /> Add Race
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {races.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', border: '2px dashed var(--color-border)', borderRadius: '18px', fontSize: '0.8125rem', fontFamily: "'Mali', sans-serif" }}>
                  No races added yet.
                </div>
              ) : (
                [...races]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((race) => {
                    const countdown = getCountdownText(race.date);
                    return (
                      <div
                        key={race.id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: 18,
                          background: 'var(--color-bg-card)',
                          border: '2px solid var(--color-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: countdown?.status === 'today'
                              ? 'rgba(127, 219, 182, 0.2)'
                              : countdown?.status === 'past'
                                ? 'var(--color-muted)'
                                : 'rgba(255, 143, 163, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '1.25rem'
                          }}>
                            {countdown?.status === 'today' ? '🏆' : countdown?.status === 'past' ? '🏅' : '🏁'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontFamily: "'Baloo 2', sans-serif", fontSize: '0.95rem', color: 'var(--color-foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{race.name}</span>
                              {race.distance && (
                                <span style={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  background: 'rgba(201,167,235,0.15)',
                                  border: '1px solid rgba(201,167,235,0.4)',
                                  color: 'var(--color-secondary)',
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                  fontFamily: "'Baloo 2', sans-serif",
                                  lineHeight: 1,
                                  flexShrink: 0
                                }}>
                                  {race.distance}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Mali', sans-serif" }}>
                              <span>{race.date}</span>
                              <span>•</span>
                              <span style={{
                                fontWeight: 700,
                                color: countdown?.status === 'today'
                                  ? '#059669'
                                  : countdown?.status === 'past'
                                    ? 'var(--color-text-muted)'
                                    : theme === 'dark'
                                      ? '#FFFFFF'
                                      : 'var(--color-primary)'
                              }}>
                                {countdown?.text}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(race)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(201, 167, 235, 0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            title="Edit Race"
                          >
                            <PencilSimple size={18} color="var(--color-secondary)" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRace(race.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 107, 129, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            title="Delete Race"
                          >
                            <Trash size={18} color="var(--color-destructive)" />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </Section>

          {/* HR Settings */}
          <Section title="Heart Rate" icon={<Heart size={16} color="#EF4444" />}>
            <div className="form-grid-2" style={{ gap: 12, marginBottom: 16 }}>
              <div>
                <label className="form-label" htmlFor="p-hrmax">Max HR (bpm)</label>
                <input id="p-hrmax" type="number" className="form-input" {...register('hr_max')} />
              </div>
              <div>
                <label className="form-label" htmlFor="p-hrrest">Resting HR (bpm)</label>
                <input id="p-hrrest" type="number" className="form-input" {...register('hr_rest')} />
              </div>
            </div>

            {/* HR Zones — read-only, live computed */}
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowsClockwise size={13} />
              Live HR Zones (Karvonen)
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {hrZones.map((z) => (
                <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${z.color}20`, border: `1px solid ${z.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: z.color, fontFamily: 'Barlow Condensed' }}>{z.label}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 6, background: 'var(--color-bg-elevated)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: `${Math.max(0, ((z.minBpm - 40) / (watchHrMax - 40)) * 100)}%`,
                        width: `${Math.min(((z.maxBpm - z.minBpm) / (watchHrMax - 40)) * 100, 100)}%`,
                        height: '100%',
                        background: z.color,
                        borderRadius: 3,
                      }} />
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontFamily: 'Barlow Condensed', fontWeight: 700, color: z.color, minWidth: 80, textAlign: 'right' }}>
                    {z.minBpm}–{z.maxBpm} bpm
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 60, textAlign: 'right' }}>{z.description}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Pace Zones */}
          <Section title="Pace Zones" icon={<Lightning size={16} color="#FBBF24" />}>
            {/* Mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: watchPaceMode === 'auto' ? 'var(--color-text)' : 'var(--color-text-muted)' }}>Auto</span>
              <button
                type="button"
                role="switch"
                aria-checked={watchPaceMode === 'manual'}
                className={`toggle ${watchPaceMode === 'manual' ? 'active' : ''}`}
                onClick={() => setValue('pace_zone_mode', watchPaceMode === 'auto' ? 'manual' : 'auto')}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: watchPaceMode === 'manual' ? 'var(--color-text)' : 'var(--color-text-muted)' }}>Manual</span>
              {watchPaceMode === 'auto' && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>from 10k/Half PBs</span>
              )}
            </div>

            {watchPaceMode === 'auto' ? (
              /* Auto zones — read-only display */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {paceZones.map((z) => (
                  <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${z.color}20`, border: `1px solid ${z.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: z.color, fontFamily: 'Barlow Condensed' }}>{z.label}</span>
                    </div>
                    <div style={{ flex: 1, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{z.description}</div>
                    <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.875rem', color: z.color }}>
                      {z.minPace} — {z.maxPace}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              /* Manual inputs */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  { n: 1, min: 'pace_zone_1_min', max: 'pace_zone_1_max' },
                  { n: 2, min: 'pace_zone_2_min', max: 'pace_zone_2_max' },
                  { n: 3, min: 'pace_zone_3_min', max: 'pace_zone_3_max' },
                  { n: 4, min: 'pace_zone_4_min', max: 'pace_zone_4_max' },
                  { n: 5, min: 'pace_zone_5_min', max: 'pace_zone_5_max' },
                ] as const).map(({ n, min, max }) => {
                  const zColor = paceZones[n - 1]?.color ?? '#6EE7B7';
                  return (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${zColor}20`, border: `1px solid ${zColor}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: zColor, fontFamily: 'Barlow Condensed' }}>Z{n}</span>
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        style={{ flex: 1 }}
                        placeholder="Min (e.g. 6:45)"
                        {...register(min)}
                      />
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>—</span>
                      <input
                        type="text"
                        className="form-input"
                        style={{ flex: 1 }}
                        placeholder="Max (e.g. 7:10)"
                        {...register(max)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {error && (
            <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#EF4444', fontSize: '0.875rem', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
            {saving ? (
              'Saving…'
            ) : saved ? (
              <>✓ Saved!</>
            ) : (
              <><FloppyDisk size={16} weight="fill" /> Save Profile</>
            )}
          </button>
          <div style={{
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--color-text-subtle)',
            marginTop: 16,
            marginBottom: 8,
          }}>
            อัปเดตล่าสุด (Git): {gitInfo.commitDate}
          </div>
          <div style={{ height: 16 }} />
        </form>
      </div>

      {/* Add/Edit Race Modal Sheet */}
      {isRaceModalOpen && (
        <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && handleCancelEdit()}>
          <div className="sheet animate-slide-up" role="dialog" aria-modal aria-label={editingRaceId ? 'Edit Race' : 'Add New Race'}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: "'Baloo 2', sans-serif" }}>
                {editingRaceId ? 'Edit Race Info' : 'Add New Race'}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={handleCancelEdit}
                aria-label="Close"
                style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Race Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newRaceName}
                  onChange={(e) => setNewRaceName(e.target.value)}
                  placeholder="e.g. Pattaya Marathon"
                />
              </div>

              <div className="form-grid-2" style={{ gap: 12 }}>
                <div>
                  <label className="form-label">Race Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newRaceDate}
                    onChange={(e) => setNewRaceDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Distance</label>
                  <select
                    className="form-select"
                    value={newRaceDistance}
                    onChange={(e) => setNewRaceDistance(e.target.value)}
                  >
                    <option value="5k">5K</option>
                    <option value="10k">10K</option>
                    <option value="Half">Half Marathon</option>
                    <option value="Full">Full Marathon</option>
                  </select>
                </div>
              </div>

              {newRaceError && (
                <p style={{ color: 'var(--color-destructive)', fontSize: '0.75rem', margin: '4px 0 0 0', fontWeight: 600, fontFamily: "'Mali', sans-serif" }}>
                  {newRaceError}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: '0.875rem' }}
                  onClick={handleAddRace}
                >
                  {editingRaceId ? '✓ Update Race' : '+ Add Race'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ flex: 1, fontSize: '0.875rem' }}
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--color-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}
