const HIJRI_EPOCH_JD = 1948439.5;

const HIJRI_MONTH_LENGTHS = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];

export const HIJRI_MONTHS = [
  'Muharrem',
  'Safer',
  'Rebiülevvel',
  'Rebiülahir',
  'Cemaziyelevvel',
  'Cemaziyelahir',
  'Recep',
  'Şaban',
  'Ramazan',
  'Şevval',
  'Zilkade',
  'Zilhicce',
];

export const GREGORIAN_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

export function isHijriLeapYear(hijriYear: number): boolean {
  const leapYearsInCycle = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29];
  const cycleYear = ((hijriYear - 1) % 30) + 1;
  return leapYearsInCycle.includes(cycleYear);
}

export function getHijriMonthLength(hijriYear: number, hijriMonth: number): number {
  if (hijriMonth < 1 || hijriMonth > 12) return 0;
  let length = HIJRI_MONTH_LENGTHS[hijriMonth - 1];
  if (hijriMonth === 12 && isHijriLeapYear(hijriYear)) {
    length = 30;
  }
  return length;
}

export function gregorianToJulianDay(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }

  const a = Math.floor(year / 100);
  let b = 2 - a + Math.floor(a / 4);

  if (year < 1583 || (year === 1582 && month < 10) || (year === 1582 && month === 10 && day < 15)) {
    b = 0;
  }

  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

export function julianDayToGregorian(julianDay: number): [number, number, number] {
  const jd = julianDay + 0.5;
  const z = Math.floor(jd);
  const f = jd - z;

  let a: number;
  if (z < 2299161) {
    a = z;
  } else {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }

  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;

  return [Math.trunc(year), Math.trunc(month), Math.trunc(day)];
}

const LEAP_YEARS_IN_CYCLE = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29];

function daysBeforeHijriYear(hijriYear: number): number {
  const yearsElapsed = hijriYear - 1;
  const fullCycles = Math.floor(yearsElapsed / 30);
  const remainder = yearsElapsed - fullCycles * 30;
  const leapInRemainder = LEAP_YEARS_IN_CYCLE.filter((v) => v <= remainder).length;
  const leapCount = fullCycles * LEAP_YEARS_IN_CYCLE.length + leapInRemainder;
  return yearsElapsed * 354 + leapCount;
}

export function hijriToJulianDay(hijriYear: number, hijriMonth: number, hijriDay: number): number {
  let totalDays = daysBeforeHijriYear(hijriYear);

  for (let m = 1; m < hijriMonth; m += 1) {
    totalDays += getHijriMonthLength(hijriYear, m);
  }

  totalDays += hijriDay - 1;

  return HIJRI_EPOCH_JD + totalDays;
}

export function gregorianToHijri(year: number, month: number, day: number): [number, number, number] {
  const jd = gregorianToJulianDay(year, month, day);
  const daysSinceHijriEpoch = jd - HIJRI_EPOCH_JD;

  let hijriYear = Math.floor(daysSinceHijriEpoch / 354.367) + 1;

  for (;;) {
    const yearStartJd = hijriToJulianDay(hijriYear, 1, 1);
    if (yearStartJd <= jd) {
      const nextYearStartJd = hijriToJulianDay(hijriYear + 1, 1, 1);
      if (jd < nextYearStartJd) break;
      hijriYear += 1;
    } else {
      hijriYear -= 1;
    }
  }

  let hijriMonth = 1;
  while (hijriMonth <= 12) {
    const monthStartJd = hijriToJulianDay(hijriYear, hijriMonth, 1);
    const nextMonthStartJd =
      hijriMonth === 12
        ? hijriToJulianDay(hijriYear + 1, 1, 1)
        : hijriToJulianDay(hijriYear, hijriMonth + 1, 1);

    if (monthStartJd <= jd && jd < nextMonthStartJd) break;
    hijriMonth += 1;
  }

  const monthStartJd = hijriToJulianDay(hijriYear, hijriMonth, 1);
  const hijriDay = Math.trunc(jd - monthStartJd) + 1;

  return [hijriDay, hijriMonth, hijriYear];
}

export function hijriToGregorian(hijriDay: number, hijriMonth: number, hijriYear: number): [number, number, number] {
  const jd = hijriToJulianDay(hijriYear, hijriMonth, hijriDay);
  return julianDayToGregorian(jd);
}

function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

export interface HijriParts {
  day: number;
  month: number;
  year: number;
  monthName: string;
  label: string;
}

export function isoToHijri(iso: string): HijriParts | null {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const [day, month, year] = gregorianToHijri(y, m, d);
  const monthName = HIJRI_MONTHS[month - 1];
  return { day, month, year, monthName, label: `${day} ${monthName} ${year}` };
}

const HIJRI_MONTH_ALIASES: Array<{ month: number; keys: string[] }> = [
  { month: 1, keys: ['muharrem', 'muharram'] },
  { month: 2, keys: ['safer', 'safar'] },
  { month: 3, keys: ['rebiulevvel', 'rebiulevvel', 'rabiulevvel', 'rabiulawwal'] },
  { month: 4, keys: ['rebiulahir', 'rebiulakhir', 'rabiulahir', 'rabiulakhir', 'rebiulahir'] },
  { month: 5, keys: ['cemaziyelevvel', 'jumadaalawwal', 'cemazielevvel'] },
  { month: 6, keys: ['cemaziyelahir', 'jumadaalakhir', 'cemazielahir'] },
  { month: 7, keys: ['recep', 'rajab'] },
  { month: 8, keys: ['saban', 'shaban'] },
  { month: 9, keys: ['ramazan', 'ramadan'] },
  { month: 10, keys: ['sevval', 'shawwal'] },
  { month: 11, keys: ['zilkade', 'dhulqadah'] },
  { month: 12, keys: ['zilhicce', 'dhulhijjah'] },
];

export function mentionsHijriCalendar(text: string): boolean {
  return /hi[cj]r[iî]/i.test(text);
}

export function isCurrentHijriMonthQuery(text: string): boolean {
  return /\bbu\s+ay(da|daki|ki|ın|in)?\b/i.test(text);
}

export interface HijriMonthFilter {
  month: number;
  year: number | null;
  label: string;
}

export function resolveHijriMonthFilter(text: string, todayIso: string): HijriMonthFilter | null {
  const today = isoToHijri(todayIso);
  if (isCurrentHijriMonthQuery(text) && today) {
    return { month: today.month, year: today.year, label: `${today.monthName} ${today.year}` };
  }
  const named = hijriMonthFromText(text);
  if (named != null) {
    return { month: named, year: null, label: HIJRI_MONTHS[named - 1] };
  }
  return null;
}

export function hijriMonthFromText(text: string): number | null {
  const folded = foldText(text);
  for (const entry of HIJRI_MONTH_ALIASES) {
    for (const key of entry.keys) {
      if (folded.includes(key)) return entry.month;
    }
  }
  for (let i = 0; i < HIJRI_MONTHS.length; i += 1) {
    if (folded.includes(foldText(HIJRI_MONTHS[i]))) return i + 1;
  }
  if (folded.includes('rebi') && folded.includes('ahir')) return 4;
  if (folded.includes('rebi') && folded.includes('evvel')) return 3;
  if (folded.includes('cemazi') && folded.includes('ahir')) return 6;
  if (folded.includes('cemazi') && folded.includes('evvel')) return 5;
  return null;
}
