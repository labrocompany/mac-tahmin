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

let dayCache: { date: string; rows: LiveFixture[] } | null = null;
let dayInflight: Promise<LiveFixture[]> | null = null;

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
