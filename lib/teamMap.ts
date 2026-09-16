export const API_TEAM_TO_CSV: Record<string, string> = {
  'Beşiktaş': 'Besiktas',
  Besiktas: 'Besiktas',
  'Fenerbahçe': 'Fenerbahce',
  Fenerbahce: 'Fenerbahce',
  Galatasaray: 'Galatasaray',
  'Göztepe': 'Goztepe',
  Goztepe: 'Goztepe',
  'Kasımpaşa': 'Kasimpasa',
  Kasimpasa: 'Kasimpasa',
  'Başakşehir': 'Basaksehir FK',
  'İstanbul Başakşehir': 'Basaksehir FK',
  'Istanbul Basaksehir': 'Basaksehir FK',
  Basaksehir: 'Basaksehir FK',
  Rizespor: 'Caykur Rizespor',
  'Çaykur Rizespor': 'Caykur Rizespor',
  'Caykur Rizespor': 'Caykur Rizespor',
  'Eyüpspor': 'Eyüpspor',
  Eyupspor: 'Eyüpspor',
  'Gaziantep FK': 'Gaziantep FK',
  Gaziantep: 'Gaziantep FK',
  Konyaspor: 'Konyaspor',
  Alanyaspor: 'Alanyaspor',
  Trabzonspor: 'Trabzonspor',
  Kayserispor: 'Kayserispor',
  Sivasspor: 'Sivasspor',
  Antalyaspor: 'Antalyaspor',
  'Adana Demirspor': 'Adana Demirspor',
  Hatayspor: 'Hatayspor',
  'Bodrum FK': 'Bodrum FK',
  Samsunspor: 'Samsunspor',
  Kocaelispor: 'Kocaelispor',
  'Gençlerbirliği': 'Genclerbirligi',
  Genclerbirligi: 'Genclerbirligi',
  'Çorum FK': 'Corum FK',
  'Corum FK': 'Corum FK',
};

export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]/g, '');
}

export function resolveTeamName(apiName: string, csvTeams: string[]): string {
  const mapped = API_TEAM_TO_CSV[apiName];
  if (mapped) return mapped;
  if (csvTeams.includes(apiName)) return apiName;

  const folded = foldName(apiName);
  const exact = csvTeams.find((team) => foldName(team) === folded);
  if (exact) return exact;

  const partial = csvTeams.filter((team) => {
    const t = foldName(team);
    return t.includes(folded) || folded.includes(t);
  });
  if (partial.length === 1) return partial[0];

  return apiName;
}
