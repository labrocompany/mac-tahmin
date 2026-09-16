'use client';

import ChatBox from '@/components/ChatBox';

export default function Home() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-elevated">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center md:py-20">
          <div className="text-sm font-semibold text-accent">Hijri Takvim Sistemi</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink md:text-6xl">
            Maç Sohbet Asistanı
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-inksecondary">
            Canlı API-Football verisiyle çalışan futbol sohbet asistanı
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <ChatBox />
      </div>
    </div>
  );
}
