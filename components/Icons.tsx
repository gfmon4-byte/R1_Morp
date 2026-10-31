import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  color?: string;
  fill?: string;
  style?: React.CSSProperties;
}

// 1. Sync / Refresh
export const IconSync: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
  </svg>
);

// 2. Runner / Run
export const IconRunner: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.8-1.6 8.1-4.9-.9-.4 2 6.5 1.2z" />
  </svg>
);

// 3. Lightning / Bolt / Pace / Fast
export const IconBolt: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

// 4. Pin / Distance / Location
export const IconLocation: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// 5. Fire / Flame / Calories
export const IconFire: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M12 2c-.6 2.4-2.8 4.7-2.8 7.3 0 1.9 1 3.5 2.8 4.7 1.8-1.2 2.8-2.8 2.8-4.7 0-2.6-2.2-4.9-2.8-7.3zm4.5 7.5c-.3 0-.6.1-.8.2 1.3 1.8 1.3 4.3 0 6.1-1.3 1.8-3.7 2.7-5.7 2.2 1.2-.8 2-2 2-3.5 0-1.8-1.2-3.3-2.8-4-1.3 2.1-1.3 4.8 0 6.9 1.8 2.8 5.4 3.9 8.5 2.6 3.1-1.3 4.8-4.7 3.9-8-.6-1.5-2.2-2.5-3.8-2.5h-1.3z" />
  </svg>
);

// 6. Heart / HR
export const IconHeart: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', fill = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

// 7. Target / Bullseye
export const IconTarget: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

// 8. Chart / Analytics / Bar
export const IconBarChart: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

// 9. Flag / Finish / Race
export const IconFlag: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

// 10. Shoe / Sneaker
export const IconShoe: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M3 17h18l-1-4-5-2-2-5-4 1-1 4-4 1z" />
    <path d="M3 17v2a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-2" />
    <path d="M10 7l2 4" />
    <path d="M13 9l2 3" />
  </svg>
);

// 11. Footsteps / Steps
export const IconFootsteps: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
  </svg>
);

// 12. Battery / Body Battery
export const IconBattery: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <rect x="2" y="7" width="16" height="10" rx="2" ry="2" />
    <line x1="22" y1="11" x2="22" y2="13" />
    <line x1="6" y1="11" x2="6" y2="13" />
    <line x1="10" y1="11" x2="10" y2="13" />
    <line x1="14" y1="11" x2="14" y2="13" />
  </svg>
);

// 13. Moon / Sleep
export const IconMoon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// 14. Scale / Balance
export const IconScale: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="M7 21h10" />
    <path d="M12 3v18" />
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </svg>
);

// 15. Lightbulb / Tip / Feedback
export const IconBulb: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M9 18h6M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
  </svg>
);

// 16. Smartwatch / Device
export const IconWatch: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <circle cx="12" cy="12" r="7" />
    <polyline points="12 9 12 12 13.5 13.5" />
    <path d="M16.51 17.35l-.85 3.65h-7.32l-.85-3.65" />
    <path d="M16.51 6.65l-.85-3.65h-7.32l-.85 3.65" />
  </svg>
);

// 17. Check / Success
export const IconCheck: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// 18. Cross / Close / X
export const IconClose: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// 19. Calendar
export const IconCalendar: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

// 20. Thermometer
export const IconThermometer: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

// 21. Droplet / Humidity
export const IconDroplet: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

// 22. Wind
export const IconWind: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
  </svg>
);

// 23. Cloud
export const IconCloud: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </svg>
);

// 24. Ruler
export const IconRuler: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4Z" />
    <path d="m14.5 3.5 2 2" /><path d="m11.5 6.5 3 3" /><path d="m8.5 9.5 2 2" /><path d="m5.5 12.5 3 3" />
  </svg>
);

// 25. Mountain
export const IconMountain: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
  </svg>
);

// 26. Desktop
export const IconDesktop: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="2" x2="22" y1="20" y2="20" />
  </svg>
);

// 27. FileText
export const IconFileText: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

// 28. Save
export const IconSave: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

// 29. Copy
export const IconCopy: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', style = {}, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);
