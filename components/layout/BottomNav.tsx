'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChartBar,
  ClockCounterClockwise,
  CalendarBlank,
  User,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from './ThemeProvider';

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard', Icon: ChartBar },
  { href: '/history',      label: 'History',   Icon: ClockCounterClockwise },
  { href: '/plan',         label: 'Plan',       Icon: CalendarBlank },
  { href: '/profile',      label: 'Profile',    Icon: User },
  { href: '/garmin-login', label: 'Garmin',     Icon: ArrowsClockwise },
];

export function BottomNav() {
  const pathname = usePathname();
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  const activeColor  = isDark ? '#FF2D78' : '#FF8FA3';
  const inactiveColor = isDark ? '#9A5878' : '#C9A7EB';
  const activeBg     = isDark ? 'rgba(255,45,120,0.18)' : 'rgba(255,143,163,0.15)';
  const navBg        = isDark ? 'rgba(15,7,17,0.92)' : 'rgba(255,248,244,0.92)';
  const navBorder    = isDark ? 'rgba(255,45,120,0.28)' : 'rgba(255,143,163,0.25)';
  const navShadow    = isDark
    ? '0 -4px 20px rgba(255,45,120,0.15)'
    : '0 -4px 20px rgba(255,143,163,0.12)';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateHeight = () => {
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--visual-viewport-height', `${height}px`);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateHeight);
      window.visualViewport.addEventListener('scroll', updateHeight);
    } else {
      window.addEventListener('resize', updateHeight);
    }

    updateHeight();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateHeight);
        window.visualViewport.removeEventListener('scroll', updateHeight);
      } else {
        window.removeEventListener('resize', updateHeight);
      }
    };
  }, []);

  // Reset scroll to top of window on page navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: navBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: `1px solid ${navBorder}`,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: 'calc(68px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        alignItems: 'flex-start',
        paddingTop: '2px',
        boxShadow: navShadow,
        transition: 'background 300ms ease, border-color 300ms ease, box-shadow 300ms ease',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr) auto',
          width: '100%',
          maxWidth: '640px',
          margin: '0 auto',
          height: '68px',
          alignItems: 'center',
          paddingRight: '12px',
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
                  borderRadius: 999,
                  background: isActive ? activeBg : 'transparent',
                  transition: 'background 0.2s',
                }}
              >
                <Icon
                  size={24}
                  weight={isActive ? 'fill' : 'regular'}
                  color={isActive ? activeColor : inactiveColor}
                />
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: "'Baloo 2', sans-serif",
                  fontWeight: 600,
                  color: isActive ? activeColor : inactiveColor,
                  letterSpacing: '0.02em',
                  transition: 'color 0.2s',
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}

        {/* Theme toggle sits in the rightmost column */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
