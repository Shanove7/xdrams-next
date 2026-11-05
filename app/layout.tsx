import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://x-drams.vercel.app'),
  title: { default: 'X-DRAMS — Stories worth staying for', template: '%s | X-DRAMS' },
  description: 'Discover short dramas, explore stories, and watch episodes available from the source with X-DRAMS.',
  applicationName: 'X-DRAMS',
  creator: 'Khasan',
  openGraph: { title: 'X-DRAMS', description: 'Discover your next short-drama story.', type: 'website', siteName: 'X-DRAMS' },
  twitter: { card: 'summary_large_image', title: 'X-DRAMS', description: 'Discover your next short-drama story.' },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#071321', colorScheme: 'dark' };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
