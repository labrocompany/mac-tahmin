'use client';

import { useState } from 'react';
import ChatBox from './ChatBox';
import MatchTablePanel, { TablePayload, WeekPick } from './MatchTablePanel';
import MatchWeekBoard from './MatchWeekBoard';
import { LiveFixture } from '@/lib/liveFixtures';

type TabId = 'table' | 'ai';

export default function Workspace() {
  const [tab, setTab] = useState<TabId>('table');
  const [incoming, setIncoming] = useState<TablePayload | null>(null);
  const [picked, setPicked] = useState<{ home: string; away: string; id: number } | null>(null);
  const [weekPick, setWeekPick] = useState<WeekPick | null>(null);

  function openTable(payload: TablePayload) {
    setIncoming(payload);
    setTab('table');
  }

  function pickMatch(fx: LiveFixture) {
    setWeekPick({ home: fx.home, away: fx.away, date: fx.date, id: Date.now() });
    setTab('table');
  }

  return (
    <div className="mx-auto max-w-[88rem] px-6 py-6">
      <div className="mb-6 flex justify-center">
        <div className="inline-flex rounded-full bg-elevated p-1">
          <button
            type="button"
            onClick={() => setTab('table')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tab === 'table' ? 'bg-surface text-ink shadow-sm' : 'text-inksecondary hover:text-ink'
            }`}
          >
            Tablo Sistemi
          </button>
          <button
            type="button"
            onClick={() => setTab('ai')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tab === 'ai' ? 'bg-surface text-ink shadow-sm' : 'text-inksecondary hover:text-ink'
            }`}
          >
            Yapay Zeka
          </button>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] lg:items-start">
        <div>
          <div className={tab === 'table' ? '' : 'hidden'}>
            <MatchTablePanel incoming={incoming} weekPick={weekPick} />
          </div>
          <div className={tab === 'ai' ? '' : 'hidden'}>
            <ChatBox onOpenTable={openTable} pickedMatch={picked} />
          </div>
        </div>
        <MatchWeekBoard onPick={pickMatch} />
      </div>
    </div>
  );
}
