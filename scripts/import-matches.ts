import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { gregorianToHijri } from '../lib/hijri';
import { resolveTeamName } from '../lib/teamMap';

const CSV_PATH = resolve(__dirname, '../legacy-python/database.csv');
const API_BASE = 'https://v3.football.api-sports.io';
const DEFAULT_LEAGUES = [203];
const DEFAULT_SEASONS = [2022, 2023, 2024];

interface FixtureResponse {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

interface ApiEnvelope {
  errors: unknown;
  results: number;
  paging: { current: number; total: number };
  response: FixtureResponse[];
}

function loadEnvLocal() {
  const envPath = resolve(__dirname, '../.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseList(value: string | undefined, fallback: number[]): number[] {
  if (!value) return fallback;
  return value
    .split(',')
    .map((part) => parseInt(part.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

function resultCode(home: number, away: number): 'H' | 'A' | 'D' {
  if (home > away) return 'H';
  if (away > home) return 'A';
  return 'D';
}

function hijriDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map((n) => parseInt(n, 10));
  const [hd, hm, hy] = gregorianToHijri(year, month, day);
  return `${hy}-${String(hm).padStart(2, '0')}-${String(hd).padStart(2, '0')}`;
}

function rowKey(date: string, home: string, away: string): string {
  return `${date}|${home}|${away}`;
}

function existingKeys(csv: string): Set<string> {
  const keys = new Set<string>();
  const lines = csv.split('\n').filter((line) => line.trim().length > 0);
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',');
    if (cols.length < 3) continue;
    keys.add(rowKey(cols[0], cols[1], cols[2]));
  }
  return keys;
}

function csvTeams(csv: string): string[] {
  const teams = new Set<string>();
  const lines = csv.split('\n').filter((line) => line.trim().length > 0);
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',');
    if (cols.length < 3) continue;
    teams.add(cols[1]);
    teams.add(cols[2]);
  }
  return [...teams];
}

async function fetchJson(path: string, apiKey: string): Promise<ApiEnvelope> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-apisports-key': apiKey },
  });
  if (!res.ok) {
    throw new Error(`API HTTP ${res.status}`);
  }
  return (await res.json()) as ApiEnvelope;
}

async function fetchFinishedFixtures(league: number, season: number, apiKey: string): Promise<FixtureResponse[]> {
  const data = await fetchJson(`/fixtures?league=${league}&season=${season}&status=FT`, apiKey);
  if (data.errors && !Array.isArray(data.errors) && Object.keys(data.errors as object).length > 0) {
    throw new Error(JSON.stringify(data.errors));
  }
  return data.response ?? [];
}

async function main() {
  loadEnvLocal();
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY tanimli degil');
  }

  const leagues = parseList(process.env.API_FOOTBALL_LEAGUES, DEFAULT_LEAGUES);
  const seasons = parseList(process.env.API_FOOTBALL_SEASONS, DEFAULT_SEASONS);

  let csv = readFileSync(CSV_PATH, 'utf-8');
  if (!csv.endsWith('\n')) csv += '\n';

  const keys = existingKeys(csv);
  const teams = csvTeams(csv);
  const newRows: string[] = [];

  for (const league of leagues) {
    for (const season of seasons) {
      try {
        const fixtures = await fetchFinishedFixtures(league, season, apiKey);
        for (const fx of fixtures) {
          const homeGoals = fx.goals.home;
          const awayGoals = fx.goals.away;
          if (homeGoals === null || awayGoals === null) continue;
          if (fx.fixture.status.short !== 'FT') continue;

          const home = resolveTeamName(fx.teams.home.name, teams);
          const away = resolveTeamName(fx.teams.away.name, teams);
          const date = hijriDate(fx.fixture.date);
          const key = rowKey(date, home, away);
          if (keys.has(key)) continue;

          keys.add(key);
          if (!teams.includes(home)) teams.push(home);
          if (!teams.includes(away)) teams.push(away);

          const result = resultCode(homeGoals, awayGoals);
          newRows.push(
            `${date},${home},${away},${homeGoals},${awayGoals},${result},API_Football_${league}_${season}`,
          );
        }
        console.log(`Lig ${league} sezon ${season}: ${fixtures.length} bitmis mac tarandi`);
      } catch (error) {
        console.log(`Lig ${league} sezon ${season} atlandi: ${String(error)}`);
      }
    }
  }

  if (newRows.length === 0) {
    console.log('Eklenecek yeni mac yok');
    return;
  }

  writeFileSync(CSV_PATH, csv + newRows.join('\n') + '\n');
  console.log(`${newRows.length} yeni mac eklendi`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
