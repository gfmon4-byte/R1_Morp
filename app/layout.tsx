import type { Metadata } from 'next';
import { Baloo_2, Mali } from 'next/font/google';
import './globals.css';
import { BottomNav } from '@/components/layout/BottomNav';

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
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${baloo2.variable} ${mali.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <div className="page-container">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
