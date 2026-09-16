import { footballKey } from './apiFootball';

export interface LiveFixture {
  time: string;
  league: string;
  country: string;
  home: string;
  away: string;
  score: string;
  status: string;
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
  let res: Response;
  try {
    res = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${date}&timezone=Europe/Istanbul`,
      { headers: { 'x-apisports-key': key } },
    );
  } catch {
    return [];
  }
  const body = await res.json();
  if (!res.ok || (body.errors && !Array.isArray(body.errors) && Object.keys(body.errors).length > 0)) {
    return [];
  }

  return (body.response ?? []).map(
    (fx: {
      fixture: { date: string; status: { short: string; long: string } };
      league: { name: string; country: string };
      teams: { home: { name: string }; away: { name: string } };
      goals: { home: number | null; away: number | null };
    }) => {
      const homeGoals = fx.goals.home;
      const awayGoals = fx.goals.away;
      const score =
        homeGoals == null || awayGoals == null ? '-' : `${homeGoals}-${awayGoals}`;
      return {
        time: fx.fixture.date.slice(11, 16),
        league: fx.league.name,
        country: fx.league.country,
        home: fx.teams.home.name,
        away: fx.teams.away.name,
        score,
        status: fx.fixture.status.long || fx.fixture.status.short,
      };
    },
  );
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
        `${fx.time} ${fx.country} ${fx.league}: ${fx.home} ${fx.score} ${fx.away} (${fx.status})`,
    )
    .join('\n');
}
