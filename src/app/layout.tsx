import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CrowdDJ - Collaborative Real-Time Jukebox',
  description: 'The real-time collaborative party jukebox. Scan the QR code, request songs, upvote favorites, and auto-skip bad tracks.',
  keywords: ['party jukebox', 'crowd dj', 'spotify collaborative queue', 'real-time music voting'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
