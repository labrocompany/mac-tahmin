'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  buildMatchTable,
  countMatchResults,
  extractHeadToHead,
  fetchHeadToHeadForTeams,
  fetchRecentMatchesForTeam,
  filterMatchesByHijriMonth,
  hasFootballKey,
  MatchTable,
  RecentMatch,
} from '@/lib/apiFootball';
import { assetUrl } from '@/lib/config';
import { HIJRI_MONTHS, isoToHijri } from '@/lib/hijri';
import { attachJumuaTimes } from '@/lib/prayerTimes';
import { resolveTeamToken } from '@/lib/predictionEngine';
import MatchTableView from './MatchTableView';

export type DateMode = 'gregorian' | 'hijri' | 'both';

export interface TableCounts {
  total: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface TablePayload {
  title: string;
  table: MatchTable;
  summary?: string;
  counts?: TableCounts;
}

export interface WeekPick {
  home: string;
  away: string;
  date: string;
  id: number;
}

function uniqueRecentMatches(rows: RecentMatch[]): RecentMatch[] {
  const seen = new Set<string>();
  const out: RecentMatch[] = [];
  for (const row of rows) {
    const key = `${row.gregorianDate}|${row.home}|${row.away}|${row.score}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  out.sort((a, b) => b.gregorianDate.localeCompare(a.gregorianDate));
  return out;
}

function toBlock(name: string, rows: RecentMatch[], scope: string | null, mode: DateMode): TablePayload | null {
  if (rows.length === 0) return null;
  const counts = countMatchResults(rows);
  return {
    title: name,
    summary: `${scope || 'kayıtlarda'} ${counts.total} maç`,
    counts,
    table: buildMatchTable(rows.slice(0, 80), mode),
  };
}

function ResultLine({ scope, counts }: { scope?: string; counts: TableCounts }) {
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-inksecondary">
      {scope && <span>{scope}</span>}
      <span className="font-medium text-win">{counts.wins} Galibiyet</span>
      <span className="font-medium text-draw">{counts.draws} Beraberlik</span>
      <span className="font-medium text-loss">{counts.losses} Mağlubiyet</span>
    </p>
  );
}

export default function MatchTablePanel({
  incoming,
  weekPick,
}: {
  incoming?: TablePayload | null;
  weekPick?: WeekPick | null;
}) {
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [dateMode, setDateMode] = useState<DateMode>('hijri');
  const [month, setMonth] = useState(0);
  const [day, setDay] = useState(0);
  const [busy, setBusy] = useState(false);
  const [blocks, setBlocks] = useState<TablePayload[]>([]);
  const [error, setError] = useState('');
  const [teams, setTeams] = useState<string[]>([]);
  const loadIdRef = useRef(0);

  useEffect(() => {
    fetch(assetUrl('/data/teams.json'))
      .then((res) => (res.ok ? res.json() : []))
      .then((names: string[]) => setTeams(names))
      .catch(() => setTeams([]));
  }, []);

  useEffect(() => {
    if (!incoming?.table) return;
    setBlocks([incoming]);
    setError('');
  }, [incoming]);

  useEffect(() => {
    if (!weekPick) return;
    const hijri = isoToHijri(weekPick.date);
    const nextDay = hijri?.day ?? 0;
    setTeam1(weekPick.home);
    setTeam2(weekPick.away);
    setDateMode('hijri');
    setMonth(0);
    setDay(nextDay);
    void loadTableFor(weekPick.home, weekPick.away, 'hijri', 0, nextDay, true);
  }, [weekPick?.id]);

  function resolveName(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return resolveTeamToken(trimmed, teams) || trimmed;
  }

  function filterLabel(monthVal: number, dayVal: number): string | null {
    if (monthVal === 0 && dayVal === 0) return null;
    const monthName = monthVal > 0 ? HIJRI_MONTHS[monthVal - 1] : 'her ay';
    if (dayVal > 0 && monthVal > 0) return `${dayVal} ${monthName}`;
    if (dayVal > 0) return `her ayın ${dayVal}'i`;
    return monthName;
  }

  async function matchesForTeam(name: string, monthVal: number, dayVal: number): Promise<RecentMatch[]> {
    let rows = uniqueRecentMatches(await fetchRecentMatchesForTeam(name, 2000));
    if (monthVal > 0 || dayVal > 0) {
      rows = filterMatchesByHijriMonth(rows, monthVal > 0 ? monthVal : null, null, dayVal > 0 ? dayVal : null);
    }
    await attachJumuaTimes(rows);
    return rows;
  }

  async function loadTableFor(
    team1Raw: string,
    team2Raw: string,
    mode: DateMode,
    monthVal: number,
    dayVal: number,
    perTeamDay: boolean,
  ) {
    const t1 = resolveName(team1Raw);
    const t2 = resolveName(team2Raw);
    if (!t1) {
      setError('En az bir takım adı gir.');
      return;
    }
    if (!hasFootballKey()) {
      setError('API anahtarı bulunamadı.');
      return;
    }
    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    setBusy(true);
    setError('');
    try {
      const scope = filterLabel(monthVal, dayVal);
      const next: TablePayload[] = [];
      if (perTeamDay && t2) {
        const [first, second] = await Promise.all([
          matchesForTeam(t1, monthVal, dayVal),
          matchesForTeam(t2, monthVal, dayVal),
        ]);
        const b1 = toBlock(t1, first, scope, mode);
        const b2 = toBlock(t2, second, scope, mode);
        if (b1) next.push(b1);
        if (b2) next.push(b2);
      } else if (t1 && t2) {
        const [h2h, recent] = await Promise.all([
          fetchHeadToHeadForTeams(t1, t2, 200),
          fetchRecentMatchesForTeam(t1, 2000),
        ]);
        let rows = uniqueRecentMatches([...h2h, ...extractHeadToHead(recent, t1, t2)]);
        if (monthVal > 0 || dayVal > 0) {
          rows = filterMatchesByHijriMonth(rows, monthVal > 0 ? monthVal : null, null, dayVal > 0 ? dayVal : null);
        }
        await attachJumuaTimes(rows);
        const block = toBlock(`${t1} - ${t2}`, rows, scope, mode);
        if (block) next.push(block);
      } else {
        const rows = await matchesForTeam(t1, monthVal, dayVal);
        const block = toBlock(t1, rows, scope, mode);
        if (block) next.push(block);
      }
      if (loadId !== loadIdRef.current) return;
      setBlocks(next);
      if (next.length === 0) setError('Bu seçime göre maç bulunamadı.');
    } catch {
      if (loadId === loadIdRef.current) setError('Tablo yüklenemedi, tekrar dene.');
    } finally {
      if (loadId === loadIdRef.current) setBusy(false);
    }
  }

  async function loadTable(event?: FormEvent) {
    event?.preventDefault();
    const perTeamDay = Boolean(team1.trim() && team2.trim() && day > 0);
    await loadTableFor(team1, team2, dateMode, month, day, perTeamDay);
  }

  return (
    <section className="flex h-[36rem] w-full flex-col overflow-hidden rounded-3xl border border-hairline bg-surface/80 shadow-sm backdrop-blur-xl lg:h-[calc(100vh-18rem)]">
      <div className="border-b border-hairline px-5 py-4">
        <h2 className="text-sm font-semibold text-ink">Tablo Sistemi</h2>
        <p className="mt-0.5 text-xs text-inksecondary">Maçları buraya gir, tablo yalnızca bu sekmede açılır</p>
      </div>
      <form onSubmit={loadTable} className="border-b border-hairline px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-2xl bg-elevated px-4 py-3 text-sm text-ink outline-none transition focus:ring-4 focus:ring-accentsoft"
            placeholder="Takım 1"
            value={team1}
            onChange={(e) => setTeam1(e.target.value)}
            list="table-teams"
          />
          <input
            className="rounded-2xl bg-elevated px-4 py-3 text-sm text-ink outline-none transition focus:ring-4 focus:ring-accentsoft"
            placeholder="Takım 2 (isteğe bağlı)"
            value={team2}
            onChange={(e) => setTeam2(e.target.value)}
            list="table-teams"
          />
        </div>
        <datalist id="table-teams">
          {teams.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ['hijri', 'Hicri'],
              ['gregorian', 'Miladi'],
              ['both', 'İkisi'],
            ] as Array<[DateMode, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDateMode(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                dateMode === id
                  ? 'bg-accent text-white'
                  : 'border border-hairline bg-surface text-inksecondary hover:border-accent hover:text-accent'
              }`}
            >
              {label}
            </button>
          ))}
          <select
            className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs text-ink outline-none"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            <option value={0}>Tüm aylar</option>
            {HIJRI_MONTHS.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs text-ink outline-none"
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
          >
            <option value={0}>Tüm günler</option>
            {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-full bg-accent py-3 text-sm font-medium text-white transition hover:bg-accenthover disabled:opacity-40"
        >
          {busy ? 'Tablo getiriliyor...' : 'Tabloyu getir'}
        </button>
      </form>
      <div className="flex-1 overflow-auto px-5 py-4">
        {error && <p className="mb-3 text-sm text-inksecondary">{error}</p>}
        {blocks.length > 0 ? (
          <div className="space-y-8">
            {blocks.map((block, idx) => (
              <div key={`${block.title}-${idx}`}>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-ink">{block.title}</h3>
                  {block.counts ? (
                    <ResultLine scope={block.summary} counts={block.counts} />
                  ) : (
                    block.summary && <p className="mt-0.5 text-xs text-inksecondary">{block.summary}</p>
                  )}
                </div>
                <MatchTableView table={block.table} />
              </div>
            ))}
          </div>
        ) : (
          !error && (
            <p className="text-sm text-inktertiary">Takım adlarını yazıp tabloyu getir.</p>
          )
        )}
      </div>
    </section>
  );
}
