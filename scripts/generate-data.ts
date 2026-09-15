import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { hijriToGregorian } from '../lib/hijri';

const CSV_PATH = resolve(__dirname, '../legacy-python/database.csv');
const OUTPUT_DIR = resolve(__dirname, '../public/data');

function resultCode(result: string): number {
  if (result === 'H') return 0;
  if (result === 'A') return 1;
  if (result === 'D') return 2;
  return 3;
}

function main() {
  const raw = readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.split('\n').filter((line) => line.trim().length > 0);
  const header = lines[0].split(',');

  const dateIdx = header.indexOf('Date');
  const homeIdx = header.indexOf('HomeTeam');
  const awayIdx = header.indexOf('AwayTeam');
  const resultIdx = header.indexOf('Result');

  const teamIndex = new Map<string, number>();
  const teams: string[] = [];

  function getTeamIndex(name: string): number {
    let idx = teamIndex.get(name);
    if (idx === undefined) {
      idx = teams.length;
      teams.push(name);
      teamIndex.set(name, idx);
    }
    return idx;
  }

  const matches: number[][] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',');
    const dateStr = cols[dateIdx] ?? '';
    const hijriParts = dateStr.split('-');
    if (hijriParts.length < 3) continue;

    const hy = parseInt(hijriParts[0], 10);
    const hm = parseInt(hijriParts[1], 10);
    const hd = parseInt(hijriParts[2], 10);
    if (Number.isNaN(hy) || Number.isNaN(hm) || Number.isNaN(hd)) continue;

    const homeName = cols[homeIdx] ?? '';
    const awayName = cols[awayIdx] ?? '';
    if (!homeName || !awayName) continue;

    const home = getTeamIndex(homeName);
    const away = getTeamIndex(awayName);
    const rc = resultCode(cols[resultIdx] ?? '');

    const [gy, gm, gd] = hijriToGregorian(hd, hm, hy);

    matches.push([hy, hm, hd, gy, gm, gd, home, away, rc]);
  }

  const sortedTeams = [...teams].sort((a, b) => a.localeCompare(b));
  const remap = new Map<number, number>();
  sortedTeams.forEach((name, newIdx) => {
    const oldIdx = teamIndex.get(name);
    if (oldIdx !== undefined) remap.set(oldIdx, newIdx);
  });

  const remappedMatches = matches.map((row) => {
    const [hy, hm, hd, gy, gm, gd, home, away, rc] = row;
    return [hy, hm, hd, gy, gm, gd, remap.get(home) ?? home, remap.get(away) ?? away, rc];
  });

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resolve(OUTPUT_DIR, 'teams.json'), JSON.stringify(sortedTeams));
  writeFileSync(resolve(OUTPUT_DIR, 'matches.json'), JSON.stringify(remappedMatches));

  console.log(`Takım sayısı: ${sortedTeams.length}`);
  console.log(`Maç sayısı: ${remappedMatches.length}`);
}

main();
