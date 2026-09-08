import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Fim Colectivo — Transporte Colectivo en Tiempo Real',
  description: 'Rastrea tu línea de colectivo en tiempo real, revisa asientos libres y viaja de forma cómoda y económica en Chile.',
  keywords: ['colectivo', 'transporte colectivo', 'lineas de colectivos', 'Chile', 'Santiago', 'Fim Colectivo'],
  authors: [{ name: 'Fim Colectivo' }],
  manifest: '/manifest.json',
  icons: { icon: '/icon.png', apple: '/apple-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#00E5A0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
