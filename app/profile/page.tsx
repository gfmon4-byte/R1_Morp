'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import type { Profile, InBodyHistory } from '@/lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { computeHRZones } from '@/lib/hrZones';
import { computeAutoPaceZones, computeManualPaceZones } from '@/lib/paceZones';
import { secondsToHMMSS, mmssToSeconds, thaiToday } from '@/lib/utils';
import { User, Lightning, FloppyDisk, Heart, Gauge, Trophy, ArrowsClockwise, CalendarBlank, Trash, PencilSimple, Plus, X, Camera, CheckCircle, Warning } from '@phosphor-icons/react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { useTheme } from '@/components/layout/ThemeProvider';
import { DailySleepMonitor } from '@/components/profile/DailySleepMonitor';
import { Vo2MaxChart } from '@/components/profile/Vo2MaxChart';

const pbToMMSS = (sec: number | null | undefined): string => {
  if (!sec) return '';
  return secondsToHMMSS(sec);
};

const schema = z.object({
  name: z.string().min(1, 'Name required').max(60),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  birth_date: z.string().optional().nullable(),
  vo2max: z.coerce.number().min(20).max(100).optional().nullable(),
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
  inbody_weight: z.coerce.number().min(30).max(200).optional().nullable(),
  inbody_smm: z.coerce.number().min(10).max(100).optional().nullable(),
  inbody_bfm: z.coerce.number().min(2).max(100).optional().nullable(),
  inbody_tbw: z.coerce.number().min(10).max(100).optional().nullable(),
  inbody_protein: z.coerce.number().min(2).max(50).optional().nullable(),
  inbody_mineral: z.coerce.number().min(0.5).max(20).optional().nullable(),
  inbody_date: z.string().optional().nullable(),
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

  // OCR states for InBody
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [inbodyHistory, setInbodyHistory] = useState<InBodyHistory[]>([]);
  const [isInbodyHistoryModalOpen, setIsInbodyHistoryModalOpen] = useState(false);

  // PR sync states
  const [isSyncingPrs, setIsSyncingPrs] = useState(false);
  const [prSyncMsg, setPrSyncMsg] = useState<string | null>(null);

  // HR sync states
  const [isSyncingHr, setIsSyncingHr] = useState(false);
  const [hrSyncMsg, setHrSyncMsg] = useState<string | null>(null);

  const handleDeleteHistory = async (id: string, date: string) => {
    const confirmDelete = confirm(`คุณต้องการลบข้อมูล InBody ของวันที่ ${date} ใช่หรือไม่?`);
    if (!confirmDelete) return;

    // 1. Delete from DB
    const { error: dbErr } = await supabase.from('inbody_history').delete().eq('date', date);

    // 2. Delete from LocalStorage fallback
    if (typeof window !== 'undefined') {
      const localHistory = localStorage.getItem('profile_inbody_history');
      if (localHistory) {
        try {
          let currentHistory = JSON.parse(localHistory);
          currentHistory = currentHistory.filter((item: any) => item.date !== date);
          localStorage.setItem('profile_inbody_history', JSON.stringify(currentHistory));
          setInbodyHistory(currentHistory);
        } catch (e) {}
      }
    }

    if (!dbErr) {
      const { data: newHistory } = await supabase.from('inbody_history').select('*').order('date', { ascending: true });
      if (newHistory) {
        setInbodyHistory(newHistory as InBodyHistory[]);
      }
    }
  };

  const handleEditHistory = (item: InBodyHistory) => {
    setValue('inbody_date', item.date, { shouldDirty: true });
    setValue('inbody_weight', item.weight, { shouldDirty: true });
    setValue('inbody_smm', item.smm, { shouldDirty: true });
    setValue('inbody_bfm', item.bfm, { shouldDirty: true });
    setValue('inbody_tbw', item.tbw, { shouldDirty: true });
    setValue('inbody_protein', item.protein, { shouldDirty: true });
    setValue('inbody_mineral', item.mineral, { shouldDirty: true });
    if (item.weight) setValue('weight_kg', item.weight, { shouldDirty: true }); // Sync profile weight
    
    setIsInbodyHistoryModalOpen(false);

    // Scroll to form fields
    const formElement = document.getElementById('ib-date');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

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
          const response = await fetch('/api/ocr-inbody', {
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
          if (result.date) setValue('inbody_date', result.date, { shouldDirty: true });
          if (result.weight !== null && result.weight !== undefined) {
            setValue('inbody_weight', result.weight, { shouldDirty: true });
            setValue('weight_kg', result.weight, { shouldDirty: true }); // Sync weight to standard profile weight
          }
          if (result.smm !== null && result.smm !== undefined) {
            setValue('inbody_smm', result.smm, { shouldDirty: true });
          }
          if (result.bfm !== null && result.bfm !== undefined) {
            setValue('inbody_bfm', result.bfm, { shouldDirty: true });
          }
          if (result.tbw !== null && result.tbw !== undefined) {
            setValue('inbody_tbw', result.tbw, { shouldDirty: true });
          }
          if (result.protein !== null && result.protein !== undefined) {
            setValue('inbody_protein', result.protein, { shouldDirty: true });
          }
          if (result.mineral !== null && result.mineral !== undefined) {
            setValue('inbody_mineral', result.mineral, { shouldDirty: true });
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

  const persistRaces = async (newRaces: Array<{ id: string; name: string; date: string; distance?: string }>) => {
    setRaces(newRaces);
    if (typeof window !== 'undefined') {
      localStorage.setItem('profile_races', JSON.stringify(newRaces));
    }
    try {
      const { error: raceErr } = await supabase
        .from('profiles')
        .update({ races: newRaces, updated_at: new Date().toISOString() })
        .eq('id', 1);

      if (raceErr) {
        console.warn('Failed to update races in Supabase, saved to localStorage fallback:', raceErr);
      }
    } catch (err) {
      console.warn('Error updating races in Supabase:', err);
    }
  };

  const handleAddRace = async () => {
    setNewRaceError(null);
    if (!newRaceName.trim()) {
      setNewRaceError('กรุณากรอกชื่องานวิ่ง');
      return;
    }
    if (!newRaceDate) {
      setNewRaceError('กรุณาเลือกวันที่');
      return;
    }

    let updatedRaces: Array<{ id: string; name: string; date: string; distance?: string }>;
    if (editingRaceId) {
      // Update existing race
      updatedRaces = races.map((r) =>
        r.id === editingRaceId
          ? { ...r, name: newRaceName.trim(), date: newRaceDate, distance: newRaceDistance }
          : r
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
      updatedRaces = [...races, newRace];
    }

    await persistRaces(updatedRaces);

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

  const handleDeleteRace = async (id: string) => {
    if (editingRaceId === id) {
      handleCancelEdit();
    }
    const updatedRaces = races.filter((r) => r.id !== id);
    await persistRaces(updatedRaces);
  };

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { pace_zone_mode: 'auto', hr_max: 185, hr_rest: 42 },
  });

  const applyProfileToForm = useCallback((data: Profile) => {
    setProfile(data);

    // Load fallback InBody from localStorage if it exists
    const localInbody = typeof window !== 'undefined' ? localStorage.getItem('profile_inbody') : null;
    let parsedInbody: any = {};
    if (localInbody) {
      try {
        parsedInbody = JSON.parse(localInbody);
      } catch (e) {
        parsedInbody = {};
      }
    }

    const garminPrs = (data as any)?.garmin_prs || {};
    const effectivePb5k = data.pb_5k ?? garminPrs['5k']?.seconds;
    const effectivePb10k = data.pb_10k ?? garminPrs['10k']?.seconds;
    const effectivePbHalf = data.pb_half ?? garminPrs['hm']?.seconds;
    const effectivePbMarathon = data.pb_marathon ?? garminPrs['full']?.seconds;

    reset({
      name: data.name,
      gender: data.gender,
      birth_date: data.birth_date,
      vo2max: data.vo2max,
      weight_kg: data.weight_kg,
      height_cm: data.height_cm,
      pb_5k: pbToMMSS(effectivePb5k),
      pb_10k: pbToMMSS(effectivePb10k),
      pb_half: pbToMMSS(effectivePbHalf),
      pb_marathon: pbToMMSS(effectivePbMarathon),
      hr_max: data.hr_max ?? 193,
      hr_rest: data.hr_rest ?? 63,
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
      inbody_weight: data.inbody_weight ?? parsedInbody.inbody_weight,
      inbody_smm: data.inbody_smm ?? parsedInbody.inbody_smm,
      inbody_bfm: data.inbody_bfm ?? parsedInbody.inbody_bfm,
      inbody_tbw: data.inbody_tbw ?? parsedInbody.inbody_tbw,
      inbody_protein: data.inbody_protein ?? parsedInbody.inbody_protein,
      inbody_mineral: data.inbody_mineral ?? parsedInbody.inbody_mineral,
      inbody_date: data.inbody_date ?? parsedInbody.inbody_date,
    });
  }, [reset]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', 1).single();
    if (data) {
      applyProfileToForm(data as Profile);
    }
  }, [applyProfileToForm]);

  const handleSyncPrs = async () => {
    setIsSyncingPrs(true);
    setPrSyncMsg(null);
    try {
      const res = await fetch('/api/garmin-profile-sync', { method: 'POST' });
      const raw = await res.text();
      let json: any = {};
      try { json = JSON.parse(raw); } catch { throw new Error(res.status === 504 ? 'ซิงค์ข้อมูลโปรไฟล์ใช้เวลานานเกินกำหนด (504 Timeout)' : `HTTP ${res.status}`); }
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Sync failed');
      }
      setPrSyncMsg('ซิงค์ Official Personal Records จาก Garmin สำเร็จ ✨');
      await refreshProfile();
      setTimeout(() => setPrSyncMsg(null), 3500);
    } catch (err: any) {
      setPrSyncMsg(`เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถซิงค์ได้'}`);
      setTimeout(() => setPrSyncMsg(null), 4000);
    } finally {
      setIsSyncingPrs(false);
    }
  };

  const handleSyncHr = async () => {
    setIsSyncingHr(true);
    setHrSyncMsg(null);
    try {
      const res = await fetch('/api/garmin-profile-sync', { method: 'POST' });
      const raw = await res.text();
      let json: any = {};
      try { json = JSON.parse(raw); } catch { throw new Error(res.status === 504 ? 'ซิงค์ข้อมูลโปรไฟล์ใช้เวลานานเกินกำหนด (504 Timeout)' : `HTTP ${res.status}`); }
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Sync failed');
      }
      const newMax = json.data?.max_hr || 193;
      const newRest = json.data?.resting_hr || 63;
      setValue('hr_max', newMax, { shouldDirty: true });
      setValue('hr_rest', newRest, { shouldDirty: true });
      setHrSyncMsg(`ซิงค์ Max HR (${newMax} bpm) และ Resting HR (${newRest} bpm) จาก Garmin สำเร็จ ✨`);
      await refreshProfile();
      setTimeout(() => setHrSyncMsg(null), 3500);
    } catch (err: any) {
      setHrSyncMsg(`เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถซิงค์ได้'}`);
      setTimeout(() => setHrSyncMsg(null), 4000);
    } finally {
      setIsSyncingHr(false);
    }
  };

  const garminPrsList = useMemo(() => {
    const prs = profile?.garmin_prs || {};
    return Object.values(prs)
      .filter((pr: any) => pr.key !== '1mi' && pr.key !== '1mile' && pr.label !== '1 Mile')
      .sort((a: any, b: any) => (a.order || 99) - (b.order || 99));
  }, [profile?.garmin_prs]);

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) {
        applyProfileToForm(data as Profile);

        const localRaces = typeof window !== 'undefined' ? localStorage.getItem('profile_races') : null;
        let loadedRaces: any[] = [];
        let parsedDbRaces: any[] = [];
        if (data.races) {
          try {
            parsedDbRaces = Array.isArray(data.races) ? data.races : JSON.parse(data.races as any);
          } catch (e) {
            parsedDbRaces = [];
          }
        }
        let parsedLocalRaces: any[] = [];
        if (localRaces) {
          try {
            parsedLocalRaces = JSON.parse(localRaces);
          } catch (e) {
            parsedLocalRaces = [];
          }
        }

        if (parsedDbRaces.length > 0) {
          loadedRaces = parsedDbRaces;
          if (typeof window !== 'undefined') {
            localStorage.setItem('profile_races', JSON.stringify(parsedDbRaces));
          }
        } else if (parsedLocalRaces.length > 0) {
          loadedRaces = parsedLocalRaces;
          supabase
            .from('profiles')
            .update({ races: parsedLocalRaces, updated_at: new Date().toISOString() })
            .eq('id', 1)
            .then(() => {});
        } else {
          loadedRaces = [];
        }
        setRaces(loadedRaces);

        // Load InBody History from Supabase, fallback to localStorage
        supabase.from('inbody_history').select('*').order('date', { ascending: true }).then(({ data: historyData, error: historyErr }) => {
          const localHistory = typeof window !== 'undefined' ? localStorage.getItem('profile_inbody_history') : null;
          let loadedHistory: InBodyHistory[] = [];
          if (historyData && !historyErr) {
            loadedHistory = historyData as InBodyHistory[];
          } else if (localHistory) {
            try {
              loadedHistory = JSON.parse(localHistory);
            } catch (e) {
              loadedHistory = [];
            }
          }
          setInbodyHistory(loadedHistory);
        });
      }
      setLoading(false);
    });
  }, [applyProfileToForm]);

  // Prevent body scroll when race modal or InBody history modal is open
  useEffect(() => {
    if (isRaceModalOpen || isInbodyHistoryModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isRaceModalOpen, isInbodyHistoryModalOpen]);

  // Listen for global sync events (from GlobalTopSyncBar)
  useEffect(() => {
    const handleGlobalSync = () => {
      refreshProfile();
    };
    window.addEventListener('garmin-synced-all', handleGlobalSync);
    return () => window.removeEventListener('garmin-synced-all', handleGlobalSync);
  }, [refreshProfile]);

  const watchHrMax = Number(watch('hr_max') || 185);
  const watchHrRest = Number(watch('hr_rest') || 42);
  const watchVo2 = Number(watch('vo2max') || 0);
  const watchPaceMode = watch('pace_zone_mode');
  const watchPb10k = watch('pb_10k');
  const watchPbHalf = watch('pb_half');

  // InBody watched fields
  const watchInbodyWeight = watch('inbody_weight');
  const watchInbodySmm = watch('inbody_smm');
  const watchInbodyBfm = watch('inbody_bfm');

  // Personal Info watches and computed values
  const watchBirthDate = watch('birth_date');
  const watchWeightKg = watch('weight_kg');
  const watchHeightCm = watch('height_cm');

  const computedAge = useMemo(() => {
    if (!watchBirthDate) return null;
    try {
      const today = new Date();
      const birth = parseISO(watchBirthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch (e) {
      return null;
    }
  }, [watchBirthDate]);

  const computedBmi = useMemo(() => {
    if (!watchWeightKg || !watchHeightCm) return null;
    const heightM = Number(watchHeightCm) / 100;
    if (heightM <= 0) return null;
    const bmi = Number(watchWeightKg) / (heightM * heightM);
    return parseFloat(bmi.toFixed(1));
  }, [watchWeightKg, watchHeightCm]);

  const hrZones = computeHRZones(watchHrMax, watchHrRest, profile);

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
      inbody_weight: data.inbody_weight || null,
      inbody_smm: data.inbody_smm || null,
      inbody_bfm: data.inbody_bfm || null,
      inbody_tbw: data.inbody_tbw || null,
      inbody_protein: data.inbody_protein || null,
      inbody_mineral: data.inbody_mineral || null,
      inbody_date: data.inbody_date || null,
      updated_at: new Date().toISOString(),
    };

    const payloadWithRaces = {
      ...payload,
      races: races,
    };

    let { error: err } = await supabase.from('profiles').upsert(payloadWithRaces, { onConflict: 'id' });
    
    // Fallback if races or InBody columns do not exist in database yet
    if (err && (err.message.includes('column') || err.code === '42703')) {
      console.warn('InBody or races columns do not exist in DB yet. Saving locally to localStorage...', err);
      
      const standardPayload = {
        id: 1,
        name: data.name,
        gender: data.gender || null,
        birth_date: data.birth_date || null,
        vo2max: data.vo2max || null,
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

      const { error: fallbackErr } = await supabase.from('profiles').upsert(standardPayload, { onConflict: 'id' });
      err = fallbackErr;
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('profile_races', JSON.stringify(races));
        localStorage.setItem('profile_inbody', JSON.stringify({
          inbody_weight: data.inbody_weight,
          inbody_smm: data.inbody_smm,
          inbody_bfm: data.inbody_bfm,
          inbody_tbw: data.inbody_tbw,
          inbody_protein: data.inbody_protein,
          inbody_mineral: data.inbody_mineral,
          inbody_date: data.inbody_date,
        }));
      }
    } else {
      if (!err && typeof window !== 'undefined') {
        localStorage.setItem('profile_races', JSON.stringify(races));
        localStorage.setItem('profile_inbody', JSON.stringify({
          inbody_weight: data.inbody_weight,
          inbody_smm: data.inbody_smm,
          inbody_bfm: data.inbody_bfm,
          inbody_tbw: data.inbody_tbw,
          inbody_protein: data.inbody_protein,
          inbody_mineral: data.inbody_mineral,
          inbody_date: data.inbody_date,
        }));
      }
    }

    // Save to InBody History if date is specified
    if (data.inbody_date) {
      const historyEntry = {
        date: data.inbody_date,
        weight: data.inbody_weight || null,
        smm: data.inbody_smm || null,
        bfm: data.inbody_bfm || null,
        tbw: data.inbody_tbw || null,
        protein: data.inbody_protein || null,
        mineral: data.inbody_mineral || null,
      };

      // 1. Try DB save
      const { error: historySaveErr } = await supabase.from('inbody_history').upsert(historyEntry, { onConflict: 'date' });
      
      // 2. Local fallback
      if (typeof window !== 'undefined') {
        const localHistory = localStorage.getItem('profile_inbody_history');
        let currentHistory: any[] = [];
        if (localHistory) {
          try {
            currentHistory = JSON.parse(localHistory);
          } catch (e) {
            currentHistory = [];
          }
        }
        // Remove existing entry on same date if any, then insert new one
        currentHistory = currentHistory.filter((item: any) => item.date !== data.inbody_date);
        currentHistory.push({
          id: Math.random().toString(36).substring(2, 9),
          ...historyEntry,
          created_at: new Date().toISOString()
        });
        currentHistory.sort((a, b) => a.date.localeCompare(b.date));
        localStorage.setItem('profile_inbody_history', JSON.stringify(currentHistory));
        setInbodyHistory(currentHistory);
      } else {
        // If DB succeeded, update state
        if (!historySaveErr) {
          const { data: newHistory } = await supabase.from('inbody_history').select('*').order('date', { ascending: true });
          if (newHistory) {
            setInbodyHistory(newHistory as InBodyHistory[]);
          }
        }
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
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                <label className="form-label">Age (years)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={computedAge !== null ? `${computedAge} ปี` : '—'} 
                  disabled 
                  style={{ background: 'var(--color-bg-elevated)', cursor: 'not-allowed' }}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="p-height">Height (cm)</label>
                <input id="p-height" type="number" className="form-input" {...register('height_cm')} />
              </div>
              <div>
                <label className="form-label" htmlFor="p-weight">Weight (kg)</label>
                <input id="p-weight" type="number" step="0.1" className="form-input" {...register('weight_kg')} />
              </div>
              <div>
                <label className="form-label">BMI</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={computedBmi !== null ? `${computedBmi} (${computedBmi < 18.5 ? 'น้ำหนักน้อย' : computedBmi < 25.0 ? 'ปกติ' : computedBmi < 30.0 ? 'น้ำหนักเกิน' : 'อ้วน'})` : '—'} 
                  disabled 
                  style={{ 
                    background: 'var(--color-bg-elevated)', 
                    cursor: 'not-allowed', 
                    fontWeight: 700, 
                    color: computedBmi !== null 
                      ? (computedBmi >= 18.5 && computedBmi < 25.0 ? '#059669' : '#EF4444') 
                      : 'inherit' 
                  }}
                />
              </div>
            </div>
          </Section>

          {/* InBody Composition OCR Section */}
          <Section title="InBody Composition (OCR)" icon={<Lightning size={16} color="var(--color-primary)" />}>
            {/* Minimal Clean InBody Action Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 16,
              }}
            >
              {/* Sleek Minimal OCR Upload Button */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 10,
                  background: 'rgba(255, 143, 163, 0.08)',
                  border: '1px dashed var(--color-border)',
                  cursor: ocrLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  transition: 'all 0.15s ease',
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
                  <>
                    <div className="skeleton" style={{ width: 14, height: 14, borderRadius: '50%' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>กำลังสแกนรูป InBody... 📊</span>
                  </>
                ) : ocrSuccess ? (
                  <>
                    <CheckCircle size={15} weight="fill" color="var(--color-accent)" />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>ดึงข้อมูลสำเร็จ! 🎉</span>
                  </>
                ) : (
                  <>
                    <Camera size={15} color="var(--color-primary)" weight="duotone" />
                    <span>Auto-fill InBody (OCR)</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>• แตะเลือกรูป</span>
                  </>
                )}
              </label>

              {/* View History Button */}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ height: 30, padding: '0 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5, borderRadius: 8 }}
                onClick={() => setIsInbodyHistoryModalOpen(true)}
              >
                <CalendarBlank size={13} /> ประวัติ InBody ({inbodyHistory.length})
              </button>
            </div>

            {/* OCR Error Alert if any */}
            {ocrError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  background: 'rgba(255, 107, 129, 0.1)',
                  border: '1px solid rgba(255, 107, 129, 0.25)',
                  borderRadius: 10,
                  color: 'var(--color-destructive)',
                  fontSize: '0.75rem',
                  marginBottom: 14,
                }}
              >
                <Warning size={14} style={{ flexShrink: 0 }} />
                <span>{ocrError}</span>
              </div>
            )}

            {/* InBody Inputs */}
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '20px' }}>
              <div>
                <label className="form-label" htmlFor="ib-date">Test Date</label>
                <input id="ib-date" type="date" className="form-input" {...register('inbody_date')} />
              </div>
              <div>
                <label className="form-label" htmlFor="ib-weight">Weight (kg)</label>
                <input id="ib-weight" type="number" step="0.1" className="form-input" {...register('inbody_weight')} />
              </div>
              <div>
                <label className="form-label" htmlFor="ib-smm">Skeletal Muscle Mass (kg)</label>
                <input id="ib-smm" type="number" step="0.1" className="form-input" {...register('inbody_smm')} />
              </div>
              <div>
                <label className="form-label" htmlFor="ib-bfm">Body Fat Mass (kg)</label>
                <input id="ib-bfm" type="number" step="0.1" className="form-input" {...register('inbody_bfm')} />
              </div>
              <div>
                <label className="form-label" htmlFor="ib-tbw">Total Body Water (L)</label>
                <input id="ib-tbw" type="number" step="0.1" className="form-input" {...register('inbody_tbw')} />
              </div>
              <div>
                <label className="form-label" htmlFor="ib-protein">Protein (kg)</label>
                <input id="ib-protein" type="number" step="0.1" className="form-input" {...register('inbody_protein')} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label" htmlFor="ib-mineral">Mineral (kg)</label>
                <input id="ib-mineral" type="number" step="0.01" className="form-input" {...register('inbody_mineral')} />
              </div>
            </div>

            {/* Visual Muscle-Fat Analysis */}
            {watchInbodyWeight && watchInbodySmm && watchInbodyBfm ? (
              <div style={{
                background: 'var(--color-bg-elevated)',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid var(--color-border)'
              }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-foreground)' }}>
                  Muscle-Fat Analysis
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Weight bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600 }}>Weight: {watchInbodyWeight} kg</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>Norm: 51.0 - 69.0 kg</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--color-border-muted)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min((Number(watchInbodyWeight) / 75) * 100, 100)}%`,
                        background: 'var(--color-secondary)',
                        borderRadius: '4px'
                      }} />
                    </div>
                  </div>

                  {/* SMM bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600 }}>SMM: {watchInbodySmm} kg</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>Norm: 22.9 - 27.9 kg</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--color-border-muted)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min((Number(watchInbodySmm) / 32) * 100, 100)}%`,
                        background: Number(watchInbodySmm) < 22.9 ? 'var(--color-destructive)' : 'var(--color-accent)',
                        borderRadius: '4px'
                      }} />
                    </div>
                  </div>

                  {/* BFM bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600 }}>Body Fat Mass: {watchInbodyBfm} kg</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>Norm: 12.0 - 19.2 kg</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--color-border-muted)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min((Number(watchInbodyBfm) / 25) * 100, 100)}%`,
                        background: Number(watchInbodyBfm) > 19.2 ? 'var(--color-primary)' : 'var(--color-secondary)',
                        borderRadius: '4px'
                      }} />
                    </div>
                  </div>
                </div>
                
                {/* Balance type estimation */}
                <div style={{ 
                  marginTop: '12px', 
                  fontSize: '0.75rem', 
                  fontFamily: 'Mali, sans-serif',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>Muscle-Fat Type:</span>
                  <span style={{ 
                    fontWeight: 700, 
                    color: Number(watchInbodySmm) > Number(watchInbodyBfm) ? 'var(--color-accent)' : 'var(--color-primary)' 
                  }}>
                    {Number(watchInbodySmm) < 22.9 && Number(watchInbodyBfm) > 15 
                      ? 'C-Shape (Muscle builder target)' 
                      : Number(watchInbodySmm) > Number(watchInbodyBfm) 
                        ? 'D-Shape (Strong / Athletic)' 
                        : 'I-Shape (Balanced)'}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Historical Trend Chart */}
            {inbodyHistory.length > 0 && (
              <div style={{
                marginTop: '20px',
                background: 'var(--color-bg-elevated)',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid var(--color-border)'
              }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-foreground)', fontFamily: "'Baloo 2', sans-serif" }}>
                  InBody Composition Trends
                </p>
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={[...inbodyHistory]
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((item) => {
                          let dateLabel = item.date;
                          try {
                            dateLabel = format(parseISO(item.date), 'dd/MM/yyyy');
                          } catch (e) {}
                          return {
                            date: dateLabel,
                            Weight: item.weight,
                            SMM: item.smm,
                            BFM: item.bfm,
                          };
                        })}
                      margin={{ top: 5, right: 5, left: -25, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-muted)" />
                      <XAxis dataKey="date" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-bg-surface)',
                          border: '2px solid var(--color-border)',
                          borderRadius: '12px',
                          color: 'var(--color-text)',
                          fontSize: '0.75rem',
                          fontFamily: 'Mali, sans-serif'
                        }}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '0.75rem', fontFamily: 'Mali, sans-serif' }} />
                      <Line type="monotone" name="Weight (kg)" dataKey="Weight" stroke="#C9A7EB" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" name="SMM (kg)" dataKey="SMM" stroke="#7FDBB6" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" name="Body Fat (kg)" dataKey="BFM" stroke="#FF8FA3" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </Section>

                    {/* Performance Metrics: VO2max Trend Line Chart */}
          <Section title="Performance Metrics" icon={<Gauge size={16} color="var(--color-primary)" />}>
            <Vo2MaxChart
              profile={profile}
              watchVo2={watchVo2}
              register={register}
              onRefresh={refreshProfile}
            />
          </Section>

          {/* Official Personal Records */}
          <Section
            title="Official Personal Records"
            icon={<Trophy size={16} color="#F59E0B" weight="fill" />}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  สถิติสถิติส่วนบุคคลอย่างเป็นทางการจาก Garmin Connect • ซิงค์อัตโนมัติ
                </p>
                {prSyncMsg && (
                  <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600, marginTop: 4 }}>
                    {prSyncMsg}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={isSyncingPrs}
                onClick={handleSyncPrs}
                style={{
                  padding: '0 12px',
                  height: '32px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  background: 'var(--color-bg-surface)',
                  cursor: isSyncingPrs ? 'not-allowed' : 'pointer',
                }}
              >
                <ArrowsClockwise size={13} className={isSyncingPrs ? 'animate-spin' : ''} />
                {isSyncingPrs ? 'กำลังซิงค์...' : 'ซิงค์จาก Garmin'}
              </button>
            </div>

            {/* Official Garmin PR Showcase Cards */}
            {garminPrsList.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 10,
                marginBottom: 18,
              }}>
                {garminPrsList.map((pr: any) => (
                  <div key={pr.key} style={{
                    background: 'var(--color-bg-surface)',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 14,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {pr.label}
                      </span>
                      <Trophy size={14} color="#F59E0B" weight="fill" />
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-foreground)', fontFamily: "'Baloo 2', sans-serif", lineHeight: 1.2 }}>
                      {pr.time_str}
                    </div>
                    {pr.activity_name && (
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pr.activity_name}>
                        {pr.activity_name}
                      </div>
                    )}
                    {pr.date && (
                      <div style={{ fontSize: '0.625rem', color: '#10B981', fontWeight: 600 }}>
                        {pr.date}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Benchmark Inputs for Training Pace Zones */}
            <div style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 14,
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-foreground)' }}>
                  Benchmark Records (ใช้คำนวณ Pace Zones):
                </span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                  Format: H:MM:SS or MM:SS
                </span>
              </div>
              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { id: 'pb-5k', field: 'pb_5k' as const, label: '5K', garminKey: '5k' },
                  { id: 'pb-10k', field: 'pb_10k' as const, label: '10K', garminKey: '10k' },
                  { id: 'pb-half', field: 'pb_half' as const, label: 'Half Marathon', garminKey: 'hm' },
                  { id: 'pb-marathon', field: 'pb_marathon' as const, label: 'Marathon', garminKey: 'full' },
                ].map(({ id, field, label, garminKey }) => {
                  const gPr = profile?.garmin_prs?.[garminKey];
                  return (
                    <div key={id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label className="form-label" htmlFor={id} style={{ margin: 0 }}>{label}</label>
                        {gPr?.time_str && (
                          <span style={{ fontSize: '0.6875rem', color: '#10B981', fontWeight: 600 }}>
                            Garmin: {gPr.time_str}
                          </span>
                        )}
                      </div>
                      <input id={id} type="text" className="form-input" {...register(field)} placeholder="e.g. 38:30" />
                    </div>
                  );
                })}
              </div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  ค่าอัตราการเต้นของหัวใจจาก Garmin Connect • ซิงค์อัตโนมัติ
                </p>
                {hrSyncMsg && (
                  <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600, marginTop: 4 }}>
                    {hrSyncMsg}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={isSyncingHr}
                onClick={handleSyncHr}
                style={{
                  padding: '0 12px',
                  height: '32px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  background: 'var(--color-bg-surface)',
                  cursor: isSyncingHr ? 'not-allowed' : 'pointer',
                }}
              >
                <ArrowsClockwise size={13} className={isSyncingHr ? 'animate-spin' : ''} />
                {isSyncingHr ? 'กำลังซิงค์...' : 'ซิงค์จาก Garmin'}
              </button>
            </div>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label className="form-label" htmlFor="p-hrmax" style={{ margin: 0 }}>Max HR (bpm)</label>
                  {profile?.hr_max && (
                    <span style={{ fontSize: '0.6875rem', color: '#10B981', fontWeight: 600 }}>Garmin: {profile.hr_max} bpm</span>
                  )}
                </div>
                <input id="p-hrmax" type="number" className="form-input" {...register('hr_max')} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label className="form-label" htmlFor="p-hrrest" style={{ margin: 0 }}>Resting HR (bpm)</label>
                  {profile?.hr_rest && (
                    <span style={{ fontSize: '0.6875rem', color: '#10B981', fontWeight: 600 }}>Garmin: {profile.hr_rest} bpm</span>
                  )}
                </div>
                <input id="p-hrrest" type="number" className="form-input" {...register('hr_rest')} />
              </div>
            </div>

            {/* HR Zones — synced from Garmin / live computed */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <ArrowsClockwise size={13} />
                Heart Rate Zones (Garmin)
              </p>
              {profile?.fitness_age_data?.garmin_hr_zones ? (
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: '#10B981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '2px 8px',
                  borderRadius: 12,
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                  Garmin Synced
                </span>
              ) : (
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-bg-elevated)',
                  padding: '2px 8px',
                  borderRadius: 12,
                }}>
                  Auto / Karvonen
                </span>
              )}
            </div>
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

          {/* Daily Sleep Monitor */}
          <DailySleepMonitor
            sleepRecords={profile?.fitness_age_data?.sleep || []}
            onRefresh={refreshProfile}
            lastSyncTime={profile?.last_garmin_sync}
          />

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
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>from 10k/Half PRs</span>
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

      {/* InBody History List Modal Sheet */}
      {isInbodyHistoryModalOpen && (
        <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setIsInbodyHistoryModalOpen(false)}>
          <div className="sheet animate-slide-up" role="dialog" aria-modal aria-label="InBody History List">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: "'Baloo 2', sans-serif" }}>
                ประวัติผลตรวจ InBody ({inbodyHistory.length})
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setIsInbodyHistoryModalOpen(false)}
                aria-label="Close"
                style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
              {inbodyHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', border: '2px dashed var(--color-border)', borderRadius: '18px', fontSize: '0.8125rem', fontFamily: "'Mali', sans-serif" }}>
                  ยังไม่มีข้อมูลประวัติ InBody
                </div>
              ) : (
                [...inbodyHistory]
                  .sort((a, b) => b.date.localeCompare(a.date)) // Newest first
                  .map((item) => {
                    let formattedDate = item.date;
                    try {
                      formattedDate = format(parseISO(item.date), 'dd/MM/yyyy');
                    } catch (e) {}

                    return (
                      <div
                        key={item.id || item.date}
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
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontFamily: "'Baloo 2', sans-serif", fontSize: '0.95rem', color: 'var(--color-foreground)' }}>
                            วันที่ตรวจ: {formattedDate}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '8px 12px', fontFamily: "'Mali', sans-serif" }}>
                            <span>น้ำหนัก: <strong>{item.weight || '-'} kg</strong></span>
                            <span>มวลกล้ามเนื้อ: <strong>{item.smm || '-'} kg</strong></span>
                            <span>มวลไขมัน: <strong>{item.bfm || '-'} kg</strong></span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleEditHistory(item)}
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
                            title="Edit Record"
                          >
                            <PencilSimple size={18} color="var(--color-secondary)" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHistory(item.id, item.date)}
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
                            title="Delete Record"
                          >
                            <Trash size={18} color="var(--color-destructive)" />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
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
