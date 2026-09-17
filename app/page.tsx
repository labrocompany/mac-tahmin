'use client';

import Workspace from '@/components/Workspace';

export default function Home() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-elevated">
        <div className="mx-auto max-w-5xl px-6 py-12 text-center md:py-16">
          <div className="text-sm font-semibold text-accent">Hijri Takvim Sistemi</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink md:text-6xl">
            Maç Sohbet Asistanı
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-inksecondary">
            Tablo sistemi ve yapay zeka ayrı sekmelerde çalışır
          </p>
        </div>
      </header>
      <Workspace />
    </div>
  );
}
