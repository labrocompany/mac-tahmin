'use client';

import { useEffect, useState } from 'react';
import {
  LiveFixture,
  addDaysIso,
  fetchFixtureRange,
  splitBoardFixtures,
  todayInIstanbul,
} from '@/lib/liveFixtures';
import { formatTrDate } from '@/lib/prayerTimes';

function isLive(fx: LiveFixture): boolean {
  return /^(1H|2H|HT|ET|BT|P|LIVE|INT|SUSP)$/i.test(fx.statusShort || '') || /live|devam/i.test(fx.status);
}

function MatchRow({
  fx,
  onPick,
}: {
  fx: LiveFixture;
  onPick?: (fx: LiveFixture) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick?.(fx)}
      className="w-full rounded-2xl border border-hairline bg-elevated/70 px-3 py-3 text-left transition hover:border-accent hover:bg-accentsoft"
    >
      <div className="flex items-center justify-between gap-2 text-[11px] text-inktertiary">
        <span>
          {fx.weekday} · {formatTrDate(fx.date)} · {fx.time}
        </span>
        {isLive(fx) && <span className="font-medium text-accent">Canlı</span>}
      </div>
      <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-medium text-ink">
        <span className="truncate">{fx.home}</span>
        <span className="tabular-nums text-inksecondary">{fx.score}</span>
        <span className="truncate text-right">{fx.away}</span>
      </div>
      <div className="mt-1 truncate text-[11px] text-inktertiary">{fx.league}</div>
    </button>
  );
}

function Section({
  title,
  rows,
  onPick,
}: {
  title: string;
  rows: LiveFixture[];
  onPick?: (fx: LiveFixture) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-inksecondary">{title}</h3>
        <span className="text-[11px] text-inktertiary">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-hairline px-3 py-4 text-xs text-inktertiary">Maç yok</p>
      ) : (
        <div className="space-y-2">
          {rows.map((fx) => (
            <MatchRow key={`${fx.date}|${fx.time}|${fx.home}|${fx.away}`} fx={fx} onPick={onPick} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MatchWeekBoard({ onPick }: { onPick?: (fx: LiveFixture) => void }) {
  const [today, setToday] = useState<LiveFixture[]>([]);
  const [upcoming, setUpcoming] = useState<LiveFixture[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true);
      const day = todayInIstanbul();
      try {
        const rows = await fetchFixtureRange(day, addDaysIso(day, 7));
        if (cancelled) return;
        const split = splitBoardFixtures(rows, day);
        setToday(split.today);
        setUpcoming(split.upcoming);
      } catch {
        if (!cancelled) {
          setToday([]);
          setUpcoming([]);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="flex h-[36rem] w-full flex-col overflow-hidden rounded-3xl border border-hairline bg-surface/80 shadow-sm backdrop-blur-xl lg:h-[calc(100vh-8rem)]">
      <div className="border-b border-hairline px-5 py-4">
        <h2 className="text-sm font-semibold text-ink">Haftalık Maçlar</h2>
        <p className="mt-0.5 text-xs text-inksecondary">Süper Lig ve 1. Lig · bugün ve 1 hafta sonra</p>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
        {busy ? (
          <p className="text-sm text-inktertiary">Maçlar yükleniyor...</p>
        ) : (
          <>
            <Section title="Bugün" rows={today} onPick={onPick} />
            <Section title="Yaklaşan maçlar" rows={upcoming} onPick={onPick} />
          </>
        )}
      </div>
    </aside>
  );
}
