import type { Metadata, Viewport } from 'next';
import { DM_Sans, Syne } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const DESCRIPTION =
  'Run any tournament. Brackets, schedules, live results — single & double elimination, round robin, Swiss, groups + knockout, leaderboards and racing formats.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Bracket — Tournament brackets, schedules & live results',
    template: '%s · Bracket',
  },
  description: DESCRIPTION,
  applicationName: 'Bracket',
  keywords: [
    'tournament bracket generator',
    'bracket maker',
    'single elimination',
    'double elimination',
    'round robin',
    'swiss tournament',
    'live standings',
    'esports tournament',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Bracket',
    title: 'Bracket — Tournament brackets, schedules & live results',
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bracket — Tournament brackets, schedules & live results',
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#222831' },
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
  ],
  colorScheme: 'dark light',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
