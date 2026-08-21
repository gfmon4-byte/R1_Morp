'use client';

import { useState, useEffect } from 'react';
import { X } from '@phosphor-icons/react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed before
    const dismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after short delay
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div
      role="banner"
      aria-label="ติดตั้งแอป RunMorp"
      style={{
        position: 'fixed',
        bottom: 'calc(68px + env(safe-area-inset-bottom, 0px) + 12px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '400px',
        zIndex: 200,
        background: 'linear-gradient(135deg, rgba(255,143,163,0.95), rgba(201,167,235,0.95))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '20px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 8px 32px rgba(255,143,163,0.40)',
        border: '1.5px solid rgba(255,255,255,0.4)',
        animation: 'slideUpInstall 0.4s cubic-bezier(0.32,0.72,0,1) both',
      }}
    >
      <style>{`
        @keyframes slideUpInstall {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Icon */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          flexShrink: 0,
        }}
      >
        🏃‍♀️
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: '0.875rem',
            color: '#FFFFFF',
            marginBottom: '2px',
          }}
        >
          ติดตั้ง RunMorp
        </div>
        <div
          style={{
            fontFamily: "'Mali', sans-serif",
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.3,
          }}
        >
          เพิ่มลงหน้าจอหลักของคุณ 🌸
        </div>
      </div>

      {/* Install button */}
      <button
        onClick={handleInstall}
        style={{
          background: 'rgba(255,255,255,0.95)',
          color: '#FF8FA3',
          border: 'none',
          borderRadius: '999px',
          padding: '8px 16px',
          fontFamily: "'Baloo 2', sans-serif",
          fontWeight: 700,
          fontSize: '0.8125rem',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      >
        ติดตั้ง
      </button>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="ปิด"
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: '50%',
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
        }}
      >
        <X size={14} color="#FFFFFF" weight="bold" />
      </button>
    </div>
  );
}
