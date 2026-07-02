'use client';

import { Moon, Sun } from '@phosphor-icons/react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      id="theme-toggle-btn"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: theme === 'dark'
          ? 'rgba(255,20,147,0.18)'
          : 'rgba(255,143,163,0.12)',
        border: theme === 'dark'
          ? '1.5px solid rgba(255,20,147,0.45)'
          : '1.5px solid rgba(255,143,163,0.35)',
        borderRadius: '999px',
        padding: '6px 14px 6px 10px',
        cursor: 'pointer',
        transition: 'all 250ms cubic-bezier(0.4,0,0.2,1)',
        minHeight: '36px',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Track */}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: theme === 'dark' ? 'flex-end' : 'flex-start',
          width: 40,
          height: 22,
          borderRadius: 999,
          background: theme === 'dark'
            ? 'linear-gradient(135deg, #FF1493, #C2185B)'
            : 'linear-gradient(135deg, #FFB4C6, #FF8FA3)',
          padding: '2px',
          transition: 'background 300ms ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            transition: 'transform 300ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {theme === 'dark'
            ? <Moon size={10} weight="fill" color="#C2185B" />
            : <Sun size={10} weight="fill" color="#FF8FA3" />}
        </span>
      </span>

      <span
        style={{
          fontFamily: "'Baloo 2', sans-serif",
          fontWeight: 700,
          fontSize: '0.75rem',
          color: theme === 'dark' ? '#FF6EB4' : '#FF8FA3',
          letterSpacing: '0.03em',
          transition: 'color 250ms ease',
          userSelect: 'none',
        }}
      >
        {theme === 'dark' ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}
