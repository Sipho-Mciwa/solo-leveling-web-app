import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'Solo Leveling',
  description: 'Gamified habit & fitness tracker',
};

// No maximumScale/userScalable lock — inputs already use 16px font-size to
// avoid iOS's auto-zoom-on-focus, so pinch-zoom can stay enabled for
// low-vision users without reintroducing that issue.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
