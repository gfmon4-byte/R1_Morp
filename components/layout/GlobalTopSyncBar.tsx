'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowsClockwise,
  SneakerMove,
  CheckCircle,
  Warning,
  X,
  Sparkle,
  Lightning,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';

export function GlobalTopSyncBar() {
  const router = useRouter();
  const pathname = usePathname();

  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncStage, setSyncStage] = useState<'idle' | 'activities' | 'profile' | 'done'>('idle');
  const [lastSyncText, setLastSyncText] = useState<string>('พร้อมซิงค์ข้อมูล');
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
    submessage?: string;
  } | null>(null);

  const formatLastSync = (isoString?: string | null) => {
    if (!isoString) return 'พร้อมซิงค์ข้อมูล';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'พร้อมซิงค์ข้อมูล';
      const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      const now = new Date();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      if (isToday) return `ซิงค์ล่าสุด: วันนี้ ${timeStr} น.`;
      return `ซิงค์ล่าสุด: ${d.getDate()}/${d.getMonth() + 1} ${timeStr} น.`;
    } catch {
      return 'พร้อมซิงค์ข้อมูล';
    }
  };

  const updateLastSyncText = useCallback((iso?: string | null) => {
    const text = formatLastSync(iso);
    setLastSyncText(text);
  }, []);

  // Initialize last sync time from Supabase profile or localStorage on mount
  useEffect(() => {
    const loadLastSync = async () => {
      let savedIso = typeof window !== 'undefined' ? localStorage.getItem('garmin_last_sync_all') : null;
      if (!savedIso) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('last_garmin_sync')
          .eq('id', 1)
          .maybeSingle();
        if (profile?.last_garmin_sync) {
          savedIso = profile.last_garmin_sync;
          if (typeof window !== 'undefined' && savedIso) {
            localStorage.setItem('garmin_last_sync_all', savedIso);
          }
        }
      }
      updateLastSyncText(savedIso);
    };

    loadLastSync();
  }, [updateLastSyncText]);

  // Main Handler: Sync EVERYTHING in the system
  const handleSyncAll = async () => {
    if (syncing) return;

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(15);
    }

    setSyncing(true);
    setToast(null);
    setSyncStage('activities');

    try {
      // 1. Sync Activities (30 days of runs, laps, paces, HR zones)
      const actRes = await fetch('/api/garmin-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      });
      const actData = await actRes.json();

      if (!actData.success && actData.error && actData.error.toLowerCase().includes('token')) {
        throw new Error('โทเค็น Garmin หมดอายุหรือยังไม่ได้เชื่อมต่อ กรุณาเข้าสู่ระบบใหม่ที่แท็บ Garmin');
      }

      setSyncStage('profile');

      // 2. Sync Profile, 30-Day Sleep, Body Battery, VO2 Max, Fitness Age, PRs, Shoes & Training Metrics
      const profRes = await fetch('/api/garmin-profile-sync', {
        method: 'POST',
      });
      const profData = await profRes.json();

      // 3. Warm latest run cache if runs were retrieved
      try {
        const { data: latestAct } = await supabase
          .from('activities')
          .select('date')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestAct?.date) {
          await fetch(`/api/garmin-last-run?date=${latestAct.date}&fresh=true`).catch(() => {});
        }
      } catch (err) {
        console.warn('Cache warm ignored:', err);
      }

      // 4. Update last sync timestamp
      const nowIso = new Date().toISOString();
      if (typeof window !== 'undefined') {
        localStorage.setItem('garmin_last_sync_all', nowIso);
      }
      updateLastSyncText(nowIso);

      // 5. Broadcast global event so all open pages (Dashboard, History, Plan, Profile) update live
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('garmin-synced-all', {
            detail: {
              activities: actData,
              profile: profData,
              syncedAt: nowIso,
            },
          })
        );
      }

      // 6. Refresh server components via router
      router.refresh();

      // 7. Show success toast
      const newRuns = actData?.inserted || 0;
      setToast({
        type: 'success',
        message: 'ซิงค์ข้อมูลระบบทั้งหมดสำเร็จ! ✨',
        submessage:
          newRuns > 0
            ? `พบการวิ่งใหม่ ${newRuns} รายการ • อัปเดตข้อมูลการนอน สุขภาพ และ VO₂ ล่าสุดเรียบร้อย`
            : `ข้อมูลวิ่งเป็นปัจจุบันแล้ว • อัปเดตข้อมูลการนอน 30 วัน สุขภาพ และ VO₂ สำเร็จ`,
      });
    } catch (err: any) {
      console.error('[GlobalTopSyncBar error]', err);
      setToast({
        type: 'error',
        message: 'การซิงค์ระบบล้มเหลว',
        submessage: err.message || 'ไม่สามารถเชื่อมต่อ Garmin Connect ได้ กรุณาลองใหม่อีกครั้ง',
      });
    } finally {
      setSyncing(false);
      setSyncStage('idle');
      setTimeout(() => setToast(null), 6000);
    }
  };

  const getSyncButtonLabel = () => {
    if (syncStage === 'activities') return 'ซิงค์การวิ่ง...';
    if (syncStage === 'profile') return 'ซิงค์สุขภาพ & นอน...';
    if (syncing) return 'กำลังซิงค์...';
    return 'Sync All';
  };

  return (
    <>
      <header className="global-top-sync-bar" aria-label="แถบซิงค์ข้อมูลระบบส่วนบน">
        <div className="global-top-sync-inner">
          {/* Left: Brand / Title / Sync Status */}
          <Link href="/dashboard" className="global-top-brand" title="ไปยัง Dashboard">
            <div className="global-top-logo-box">
              <SneakerMove size={18} weight="fill" color="#FFFFFF" />
            </div>
            <div className="global-top-title-group">
              <div className="global-top-app-name">
                <span>RunMorp</span>
                {syncing && <span className="global-top-live-dot" />}
              </div>
              <div className="global-top-subtext">{syncing ? 'กำลังดึงข้อมูลระบบทั้งหมด...' : lastSyncText}</div>
            </div>
          </Link>

          {/* Right: Master "Sync All" Button */}
          <div className="global-top-actions">
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={syncing}
              className={`global-sync-all-btn ${syncing ? 'is-syncing' : ''}`}
              title="กดเพื่อซิงค์ข้อมูลทั้งหมดในระบบ (การวิ่ง + สุขภาพ + การนอน + สถิติ)"
              aria-label="ซิงค์ข้อมูลระบบทั้งหมดจาก Garmin"
            >
              <ArrowsClockwise
                size={17}
                weight="bold"
                className={syncing ? 'global-spin' : ''}
              />
              <span className="global-sync-btn-text">{getSyncButtonLabel()}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Global Toast Notification */}
      {toast && (
        <div className={`global-sync-toast-overlay toast-${toast.type}`} role="alert">
          <div className="global-sync-toast-icon">
            {toast.type === 'success' ? (
              <CheckCircle size={22} weight="fill" color="#059669" />
            ) : (
              <Warning size={22} weight="fill" color="#EF4444" />
            )}
          </div>
          <div className="global-sync-toast-content">
            <div className="global-sync-toast-title">{toast.message}</div>
            {toast.submessage && (
              <div className="global-sync-toast-sub">{toast.submessage}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="global-sync-toast-close"
            aria-label="ปิดการแจ้งเตือน"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      )}
    </>
  );
}
