'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChartBar,
  ClockCounterClockwise,
  CalendarBlank,
  User,
  SneakerMove,
} from '@phosphor-icons/react';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from './ThemeProvider';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: ChartBar },
  { href: '/history',   label: 'History',   Icon: ClockCounterClockwise },
  { href: '/plan',      label: 'Plan',       Icon: CalendarBlank },
  { href: '/profile',   label: 'Profile',    Icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  const activeColor   = isDark ? '#FF2D78' : '#FF8FA3';
  const inactiveColor = isDark ? '#9A5878' : '#B09CB8';
  const activeBg      = isDark ? 'rgba(255,45,120,0.18)' : 'rgba(255,143,163,0.12)';
  const sidebarBg     = isDark ? '#1A0C16' : '#FFFFFF';
  const borderColor   = isDark ? 'rgba(255,45,120,0.20)' : 'rgba(255,143,163,0.20)';
  const logoBg        = isDark
    ? 'linear-gradient(135deg, #FF2D78, #E040B0)'
    : 'linear-gradient(135deg, #FF8FA3, #C9A7EB)';

  return (
    <aside
      aria-label="Sidebar navigation"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '240px',
        zIndex: 100,
        background: sidebarBg,
        borderRight: `1px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        gap: '8px',
        boxShadow: isDark
          ? '4px 0 24px rgba(255,45,120,0.08)'
          : '4px 0 24px rgba(255,143,163,0.08)',
        transition: 'background 300ms ease, border-color 300ms ease',
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '4px 8px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            background: logoBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isDark
              ? '0 4px 12px rgba(255,45,120,0.35)'
              : '0 4px 12px rgba(255,143,163,0.35)',
            flexShrink: 0,
          }}
        >
          <SneakerMove size={22} weight="fill" color="#FFFFFF" />
        </div>
        <div>
          <div
            style={{
              fontFamily: "'Baloo 2', sans-serif",
              fontWeight: 800,
              fontSize: '1rem',
              background: logoBg,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.1,
            }}
          >
            RunMorp
          </div>
          <div
            style={{
              fontFamily: "'Mali', sans-serif",
              fontSize: '0.65rem',
              color: inactiveColor,
              lineHeight: 1,
            }}
          >
            Happy Running 🌸
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '14px',
                background: isActive ? activeBg : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.2s, transform 0.15s',
                WebkitTapHighlightColor: 'transparent',
                border: isActive
                  ? `1.5px solid ${isDark ? 'rgba(255,45,120,0.3)' : 'rgba(255,143,163,0.25)'}`
                  : '1.5px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = isDark
                    ? 'rgba(255,45,120,0.08)'
                    : 'rgba(255,143,163,0.07)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              <Icon
                size={20}
                weight={isActive ? 'fill' : 'regular'}
                color={isActive ? activeColor : inactiveColor}
              />
              <span
                style={{
                  fontFamily: "'Baloo 2', sans-serif",
                  fontWeight: isActive ? 700 : 600,
                  fontSize: '0.9rem',
                  color: isActive ? activeColor : inactiveColor,
                  transition: 'color 0.2s',
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Theme toggle */}
      <div
        style={{
          paddingTop: '16px',
          borderTop: `1px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 14px 0',
        }}
      >
        <span
          style={{
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 600,
            fontSize: '0.8rem',
            color: inactiveColor,
          }}
        >
          {isDark ? '🌙 Dark' : '☀️ Light'}
        </span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
