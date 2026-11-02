import type { Metadata } from 'next';
import Script from 'next/script';
import { Baloo_2, Mali } from 'next/font/google';
import './globals.css';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { GlobalTopSyncBar } from '@/components/layout/GlobalTopSyncBar';

const baloo2 = Baloo_2({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-baloo2',
  display: 'swap',
});

const mali = Mali({
  subsets: ['latin', 'thai'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-mali',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RunMorp — Happy Running',
  description: 'แอปติดตามการวิ่งสุดน่ารัก บันทึกรัน จัดการแผนซ้อม และดูสถิติการวิ่งของคุณ',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192-dark.png',
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RunMorp',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'RunMorp — Happy Running',
    description: 'แอปติดตามการวิ่งสุดน่ารัก',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FF8FA3' },
    { media: '(prefers-color-scheme: dark)',  color: '#0F0F1A' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" data-theme="dark" suppressHydrationWarning className={`${baloo2.variable} ${mali.variable}`}>
      <head>
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('runmorp-theme');var t=(s==='dark'||s==='light')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        {/* PWA meta tags */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RunMorp" />
        <meta name="application-name" content="RunMorp" />
        {/* Service Worker registration */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.warn('SW registration failed:', err);
                  });
                });
              } else if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  for (var i = 0; i < regs.length; i++) {
                    regs[i].unregister();
                  }
                });
                if ('caches' in window) {
                  caches.keys().then(function(names) {
                    for (var i = 0; i < names.length; i++) {
                      caches.delete(names[i]);
                    }
                  });
                }
              }
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {/* Desktop Sidebar — hidden on mobile via CSS */}
          <div className="sidebar-wrapper">
            <Sidebar />
          </div>

          {/* Main content area */}
          <div className="app-shell">
            <GlobalTopSyncBar />
            <div className="page-container">
              {children}
            </div>
          </div>

          {/* Mobile Bottom Nav — hidden on desktop via CSS */}
          <div className="bottom-nav-wrapper">
            <BottomNav />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
