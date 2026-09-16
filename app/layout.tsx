import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hijri Takvim Maç Tahmin Sistemi',
  description: 'Tarihsel verilere dayalı Hijri takvim maç tahmin sistemi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-surface font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
