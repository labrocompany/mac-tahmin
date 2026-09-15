import { HIJRI_MONTHS, GREGORIAN_MONTHS } from './hijri';

export type CalendarType = 'hijri' | 'gregorian';

export type MatchRow = [
  hijriYear: number,
  hijriMonth: number,
  hijriDay: number,
  gregorianYear: number,
  gregorianMonth: number,
  gregorianDay: number,
  homeIdx: number,
  awayIdx: number,
  resultCode: number,
];

export interface TeamStats {
  team: string;
  totalMatches: number;
  wins: number;
  draws: number;
  losses: number;
  successRate: number;
}

export interface PredictionResult {
  prediction: string;
  confidence: string;
  confidenceLevel: string;
  scorePrediction: string;
  successDifference: number;
  team1Stats: TeamStats | null;
  team2Stats: TeamStats | null;
  analysis: string;
}

function monthName(calendarType: CalendarType, month: number): string {
  const list = calendarType === 'hijri' ? HIJRI_MONTHS : GREGORIAN_MONTHS;
  return list[month - 1] ?? String(month);
}

export function analyzeTeamPerformance(
  matches: MatchRow[],
  teams: string[],
  teamName: string,
  dayFilter: number | null,
  monthFilter: number | null,
  calendarType: CalendarType,
): TeamStats | null {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let total = 0;

  for (const row of matches) {
    const [hy, hm, hd, gy, gm, gd, homeIdx, awayIdx, rc] = row;
    const homeName = teams[homeIdx];
    const awayName = teams[awayIdx];

    const isHome = homeName.includes(teamName);
    const isAway = awayName.includes(teamName);
    if (!isHome && !isAway) continue;

    const day = calendarType === 'hijri' ? hd : gd;
    const month = calendarType === 'hijri' ? hm : gm;

    if (dayFilter && day !== dayFilter) continue;
    if (monthFilter && month !== monthFilter) continue;

    total += 1;
    if ((rc === 0 && isHome) || (rc === 1 && !isHome)) {
      wins += 1;
    } else if (rc === 2) {
      draws += 1;
    } else {
      losses += 1;
    }
  }

  if (total === 0) return null;

  const successRate = ((wins + draws * 0.5) / total) * 100;

  return {
    team: teamName,
    totalMatches: total,
    wins,
    draws,
    losses,
    successRate,
  };
}

export function predictMatch(
  matches: MatchRow[],
  teams: string[],
  team1: string,
  team2: string,
  dayFilter: number | null,
  monthFilter: number | null,
  calendarType: CalendarType,
): PredictionResult {
  const team1Stats = analyzeTeamPerformance(matches, teams, team1, dayFilter, monthFilter, calendarType);
  const team2Stats = analyzeTeamPerformance(matches, teams, team2, dayFilter, monthFilter, calendarType);

  if (!team1Stats || !team2Stats) {
    return {
      prediction: 'Yetersiz Veri',
      confidence: 'Düşük',
      confidenceLevel: 'Düşük',
      scorePrediction: 'Belirsiz',
      successDifference: 0,
      team1Stats,
      team2Stats,
      analysis: 'Yeterli tarihsel veri bulunamadı.',
    };
  }

  const successDiff = Math.abs(team1Stats.successRate - team2Stats.successRate);

  let prediction: string;
  let confidence: string;
  let scorePrediction: string;

  if (team1Stats.successRate > team2Stats.successRate) {
    if (successDiff >= 25) {
      prediction = `${team1} Güçlü Favori`;
      confidence = 'Yüksek';
      scorePrediction = '2-0, 3-1';
    } else if (successDiff >= 15) {
      prediction = `${team1} Favori`;
      confidence = 'Orta';
      scorePrediction = '1-0, 2-1';
    } else {
      prediction = `${team1} Hafif Avantaj`;
      confidence = 'Düşük';
      scorePrediction = '1-1, 1-0';
    }
  } else if (team2Stats.successRate > team1Stats.successRate) {
    if (successDiff >= 25) {
      prediction = `${team2} Güçlü Favori`;
      confidence = 'Yüksek';
      scorePrediction = '0-2, 1-3';
    } else if (successDiff >= 15) {
      prediction = `${team2} Favori`;
      confidence = 'Orta';
      scorePrediction = '0-1, 1-2';
    } else {
      prediction = `${team2} Hafif Avantaj`;
      confidence = 'Düşük';
      scorePrediction = '1-1, 0-1';
    }
  } else {
    prediction = 'Tamamen Eşit';
    confidence = 'Orta';
    scorePrediction = '1-1, 0-0';
  }

  const totalData = team1Stats.totalMatches + team2Stats.totalMatches;
  let confidenceLevel: string;
  if (totalData >= 50) {
    confidenceLevel = 'Çok Yüksek';
  } else if (totalData >= 20) {
    confidenceLevel = 'Yüksek';
  } else if (totalData >= 10) {
    confidenceLevel = 'Orta';
  } else {
    confidenceLevel = 'Düşük';
  }

  let filterText = '';
  if (dayFilter) {
    filterText += `Her ayın ${dayFilter}. günü `;
  }
  if (monthFilter) {
    filterText += `${monthName(calendarType, monthFilter)} ayı `;
  }

  const analysis = `${filterText}analizi:

${team1}: ${team1Stats.totalMatches} maç, %${team1Stats.successRate.toFixed(1)} başarı
${team2}: ${team2Stats.totalMatches} maç, %${team2Stats.successRate.toFixed(1)} başarı

Performans Farkı: ${successDiff.toFixed(1)} puan
Toplam Veri: ${totalData} maç`;

  return {
    prediction,
    confidence,
    confidenceLevel,
    scorePrediction,
    successDifference: successDiff,
    team1Stats,
    team2Stats,
    analysis,
  };
}

export function getTeamSuggestions(teams: string[], partialName: string): string[] {
  const partialLower = partialName.toLowerCase();
  return teams
    .filter((team) => team.toLowerCase().includes(partialLower))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 10);
}
