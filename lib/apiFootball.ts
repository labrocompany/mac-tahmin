import { assetUrl } from './config';
import { isoToHijri } from './hijri';
import { formatJumuaLabel, formatTrDate, fridayOfWeek, weekdayFromIso } from './prayerTimes';
import { foldName, resolveTeamName } from './teamMap';

const API_BASE = 'https://v3.football.api-sports.io';
const FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD']);
const RECENT_SEASONS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

export interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long?: string };
    venue?: { id?: number | null; name?: string | null; city?: string | null } | null;
  };
  league: { id: number; name: string; country: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
}

export interface RecentMatch {
  gregorianDate: string;
  hijriDate: string;
  hijriDay: number;
  hijriMonth: number;
  hijriYear: number;
  home: string;
  away: string;
  score: string;
  league: string;
  country: string;
  venue: 'Ev' | 'Deplasman';
  stadium: string;
  city: string;
  weekday: string;
  jumuaDate: string;
  jumuaTime: string;
  maghribTime: string;
  result: 'W' | 'D' | 'L';
}

interface ApiEnvelope<T> {
  errors: unknown;
  results: number;
  response: T;
}

export function footballKey(): string {
  return process.env.NEXT_PUBLIC_API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '';
}

export function hasFootballKey(): boolean {
  return footballKey().length > 0;
}

function isFriendly(league: string): boolean {
  return league.toLowerCase().includes('friend');
}

export async function apiGet<T>(path: string): Promise<T> {
  const key = footballKey();
  if (!key) {
    throw new Error('API_FOOTBALL_KEY yok');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'x-apisports-key': key },
      signal: ctrl.signal,
    });
    const body = (await res.json()) as ApiEnvelope<T> & { errors?: unknown };
    if (!res.ok) {
      throw new Error(`API HTTP ${res.status}`);
    }
    if (body.errors && !Array.isArray(body.errors) && Object.keys(body.errors as object).length > 0) {
      throw new Error(JSON.stringify(body.errors));
    }
    return body.response;
  } finally {
    clearTimeout(timer);
  }
}

const fixtureCache = new Map<string, ApiFixture[]>();

export async function fetchTeamSeasons(teamId: number, seasons: number[] = RECENT_SEASONS): Promise<ApiFixture[]> {
  const byId = new Map<number, ApiFixture>();
  await Promise.all(
    seasons.map(async (season) => {
      const cacheKey = `team:${teamId}:${season}`;
      let rows = fixtureCache.get(cacheKey);
      if (!rows) {
        try {
          const all = await apiGet<ApiFixture[]>(
            `/fixtures?team=${teamId}&season=${season}&timezone=Europe/Istanbul`,
          );
          rows = (all ?? []).filter((fx) => FINISHED.has(fx.fixture.status.short) && !isFriendly(fx.league.name));
          fixtureCache.set(cacheKey, rows);
        } catch {
          rows = [];
          fixtureCache.set(cacheKey, rows);
        }
      }
      for (const fx of rows) byId.set(fx.fixture.id, fx);
    }),
  );
  return [...byId.values()];
}

export async function fetchHeadToHead(id1: number, id2: number): Promise<ApiFixture[]> {
  const cacheKey = `h2h:${id1}:${id2}`;
  const cached = fixtureCache.get(cacheKey);
  if (cached) return cached;
  try {
    const rows = await apiGet<ApiFixture[]>(
      `/fixtures/headtohead?h2h=${id1}-${id2}&last=200&timezone=Europe/Istanbul`,
    );
    const finished = (rows ?? []).filter((fx) => FINISHED.has(fx.fixture.status.short));
    fixtureCache.set(cacheKey, finished);
    return finished;
  } catch {
    return [];
  }
}

let teamIdMap: Record<string, number> | null = null;

export async function loadTeamIdMap(): Promise<Record<string, number>> {
  if (teamIdMap) return teamIdMap;
  try {
    const res = await fetch(assetUrl('/data/api-team-ids.json'));
    teamIdMap = res.ok ? ((await res.json()) as Record<string, number>) : {};
  } catch {
    teamIdMap = {};
  }
  return teamIdMap;
}

export function lookupTeamId(name: string, map: Record<string, number>): number | null {
  if (map[name] != null) return map[name];
  const folded = foldName(name);
  for (const [key, id] of Object.entries(map)) {
    if (foldName(key) === folded) return id;
  }
  return null;
}

export async function searchTeam(name: string): Promise<{ id: number; name: string } | null> {
  const rows = await apiGet<Array<{ team: { id: number; name: string; country?: string } }>>(
    `/teams?search=${encodeURIComponent(name)}`,
  );
  if (!rows || rows.length === 0) return null;
  const folded = foldName(name);
  const turkey = rows.filter((row) => foldName(row.team.country || '') === 'turkey');
  const pool = turkey.length > 0 ? turkey : rows;
  const exact = pool.find((row) => foldName(row.team.name) === folded);
  const partial = pool.find((row) => {
    const n = foldName(row.team.name);
    return n.includes(folded) || folded.includes(n);
  });
  const picked = exact ?? partial ?? pool[0];
  return { id: picked.team.id, name: picked.team.name };
}

export async function searchTeamId(name: string): Promise<number | null> {
  const found = await searchTeam(name);
  return found?.id ?? null;
}

export async function resolveApiTeamId(name: string): Promise<number | null> {
  const map = await loadTeamIdMap();
  const fromMap = lookupTeamId(name, map);
  if (fromMap != null) return fromMap;
  try {
    const found = await searchTeam(name);
    if (!found) return null;
    map[found.name] = found.id;
    map[name] = found.id;
    return found.id;
  } catch {
    return null;
  }
}

function toRecentMatch(fx: ApiFixture, teamName: string): RecentMatch {
  const isHome = foldName(fx.teams.home.name) === foldName(teamName) || fx.teams.home.name.includes(teamName);
  const hg = fx.goals.home ?? 0;
  const ag = fx.goals.away ?? 0;
  let result: 'W' | 'D' | 'L';
  if (hg === ag) result = 'D';
  else if ((hg > ag && isHome) || (ag > hg && !isHome)) result = 'W';
  else result = 'L';
  const gregorianDate = fx.fixture.date.slice(0, 10);
  const hijri = isoToHijri(gregorianDate);
  const stadium = fx.fixture.venue?.name?.trim() || '';
  const city = fx.fixture.venue?.city?.trim() || '';
  return {
    gregorianDate,
    hijriDate: hijri?.label ?? gregorianDate,
    hijriDay: hijri?.day ?? 0,
    hijriMonth: hijri?.month ?? 0,
    hijriYear: hijri?.year ?? 0,
    home: resolveTeamName(fx.teams.home.name, []),
    away: resolveTeamName(fx.teams.away.name, []),
    score: `${hg}-${ag}`,
    league: fx.league.name,
    country: fx.league.country || '',
    venue: isHome ? 'Ev' : 'Deplasman',
    stadium,
    city,
    weekday: weekdayFromIso(gregorianDate),
    jumuaDate: fridayOfWeek(gregorianDate),
    jumuaTime: '',
    maghribTime: '',
    result,
  };
}

export async function fetchRecentMatchesForTeam(
  name: string,
  limit = 2000,
  seasons: number[] = RECENT_SEASONS,
): Promise<RecentMatch[]> {
  const id = await resolveApiTeamId(name);
  if (id == null) return [];
  const fixtures = await fetchTeamSeasons(id, seasons);
  const rows = fixtures.map((fx) => toRecentMatch(fx, name));
  rows.sort((a, b) => b.gregorianDate.localeCompare(a.gregorianDate));
  return rows.slice(0, limit);
}

export async function fetchHeadToHeadForTeams(name1: string, name2: string, limit = 200): Promise<RecentMatch[]> {
  const [id1, id2] = await Promise.all([resolveApiTeamId(name1), resolveApiTeamId(name2)]);
  if (id1 == null || id2 == null) return [];
  const fixtures = await fetchHeadToHead(id1, id2);
  const rows = fixtures.map((fx) => toRecentMatch(fx, name1));
  rows.sort((a, b) => b.gregorianDate.localeCompare(a.gregorianDate));
  return rows.slice(0, limit);
}

export function formatRecentMatches(rows: RecentMatch[], limit = 40): string {
  if (rows.length === 0) return 'Yok';
  return rows
    .slice(0, limit)
    .map(
      (m) =>
        `${m.gregorianDate} | ${m.hijriDate} | ${m.weekday} | ${m.home} ${m.score} ${m.away} [${m.venue} ${m.result}, ${m.stadium || '-'}, ${m.city || '-'}, Cuma namazi ${formatJumuaLabel(m.jumuaDate, m.jumuaTime)}, Aksam namazi ${m.maghribTime || '-'}]`,
    )
    .join('\n');
}

export function matchInvolvesTeam(match: RecentMatch, name: string): boolean {
  const q = foldName(name);
  if (!q) return false;
  const home = foldName(match.home);
  const away = foldName(match.away);
  return home === q || away === q || home.includes(q) || away.includes(q) || q.includes(home) || q.includes(away);
}

export function extractHeadToHead(rows: RecentMatch[], name1: string, name2: string): RecentMatch[] {
  return rows.filter((row) => matchInvolvesTeam(row, name1) && matchInvolvesTeam(row, name2));
}

export function countMatchResults(rows: RecentMatch[]): { total: number; wins: number; draws: number; losses: number } {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const row of rows) {
    if (row.result === 'W') wins += 1;
    else if (row.result === 'D') draws += 1;
    else losses += 1;
  }
  return { total: rows.length, wins, draws, losses };
}

export function filterMatchesByHijriMonth(
  rows: RecentMatch[],
  month: number | null,
  year: number | null = null,
  day: number | null = null,
): RecentMatch[] {
  return rows.filter((row) => {
    if (month != null && row.hijriMonth !== month) return false;
    if (year != null && row.hijriYear !== year) return false;
    if (day != null && row.hijriDay !== day) return false;
    return true;
  });
}

export interface MatchTable {
  headers: string[];
  rows: string[][];
}

export function buildMatchTable(rows: RecentMatch[], dateMode: 'gregorian' | 'hijri' | 'both' = 'hijri'): MatchTable {
  const extraHeaders = ['Gün', 'Stadyum', 'Şehir', 'Cuma Namazı', 'Akşam Namazı'];
  const extra = (m: RecentMatch) => [
    m.weekday || '-',
    m.stadium || '-',
    m.city || '-',
    formatJumuaLabel(m.jumuaDate, m.jumuaTime),
    m.maghribTime || '-',
  ];
  const played = (m: RecentMatch) => {
    const dateLabel = formatTrDate(m.gregorianDate);
    return m.weekday ? `${m.weekday} ${dateLabel}` : dateLabel;
  };
  if (dateMode === 'gregorian') {
    return {
      headers: ['Oynandığı Tarih', 'Ev Sahibi', 'Skor', 'Deplasman', ...extraHeaders],
      rows: rows.map((m) => [played(m), m.home, m.score, m.away, ...extra(m)]),
    };
  }
  if (dateMode === 'hijri') {
    return {
      headers: ['Hicri Tarih', 'Ev Sahibi', 'Skor', 'Deplasman', 'Oynandığı Tarih', ...extraHeaders],
      rows: rows.map((m) => [m.hijriDate, m.home, m.score, m.away, played(m), ...extra(m)]),
    };
  }
  return {
    headers: ['Hicri Tarih', 'Oynandığı Tarih', 'Ev Sahibi', 'Skor', 'Deplasman', ...extraHeaders],
    rows: rows.map((m) => [m.hijriDate, played(m), m.home, m.score, m.away, ...extra(m)]),
  };
}

export interface PredictionData {
  advice: string | null;
  percentHome: string | null;
  percentDraw: string | null;
  percentAway: string | null;
}

export async function fetchPredictionForTeams(name1: string, name2: string): Promise<PredictionData | null> {
  const [id1, id2] = await Promise.all([resolveApiTeamId(name1), resolveApiTeamId(name2)]);
  if (id1 == null || id2 == null) return null;
  return fetchUpcomingPrediction(id1, id2);
}

export async function fetchUpcomingPrediction(id1: number, id2: number): Promise<PredictionData | null> {
  try {
    const fixtures = await apiGet<ApiFixture[]>(
      `/fixtures/headtohead?h2h=${id1}-${id2}&next=1&timezone=Europe/Istanbul`,
    );
    const fixtureId = fixtures?.[0]?.fixture?.id;
    if (!fixtureId) return null;
    const rows = await apiGet<
      Array<{
        predictions: {
          advice: string | null;
          percent: { home: string; draw: string; away: string };
        };
      }>
    >(`/predictions?fixture=${fixtureId}`);
    const row = rows?.[0];
    if (!row) return null;
    return {
      advice: row.predictions.advice ?? null,
      percentHome: row.predictions.percent?.home ?? null,
      percentDraw: row.predictions.percent?.draw ?? null,
      percentAway: row.predictions.percent?.away ?? null,
    };
  } catch {
    return null;
  }
}
