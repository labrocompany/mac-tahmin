import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hijri Takvim Maç Tahmin Sistemi',
  description: 'Tarihsel verilere dayalı Hijri takvim maç tahmin sistemi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-app-gradient min-h-screen font-sans text-slate-800">{children}</body>
    </html>
  );
}
