import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { footballKey, apiGet } from '../lib/apiFootball';
import { fetchDayFixtures, pickRelevantFixtures, todayInIstanbul } from '../lib/liveFixtures';
import { resolveTeamName } from '../lib/teamMap';

const OUTPUT_DIR = resolve(__dirname, '../public/data');
const SEASONS = [2024, 2025, 2026];

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

async function writeTeamsAndIds() {
  const map: Record<string, number> = {};
  const names = new Set<string>();

  if (!footballKey()) {
    writeFileSync(resolve(OUTPUT_DIR, 'teams.json'), JSON.stringify([]));
    writeFileSync(resolve(OUTPUT_DIR, 'api-team-ids.json'), JSON.stringify(map));
    console.log('API_FOOTBALL_KEY yok, bos teams/api-team-ids yazildi.');
    return;
  }

  for (const season of SEASONS) {
    try {
      const rows = await apiGet<Array<{ team: { id: number; name: string } }>>(
        `/teams?league=203&season=${season}`,
      );
      for (const row of rows ?? []) {
        const canonical = resolveTeamName(row.team.name, []);
        names.add(canonical);
        map[canonical] = row.team.id;
        map[row.team.name] = row.team.id;
      }
    } catch {
      continue;
    }
  }

  const sortedTeams = [...names].sort((a, b) => a.localeCompare(b));
  writeFileSync(resolve(OUTPUT_DIR, 'teams.json'), JSON.stringify(sortedTeams));
  writeFileSync(resolve(OUTPUT_DIR, 'api-team-ids.json'), JSON.stringify(map));
  console.log(`Takim sayisi: ${sortedTeams.length}`);
  console.log(`API takim id: ${Object.keys(map).length}`);
}

async function writeLiveFixtures() {
  const date = todayInIstanbul();
  const fixtures = pickRelevantFixtures(await fetchDayFixtures());
  writeFileSync(
    resolve(OUTPUT_DIR, 'live-fixtures.json'),
    JSON.stringify({ date, timezone: 'Europe/Istanbul', fixtures }),
  );
  console.log(`Canli fikstur: ${date} / ${fixtures.length} mac`);
}

async function main() {
  loadEnvLocal();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  await writeTeamsAndIds();
  await writeLiveFixtures();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
