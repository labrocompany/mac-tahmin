'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  buildMatchTable,
  countMatchResults,
  extractHeadToHead,
  fetchHeadToHeadForTeams,
  fetchPredictionForTeams,
  fetchRecentMatchesForTeam,
  filterMatchesByHijriMonth,
  hasFootballKey,
  MatchTable,
  RecentMatch,
  searchTeam,
} from '@/lib/apiFootball';
import { assetUrl } from '@/lib/config';
import { askGemini, ChatMessage, GeminiAction, GeminiContext, GeminiMatchRef, hasGeminiKey } from '@/lib/gemini';
import {
  gregorianToHijri,
  HIJRI_MONTHS,
  hijriDayFromText,
  hijriMonthFromText,
  HijriMonthFilter,
  isCurrentHijriMonthQuery,
  mentionsHijriCalendar,
  resolveHijriMonthFilter,
} from '@/lib/hijri';
import { LiveFixture, LiveFixturesFile, fetchDayFixtures, formatLiveFixtures, pickRelevantFixtures, todayInIstanbul } from '@/lib/liveFixtures';
import { resolveTeamToken } from '@/lib/predictionEngine';
import { attachJumuaTimes } from '@/lib/prayerTimes';
import { TablePayload } from './MatchTablePanel';

function todayHijriLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const [hd, hm, hy] = gregorianToHijri(y, m, d);
  return `${hd} ${HIJRI_MONTHS[hm - 1]} ${hy}`;
}

async function loadLiveRows(hints: string[]): Promise<{ date: string; rows: LiveFixture[] }> {
  const today = todayInIstanbul();
  try {
    const res = await fetch(assetUrl('/data/live-fixtures.json'));
    if (res.ok) {
      const file = (await res.json()) as LiveFixturesFile;
      const rows = pickRelevantFixtures(file.fixtures ?? [], hints);
      if (file.date === today) return { date: today, rows };
      if (rows.length > 0 && !hasFootballKey()) {
        return { date: file.date || today, rows };
      }
    }
  } catch {
  }
  if (hasFootballKey()) {
    try {
      const rows = pickRelevantFixtures(await fetchDayFixtures(), hints);
      return { date: today, rows };
    } catch {
    }
  }
  return { date: today, rows: [] };
}

interface DisplayMessage extends ChatMessage {
  matches?: GeminiMatchRef[];
}

interface ContextData {
  team1Recent: RecentMatch[];
  team2Recent: RecentMatch[];
  headToHead: RecentMatch[];
  prediction: Awaited<ReturnType<typeof fetchPredictionForTeams>>;
}

type DateMode = 'gregorian' | 'hijri' | 'both';

function isTodayQuery(text: string): boolean {
  return /bug[uü]n|bu g[uü]n/i.test(text) && /ma[cç]/i.test(text);
}

function wantsMatchList(text: string): boolean {
  if (/tablo/i.test(text)) return true;
  if (mentionsHijriCalendar(text)) return true;
  if (isCurrentHijriMonthQuery(text) || hijriMonthFromText(text) != null || hijriDayFromText(text) != null) return true;
  if (/(t[uü]m|ge[cç]mi[sş]).{0,24}ma[cç]|ma[cç].{0,24}(liste|yaz)/i.test(text)) return true;
  return false;
}

function foldTr(value: string): string {
  return value
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

type StatsFocus = 'wins' | 'draws' | 'losses' | 'played';

function statsFocusFromText(text: string): StatsFocus | null {
  const t = foldTr(text);
  if (/kazan|galibiyet/.test(t)) return 'wins';
  if (/kaybet|maglub|yenil/.test(t)) return 'losses';
  if (/beraber/.test(t)) return 'draws';
  if (/kac\s*mac|mac\s*say|toplam\s*mac|kacini\s*oyna|kac\s*tane\s*oyna|oran/.test(t)) return 'played';
  return null;
}

function formatRecordReply(
  team: string,
  opponent: string,
  filter: HijriMonthFilter | null,
  counts: { total: number; wins: number; draws: number; losses: number },
): string {
  const who = opponent ? `${team}, ${opponent} karşısında` : team;
  const scope = filter ? `${filter.label} döneminde` : 'elimdeki kayıtlarda';
  if (counts.total === 0) return `${who} ${scope} maç bulunamadı.`;
  const winPct = ((counts.wins / counts.total) * 100).toFixed(1);
  const lossPct = ((counts.losses / counts.total) * 100).toFixed(1);
  const drawPct = ((counts.draws / counts.total) * 100).toFixed(1);
  return `${who} ${scope} ${counts.total} maçta ${counts.wins} Galibiyet ${counts.draws} Beraberlik ${counts.losses} Mağlubiyet. Kazanma oranı %${winPct}, kaybetme oranı %${lossPct}, beraberlik oranı %${drawPct}.`;
}

function looksLikeTeamToken(token: string): boolean {
  const folded = token
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
  if (folded.length < 5) return false;
  if (/(spor|sk|fk|gk)$/i.test(folded)) return true;
  return folded.length >= 8;
}

const STOP_TOKENS = new Set([
  'bugun',
  'bugune',
  'kadar',
  'olan',
  'tum',
  'yazar',
  'misin',
  'maclarini',
  'maclari',
  'tarihleri',
  'seklinde',
  'tablo',
  'hicri',
  'hijri',
  'takvim',
  'olarak',
  'ayinda',
  'ayin',
  'gunu',
  'gunde',
  'gununde',
  'oynadigi',
  'hepsini',
  'analiz',
  'et',
  'var',
  'yok',
  'toplam',
  'kazanmistir',
  'kazandi',
]);

const TEAM_SEARCH_ALIASES: Record<string, string> = {
  adnanspor: 'Adanaspor',
  adanaspor: 'Adanaspor',
  gsnin: 'Galatasaray',
  gs: 'Galatasaray',
  galasaray: 'Galatasaray',
};

async function resolveTeamsFromText(text: string, known: string[]): Promise<string[]> {
  const tokens = text.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3);
  const found: string[] = [];
  for (const token of tokens) {
    const resolved = resolveTeamToken(token, known);
    if (resolved && !found.includes(resolved)) found.push(resolved);
  }
  const aliasHits = [
    ['gs', 'Galatasaray'],
    ['fb', 'Fenerbahce'],
    ['bjk', 'Besiktas'],
  ] as const;
  for (const [alias, name] of aliasHits) {
    if (new RegExp(`\\b${alias}\\b`, 'i').test(text) && !found.includes(name) && known.includes(name)) {
      found.push(name);
    }
  }
  if (found.length >= 2 || !hasFootballKey()) return found.slice(0, 2);
  const extras = tokens.filter((token) => {
    const folded = token
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    return looksLikeTeamToken(token) && !STOP_TOKENS.has(folded);
  });
  const searches = extras.slice(0, 4).map((token) => {
    const stripped = token.replace(/(nın|nin|nun|nün|ın|in|un|ün|lar|ler)$/i, '');
    const folded = stripped
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    const query = TEAM_SEARCH_ALIASES[folded] || stripped;
    return searchTeam(query).catch(() => null);
  });
  const results = await Promise.all(searches);
  for (const row of results) {
    if (row?.name && !found.includes(row.name)) found.push(row.name);
  }
  return found.slice(0, 2);
}

function uniqueMatches(rows: GeminiMatchRef[]): GeminiMatchRef[] {
  const seen = new Set<string>();
  const out: GeminiMatchRef[] = [];
  for (const row of rows) {
    const key = `${row.home}||${row.away}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
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

async function fetchContextData(t1: string, t2: string, mode: 'list' | 'analysis'): Promise<ContextData> {
  const data: ContextData = { team1Recent: [], team2Recent: [], headToHead: [], prediction: null };
  if (!hasFootballKey()) return data;
  const recentLimit = mode === 'list' ? 2000 : 12;
  const recentSeasons = mode === 'list' ? undefined : [2024, 2025, 2026];
  try {
    const jobs: Promise<unknown>[] = [];
    if (t1 && t2) {
      jobs.push(fetchHeadToHeadForTeams(t1, t2, mode === 'list' ? 200 : 50).then((r) => (data.headToHead = r)));
      if (mode === 'list') {
        jobs.push(
          fetchRecentMatchesForTeam(t1, recentLimit, recentSeasons).then((r) => {
            data.team1Recent = r;
            const extra = extractHeadToHead(r, t1, t2);
            data.headToHead = uniqueRecentMatches([...data.headToHead, ...extra]);
          }),
        );
      } else {
        jobs.push(fetchRecentMatchesForTeam(t1, recentLimit, recentSeasons).then((r) => (data.team1Recent = r)));
        jobs.push(fetchRecentMatchesForTeam(t2, recentLimit, recentSeasons).then((r) => (data.team2Recent = r)));
        jobs.push(fetchPredictionForTeams(t1, t2).then((r) => (data.prediction = r)));
      }
    } else {
      if (t1) jobs.push(fetchRecentMatchesForTeam(t1, recentLimit, recentSeasons).then((r) => (data.team1Recent = r)));
      if (t2) jobs.push(fetchRecentMatchesForTeam(t2, recentLimit, recentSeasons).then((r) => (data.team2Recent = r)));
    }
    await Promise.allSettled(jobs);
    if (t1 && t2 && mode === 'list') {
      if (data.team1Recent.length === 0) {
        data.team1Recent = await fetchRecentMatchesForTeam(t1, 2000);
      }
      data.headToHead = uniqueRecentMatches([
        ...data.headToHead,
        ...extractHeadToHead(data.team1Recent, t1, t2),
      ]);
    }
  } catch {
  }
  return data;
}

function pickListedMatches(
  data: ContextData,
  t1: string,
  t2: string,
  filter: HijriMonthFilter | null,
): RecentMatch[] {
  let rows: RecentMatch[] = [];
  if (t1 && t2) {
    rows = data.headToHead.length > 0 ? data.headToHead : extractHeadToHead([...data.team1Recent, ...data.team2Recent], t1, t2);
  } else if (t1) {
    rows = data.team1Recent;
  } else if (t2) {
    rows = data.team2Recent;
  }
  if (filter != null) rows = filterMatchesByHijriMonth(rows, filter.month, filter.year, filter.day);
  return rows;
}

function listedTitle(t1: string, t2: string, filter: HijriMonthFilter | null, dateMode: DateMode): string {
  const monthName = filter?.label ?? '';
  const dateLabel = dateMode === 'gregorian' ? 'miladi' : dateMode === 'hijri' ? 'hicri' : 'miladi+hicri';
  if (t1 && t2) {
    return monthName
      ? `${t1} - ${t2} kafa kafaya / ${monthName} / ${dateLabel}`
      : `${t1} - ${t2} kafa kafaya / ${dateLabel}`;
  }
  if (t1) {
    return monthName ? `${t1} / ${monthName} / ${dateLabel}` : `${t1} son maclar / ${dateLabel}`;
  }
  return monthName ? `${monthName} / ${dateLabel}` : dateLabel;
}

function isTableRowLine(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableSeparatorLine(line: string): boolean {
  return /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(line);
}

function renderMarkdownTables(text: string) {
  const lines = text.split('\n');
  const blocks: Array<{ type: 'text' | 'table'; content: string[] }> = [];
  let current: string[] = [];
  let mode: 'text' | 'table' = 'text';

  for (const line of lines) {
    const rowType: 'text' | 'table' = isTableRowLine(line) ? 'table' : 'text';
    if (rowType !== mode && current.length > 0) {
      blocks.push({ type: mode, content: current });
      current = [];
    }
    mode = rowType;
    current.push(line);
  }
  if (current.length > 0) blocks.push({ type: mode, content: current });

  return blocks.map((block, idx) => {
    if (block.type === 'table') {
      const rows = block.content
        .filter((line) => !isTableSeparatorLine(line))
        .map((line) =>
          line
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim()),
        );
      if (rows.length < 1) return null;
      return (
        <div key={idx} className="whitespace-pre-wrap">
          {block.content.join('\n').trim()}
        </div>
      );
    }
    const joined = block.content.join('\n').trim();
    if (!joined) return null;
    return (
      <div key={idx} className="whitespace-pre-wrap">
        {joined}
      </div>
    );
  });
}

export default function ChatBox({
  onOpenTable,
  pickedMatch,
}: {
  onOpenTable?: (payload: TablePayload) => void;
  pickedMatch?: { home: string; away: string; id: number } | null;
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      role: 'assistant',
      text: 'Maç analizi yazabilirsin. Tablolar için Tablo Sistemi sekmesini kullan.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const teamsRef = useRef<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dateModeRef = useRef<DateMode>('hijri');
  const lastTableRef = useRef<MatchTable | undefined>(undefined);
  const lastListedRef = useRef<RecentMatch[]>([]);
  const monthFilterRef = useRef<HijriMonthFilter | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    fetch(assetUrl('/data/teams.json'))
      .then((res) => (res.ok ? res.json() : []))
      .then((names: string[]) => {
        teamsRef.current = names;
      })
      .catch(() => {
        teamsRef.current = [];
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    if (!pickedMatch) return;
    void runAnalysis(`${pickedMatch.home} - ${pickedMatch.away} maçını analiz et`, pickedMatch.home, pickedMatch.away);
  }, [pickedMatch?.id]);

  async function runAnalysis(userText: string, overrideTeam1?: string, overrideTeam2?: string) {
    if (!hasGeminiKey()) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: userText },
        { role: 'assistant', text: 'Gemini anahtarı bulunamadı. .env.local dosyasına GEMINI_API_KEY ekleyin.' },
      ]);
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const history = messages.slice(-8);
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setBusy(true);
    const watchdog = window.setTimeout(() => {
      if (runIdRef.current !== runId) return;
      runIdRef.current += 1;
      setBusy(false);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'İstek çok uzun sürdü, tekrar dene.' },
      ]);
    }, 18000);

    try {
    const teams = teamsRef.current;
    const found = await resolveTeamsFromText(userText, teams);

    const today = todayInIstanbul();
    const monthFromText = resolveHijriMonthFilter(userText, today);
    const listIntent = wantsMatchList(userText);
    const statsFocus = statsFocusFromText(userText);
    const needHistory = listIntent || statsFocus != null;
    if (monthFromText != null) {
      monthFilterRef.current = monthFromText;
    } else if (listIntent && /(t[uü]m|ge[cç]mi[sş])/i.test(userText) && !isCurrentHijriMonthQuery(userText)) {
      monthFilterRef.current = null;
    }
    let hijriMonth = monthFromText ?? (needHistory ? monthFilterRef.current : null);
    if (
      statsFocus != null &&
      monthFromText == null &&
      /(t[uü]m|ge[cç]mi[sş])/i.test(userText) &&
      !isCurrentHijriMonthQuery(userText)
    ) {
      hijriMonth = null;
      monthFilterRef.current = null;
    }
    if (mentionsHijriCalendar(userText) && /miladi/i.test(userText)) {
      dateModeRef.current = 'both';
    } else if (/miladi/i.test(userText) && !mentionsHijriCalendar(userText)) {
      dateModeRef.current = 'gregorian';
    } else {
      dateModeRef.current = 'hijri';
    }

    let t1 = overrideTeam1 ?? team1;
    let t2 = overrideTeam2 ?? team2;
    if (isTodayQuery(userText) && found.length === 0 && overrideTeam1 == null) {
      t1 = '';
      t2 = '';
    } else if (found[0] && !found[1] && overrideTeam2 == null) {
      t1 = found[0];
      t2 = '';
    } else {
      if (!t1 && found[0]) t1 = found[0];
      if (!t2 && found[1]) t2 = found[1];
    }
    if (t1 && t2 && t1 === t2 && found[1]) t2 = found[1];
    if (statsFocus && found.length < 2 && overrideTeam2 == null && (/toplam/i.test(userText) || found.length === 1)) {
      if (found[0]) t1 = found[0];
      t2 = '';
    }

    const livePack = await loadLiveRows([t1, t2, ...found].filter((name) => name.length > 0));
    const liveFixtures =
      livePack.rows.length === 0
        ? `${livePack.date} icin listede mac yok`
        : `${livePack.date !== today ? `Fikstur tarihi: ${livePack.date} (bugun ${today})\n` : ''}${formatLiveFixtures(livePack.rows, livePack.date)}`;

    const todayOnly =
      isTodayQuery(userText) && found.length === 0 && overrideTeam1 == null && !listIntent && statsFocus == null;
    if (todayOnly) {
      const turkey = livePack.rows.filter((fx) => fx.country === 'Turkey');
      const pool = turkey.length > 0 ? turkey : livePack.rows;
      const chips = uniqueMatches(pool.slice(0, 16).map((fx) => ({ home: fx.home, away: fx.away })));
      let reply = 'Bugün listede maç yok.';
      if (pool.length === 1) reply = `Bugün ${pool[0].home} - ${pool[0].away} maçı var.`;
      else if (pool.length > 1) reply = 'Bugün birden fazla maç var, aşağıdan birini seçebilirsin.';
      if (runIdRef.current !== runId) return;
      setMessages((prev) => [...prev, { role: 'assistant', text: reply, matches: chips }]);
      return;
    }

    async function assemble(
      ct1: string,
      ct2: string,
      data: ContextData,
    ): Promise<{ context: GeminiContext; listed: RecentMatch[]; table?: MatchTable }> {
      let listed = pickListedMatches(data, ct1, ct2, hijriMonth);
      const title = listedTitle(ct1, ct2, hijriMonth, dateModeRef.current);
      let table: MatchTable | undefined;
      if (listIntent && !statsFocus) {
        if (
          listed.length === 0 &&
          mentionsHijriCalendar(userText) &&
          !isCurrentHijriMonthQuery(userText) &&
          hijriMonthFromText(userText) == null &&
          hijriDayFromText(userText) == null
        ) {
          listed = pickListedMatches(data, ct1, ct2, null);
          if (listed.length === 0) listed = lastListedRef.current;
        }
      }
      const jumuaRows = listIntent
        ? listed
        : [...listed, ...data.team1Recent, ...data.team2Recent, ...data.headToHead];
      await attachJumuaTimes(jumuaRows);
      if (listIntent && !statsFocus && listed.length > 0) {
        table = buildMatchTable(listed.slice(0, 80), dateModeRef.current);
        lastTableRef.current = table;
        lastListedRef.current = listed;
      }
      return {
        listed,
        table,
        context: {
          team1: ct1,
          team2: ct2,
          team1Recent: hijriMonth != null ? [] : data.team1Recent,
          team2Recent: hijriMonth != null ? [] : data.team2Recent,
          headToHead: hijriMonth != null ? listed : data.headToHead,
          listedMatches: listed,
          listedTitle: title,
          prediction: data.prediction,
          todayGregorian: today,
          todayHijri: todayHijriLabel(today),
          liveFixtures,
        },
      };
    }

      let data = await fetchContextData(t1, t2, needHistory ? 'list' : 'analysis');
      let packed = await assemble(t1, t2, data);
      let action: GeminiAction = { reply: '', team1: t1 || null, team2: t2 || null, matches: [] };
      const canAnswerStats = statsFocus != null && (t1.length > 0 || packed.listed.length > 0 || lastListedRef.current.length > 0);
      const canAnswerHijriList = listIntent && hijriMonth != null && t1.length > 0;

      if (!canAnswerStats && !canAnswerHijriList) {
        action = await askGemini(history, userText, packed.context);
        const nextT1 = action.team1 || t1;
        let nextT2 = t2;
        if (action.team2) nextT2 = action.team2;
        else if (action.team1 && !action.team2 && found.length < 2 && overrideTeam2 == null && (hijriMonth != null || found.length === 1)) {
          nextT2 = '';
        }
        const teamsChanged = nextT1 !== t1 || nextT2 !== t2;
        if (teamsChanged && (nextT1 || nextT2)) {
          t1 = nextT1;
          t2 = nextT2;
          data = await fetchContextData(t1, t2, needHistory ? 'list' : 'analysis');
          packed = await assemble(t1, t2, data);
          if (!(statsFocus != null && t1)) {
            action = await askGemini(history, userText, packed.context);
          }
        }
      }

      let chips = packed.table ? [] : uniqueMatches(action.matches).slice(0, 16);
      if (chips.length === 0 && isTodayQuery(userText) && !packed.table) {
        const turkey = livePack.rows.filter((fx) => fx.country === 'Turkey');
        const pool = turkey.length > 0 ? turkey : livePack.rows;
        chips = uniqueMatches(pool.slice(0, 16).map((fx) => ({ home: fx.home, away: fx.away })));
      }
      let reply = action.reply || 'Tamam.';
      if (listIntent) {
        reply = reply
          .split('\n')
          .filter((line) => !/^\s*\|/.test(line))
          .join('\n')
          .trim() || reply;
      }
      if (statsFocus) {
        let rows = packed.listed;
        if (rows.length === 0 && hijriMonth == null) rows = lastListedRef.current;
        const counts = countMatchResults(rows);
        const focused =
          statsFocus === 'wins'
            ? rows.filter((row) => row.result === 'W')
            : statsFocus === 'losses'
              ? rows.filter((row) => row.result === 'L')
              : statsFocus === 'draws'
                ? rows.filter((row) => row.result === 'D')
                : rows;
        reply = formatRecordReply(t1 || 'Bu takım', t2, hijriMonth, counts);
        if (focused.length > 0 && focused.length <= 40) {
          packed.table = buildMatchTable(focused, dateModeRef.current);
        }
        chips = packed.table ? [] : chips;
      } else if (listIntent && hijriMonth != null) {
        const counts = countMatchResults(packed.listed);
        reply = formatRecordReply(t1 || 'Bu takım', t2, hijriMonth, counts);
        chips = packed.table ? [] : chips;
      }
      if (runIdRef.current !== runId) return;
      if (packed.table && packed.table.rows.length > 0 && onOpenTable) {
        const counts = countMatchResults(packed.listed);
        onOpenTable({
          title: packed.context.listedTitle,
          table: packed.table,
          summary: `${counts.total} maç`,
          counts,
        });
        if (listIntent || statsFocus) {
          reply = 'Maç tablosu Tablo Sistemi sekmesine alındı.';
          chips = [];
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: reply,
          matches: chips,
        },
      ]);
      setTeam1(t1);
      setTeam2(t2);
    } catch (error) {
      if (runIdRef.current !== runId) return;
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Gemini hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}` },
      ]);
    } finally {
      window.clearTimeout(watchdog);
      if (runIdRef.current === runId) setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    await runAnalysis(text);
  }

  async function handleMatchClick(match: GeminiMatchRef) {
    await runAnalysis(`${match.home} - ${match.away} maçını analiz et`, match.home, match.away);
  }

  return (
    <aside className="flex h-[36rem] w-full flex-col overflow-hidden rounded-3xl border border-hairline bg-surface/80 shadow-sm backdrop-blur-xl lg:h-[calc(100vh-8rem)]">
      <div className="border-b border-hairline px-5 py-4">
        <h2 className="text-sm font-semibold text-ink">Yapay Zeka</h2>
        <p className="mt-0.5 text-xs text-inksecondary">Maç analizi ve sohbet; tablolar diğer sekmede</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((msg, idx) => (
          <div
            key={`${msg.role}-${idx}`}
            className={msg.role === 'user' ? 'ml-auto max-w-[85%]' : 'max-w-[92%]'}
          >
            <div
              className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'rounded-br-md bg-accent text-white'
                  : 'rounded-bl-md bg-elevated text-ink'
              }`}
            >
              {renderMarkdownTables(msg.text)}
            </div>
            {msg.matches && msg.matches.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.matches.map((m, mIdx) => (
                  <button
                    key={`${m.home}-${m.away}-${mIdx}`}
                    type="button"
                    onClick={() => handleMatchClick(m)}
                    className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent hover:bg-accentsoft hover:text-accent disabled:opacity-40"
                  >
                    {m.home} vs {m.away}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="text-xs text-inktertiary">Analiz ediliyor...</div>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t border-hairline p-4">
        <textarea
          className="mb-3 h-20 w-full resize-none rounded-2xl bg-elevated px-4 py-3 text-sm text-ink outline-none transition focus:ring-4 focus:ring-accentsoft"
          placeholder="Maçı analiz et"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          className="w-full rounded-full bg-accent py-3 text-sm font-medium text-white transition hover:bg-accenthover"
        >
          Gönder
        </button>
      </form>
    </aside>
  );
}
