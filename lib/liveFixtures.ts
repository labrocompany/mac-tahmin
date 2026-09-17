import { footballKey } from './apiFootball';
import { formatJumuaLabel, fridayOfWeek, weekdayFromIso } from './prayerTimes';

export interface LiveFixture {
  time: string;
  date: string;
  league: string;
  country: string;
  home: string;
  away: string;
  score: string;
  status: string;
  statusShort: string;
  stadium: string;
  city: string;
  weekday: string;
  jumuaDate: string;
  jumuaTime: string;
}

export interface LiveFixturesFile {
  date: string;
  timezone: string;
  fixtures: LiveFixture[];
}

const MAJOR_LEAGUES: Array<{ country: string; league: string }> = [
  { country: 'England', league: 'Premier League' },
  { country: 'Spain', league: 'La Liga' },
  { country: 'Italy', league: 'Serie A' },
  { country: 'Germany', league: 'Bundesliga' },
  { country: 'France', league: 'Ligue 1' },
  { country: 'World', league: 'UEFA Champions League' },
  { country: 'World', league: 'UEFA Europa League' },
  { country: 'World', league: 'UEFA Europa Conference League' },
];

const RANGE_LEAGUES = [203, 204];
const RANGE_SEASON = 2026;

let rangeCache: { key: string; rows: LiveFixture[] } | null = null;
let rangeInflight: Promise<LiveFixture[]> | null = null;
let dayCache: { date: string; rows: LiveFixture[] } | null = null;
let dayInflight: Promise<LiveFixture[]> | null = null;

export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isBoardLeague(fx: LiveFixture): boolean {
  const n = fold(fx.league);
  if (n.includes('2. lig') || n.includes('2 lig')) return false;
  if (n.includes('super lig')) return true;
  if (n.includes('1. lig') || n.includes('1 lig')) return true;
  return false;
}

export function pickBoardFixtures(all: LiveFixture[]): LiveFixture[] {
  const merged: LiveFixture[] = [];
  const seen = new Set<string>();
  for (const fx of all) {
    if (fx.country !== 'Turkey' || !isBoardLeague(fx)) continue;
    const rowKey = `${fx.date}|${fx.time}|${fx.home}|${fx.away}`;
    if (seen.has(rowKey)) continue;
    seen.add(rowKey);
    merged.push(fx);
  }
  return merged;
}

export function splitBoardFixtures(
  rows: LiveFixture[],
  today: string,
): { past: LiveFixture[]; today: LiveFixture[]; upcoming: LiveFixture[] } {
  const pastFrom = addDaysIso(today, -7);
  const upcomingTo = addDaysIso(today, 7);
  const past = rows
    .filter((fx) => fx.country === 'Turkey' && isBoardLeague(fx) && fx.date < today && fx.date >= pastFrom)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
    .slice(0, 40);
  const todayRows = rows
    .filter((fx) => fx.country === 'Turkey' && isBoardLeague(fx) && fx.date === today)
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 40);
  const upcoming = rows
    .filter((fx) => fx.country === 'Turkey' && isBoardLeague(fx) && fx.date > today && fx.date <= upcomingTo)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 40);
  return { past, today: todayRows, upcoming };
}

export async function fetchFixtureRange(from: string, to: string): Promise<LiveFixture[]> {
  const key = footballKey();
  if (!key) return [];
  const cacheKey = `tr-top2|${from}|${to}`;
  if (rangeCache?.key === cacheKey) return rangeCache.rows;
  if (rangeInflight) return rangeInflight;

  rangeInflight = (async () => {
    const chunks: LiveFixture[][] = [];
    let index = 0;
    async function worker(): Promise<void> {
      while (index < RANGE_LEAGUES.length) {
        const leagueId = RANGE_LEAGUES[index];
        index += 1;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        try {
          const res = await fetch(
            `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${RANGE_SEASON}&from=${from}&to=${to}&timezone=Europe/Istanbul`,
            { headers: { 'x-apisports-key': key }, signal: ctrl.signal },
          );
          const body = await res.json();
          if (res.ok) chunks.push(((body.response ?? []) as RawDayFixture[]).map(mapDayFixture));
        } catch {
        } finally {
          clearTimeout(timer);
        }
      }
    }
    await Promise.all([worker(), worker()]);
    const rows = pickBoardFixtures(chunks.flat());
    rangeCache = { key: cacheKey, rows };
    return rows;
  })().finally(() => {
    rangeInflight = null;
  });

  return rangeInflight;
}

type RawDayFixture = {
  fixture: {
    date: string;
    status: { short: string; long: string };
    venue?: { name?: string | null; city?: string | null } | null;
  };
  league: { name: string; country: string };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
};

function mapDayFixture(fx: RawDayFixture): LiveFixture {
  const homeGoals = fx.goals.home;
  const awayGoals = fx.goals.away;
  const score = homeGoals == null || awayGoals == null ? '-' : `${homeGoals}-${awayGoals}`;
  const matchDate = fx.fixture.date.slice(0, 10);
  return {
    time: fx.fixture.date.slice(11, 16),
    date: matchDate,
    league: fx.league.name,
    country: fx.league.country,
    home: fx.teams.home.name,
    away: fx.teams.away.name,
    score,
    status: fx.fixture.status.long || fx.fixture.status.short,
    statusShort: fx.fixture.status.short,
    stadium: fx.fixture.venue?.name?.trim() || '',
    city: fx.fixture.venue?.city?.trim() || '',
    weekday: weekdayFromIso(matchDate),
    jumuaDate: fridayOfWeek(matchDate),
    jumuaTime: '',
  };
}

export function todayInIstanbul(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function fold(name: string): string {
  return name
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function involvesTeam(fixture: LiveFixture, hints: string[]): boolean {
  if (hints.length === 0) return false;
  const home = fold(fixture.home);
  const away = fold(fixture.away);
  return hints.some((hint) => {
    const h = fold(hint);
    return h.length >= 3 && (home.includes(h) || away.includes(h) || h.includes(home) || h.includes(away));
  });
}

function isMajor(fixture: LiveFixture): boolean {
  return MAJOR_LEAGUES.some((item) => item.country === fixture.country && item.league === fixture.league);
}

export function pickRelevantFixtures(all: LiveFixture[], hints: string[] = []): LiveFixture[] {
  const merged: LiveFixture[] = [];
  const seen = new Set<string>();
  for (const fx of all) {
    const keep = fx.country === 'Turkey' || isMajor(fx) || involvesTeam(fx, hints);
    if (!keep) continue;
    const rowKey = `${fx.time}|${fx.home}|${fx.away}`;
    if (seen.has(rowKey)) continue;
    seen.add(rowKey);
    merged.push(fx);
  }
  const turkey = merged.filter((fx) => fx.country === 'Turkey');
  const rest = merged.filter((fx) => fx.country !== 'Turkey');
  return [...turkey, ...rest].slice(0, 40);
}

export async function fetchDayFixtures(): Promise<LiveFixture[]> {
  const key = footballKey();
  if (!key) return [];
  const date = todayInIstanbul();
  if (dayCache && dayCache.date === date) return dayCache.rows;
  if (dayInflight) return dayInflight;

  dayInflight = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(
        `https://v3.football.api-sports.io/fixtures?date=${date}&timezone=Europe/Istanbul`,
        { headers: { 'x-apisports-key': key }, signal: ctrl.signal },
      );
      const body = await res.json();
      if (!res.ok || (body.errors && !Array.isArray(body.errors) && Object.keys(body.errors).length > 0)) {
        return [];
      }
      const rows = ((body.response ?? []) as RawDayFixture[]).map(mapDayFixture);
      dayCache = { date, rows };
      return rows;
    } catch {
      return dayCache?.date === date ? dayCache.rows : [];
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    dayInflight = null;
  });

  return dayInflight;
}

export async function fetchTodayFixtures(teamHints: string[] = []): Promise<LiveFixture[]> {
  const all = await fetchDayFixtures();
  return pickRelevantFixtures(all, teamHints);
}

export function formatLiveFixtures(rows: LiveFixture[], date: string): string {
  if (rows.length === 0) {
    return `${date} icin listede mac yok`;
  }
  return rows
    .map(
      (fx) =>
        `${fx.time} ${fx.weekday || ''} ${fx.date} ${fx.country}: ${fx.home} ${fx.score} ${fx.away} (${fx.stadium || '-'}, ${fx.city || '-'}, Cuma namazi ${formatJumuaLabel(fx.jumuaDate || '', fx.jumuaTime || '')}) (${fx.status})`,
    )
    .join('\n');
}
