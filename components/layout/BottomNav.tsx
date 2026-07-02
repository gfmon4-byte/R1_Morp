'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChartBar,
  ClockCounterClockwise,
  CalendarBlank,
  User,
} from '@phosphor-icons/react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: ChartBar },
  { href: '/history',   label: 'History',   Icon: ClockCounterClockwise },
  { href: '/plan',      label: 'Plan',       Icon: CalendarBlank },
  { href: '/profile',   label: 'Profile',    Icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(10,14,26,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: 'calc(68px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        alignItems: 'flex-start',
        paddingTop: '2px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          width: '100%',
          maxWidth: '640px',
          margin: '0 auto',
          height: '68px',
          alignItems: 'center',
        }}
      >
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                height: '100%',
                textDecoration: 'none',
                transition: 'opacity 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  background: isActive ? 'rgba(234,88,12,0.15)' : 'transparent',
                  transition: 'background 0.2s',
                }}
              >
                <Icon
                  size={24}
                  weight={isActive ? 'fill' : 'regular'}
                  color={isActive ? '#EA580C' : '#64748B'}
                />
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'Barlow, sans-serif',
                  fontWeight: 500,
                  color: isActive ? '#EA580C' : '#64748B',
                  letterSpacing: '0.02em',
                  transition: 'color 0.2s',
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
