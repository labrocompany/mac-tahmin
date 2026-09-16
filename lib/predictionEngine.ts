export function getTeamSuggestions(teams: string[], partialName: string): string[] {
  const partialLower = partialName.toLowerCase();
  return teams
    .filter((team) => team.toLowerCase().includes(partialLower))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 10);
}

const TEAM_ALIASES: Record<string, string> = {
  gs: 'Galatasaray',
  fb: 'Fenerbahce',
  bjk: 'Besiktas',
  ts: 'Trabzonspor',
  galasaray: 'Galatasaray',
  galatasarayin: 'Galatasaray',
};

function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function resolveTeamToken(query: string, teams: string[]): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/(nın|nin|nun|nün|ın|in|un|ün|lar|ler)$/i, '');
  const alias =
    TEAM_ALIASES[trimmed.toLowerCase()] || TEAM_ALIASES[stripped.toLowerCase()] || TEAM_ALIASES[fold(stripped)];
  if (alias && teams.includes(alias)) return alias;
  if (teams.includes(trimmed) || teams.includes(stripped)) return teams.includes(trimmed) ? trimmed : stripped;

  const folded = fold(stripped);
  const exact = teams.find((team) => fold(team) === folded);
  if (exact) return exact;
  if (folded.length < 4) return null;
  const starts = teams.filter((team) => fold(team).startsWith(folded) || folded.startsWith(fold(team)));
  if (starts.length === 1) return starts[0];
  const contains = teams.filter((team) => fold(team).includes(folded) || folded.includes(fold(team)));
  if (contains.length === 1) return contains[0];
  return null;
}

export function resolveTeamName(query: string, teams: string[]): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  if (teams.includes(trimmed)) return trimmed;

  const alias = TEAM_ALIASES[trimmed.toLowerCase()];
  if (alias && teams.includes(alias)) return alias;

  const folded = fold(trimmed);
  const exact = teams.find((team) => fold(team) === folded);
  if (exact) return exact;

  const suggestions = getTeamSuggestions(teams, trimmed);
  if (suggestions.length === 1) return suggestions[0];
  const starts = suggestions.filter((team) => fold(team).startsWith(folded));
  if (starts.length === 1) return starts[0];
  const foldedHits = teams.filter((team) => fold(team).includes(folded) || folded.includes(fold(team)));
  if (foldedHits.length === 1) return foldedHits[0];
  return suggestions[0] ?? null;
}
