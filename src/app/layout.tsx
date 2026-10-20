import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Semi_Condensed, Big_Shoulders_Display } from 'next/font/google';
import './globals.css';

const display = Big_Shoulders_Display({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-display',
});
const body = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});
const label = Barlow_Semi_Condensed({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-label',
});

export const metadata: Metadata = {
  title: {
    default: 'Athena',
    template: '%s · Athena',
  },
  description: 'Personal supplements and gym tracker',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Athena',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#edf0f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1317' },
  ],
};

const themeScript = `
try {
  var t = localStorage.getItem('athena-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${display.variable} ${body.variable} ${label.variable}`}>{children}</body>
    </html>
  );
}
