import type { Metadata } from 'next';
import { Baloo_2, Mali } from 'next/font/google';
import './globals.css';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { InstallBanner } from '@/components/layout/InstallBanner';
import { ThemeProvider } from '@/components/layout/ThemeProvider';

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
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
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
    { media: '(prefers-color-scheme: dark)',  color: '#FF2D78' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${baloo2.variable} ${mali.variable}`}>
      <head>
        {/* PWA meta tags */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.jpg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RunMorp" />
        <meta name="application-name" content="RunMorp" />
        {/* Service Worker registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.warn('SW registration failed:', err);
                  });
                });
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
            <div className="page-container">
              {children}
            </div>
          </div>

          {/* Mobile Bottom Nav — hidden on desktop via CSS */}
          <div className="bottom-nav-wrapper">
            <BottomNav />
          </div>

          {/* PWA Install Banner */}
          <InstallBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
