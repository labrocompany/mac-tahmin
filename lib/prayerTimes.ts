import { GREGORIAN_MONTHS } from './hijri';

const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const COUNTRY_MAP: Record<string, string> = {
  england: 'United Kingdom',
  wales: 'United Kingdom',
  scotland: 'United Kingdom',
  'northern-ireland': 'United Kingdom',
  'northern ireland': 'United Kingdom',
  usa: 'United States',
  holland: 'Netherlands',
  world: '',
};

const dayCache = new Map<string, string>();
const dayInflight = new Map<string, Promise<string>>();

export interface JumuaPlace {
  city: string;
  country: string;
  jumuaDate: string;
  jumuaTime: string;
}

export function weekdayFromIso(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return WEEKDAYS[date.getUTCDay()] ?? '';
}

export function fridayOfWeek(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getUTCDay();
  const offset = day === 0 ? -2 : 5 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function formatTrDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${GREGORIAN_MONTHS[m - 1]} ${y}`;
}

export function formatJumuaLabel(dateIso: string, time: string): string {
  if (!dateIso && !time) return '-';
  const dateLabel = dateIso ? formatTrDate(dateIso) : '';
  if (dateLabel && time) return `${dateLabel} ${time}`;
  return dateLabel || time || '-';
}

function foldCountry(value: string): string {
  return value
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function aladhanCountry(country: string): string {
  const mapped = COUNTRY_MAP[foldCountry(country)];
  if (mapped !== undefined) return mapped;
  return country.trim();
}

function prayerMethod(country: string): number {
  return foldCountry(country) === 'turkey' ? 13 : 3;
}

function cleanCity(city: string): string {
  return city.split(',')[0].trim();
}

function isoToAladhan(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function parseDhuhr(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const match = raw.match(/(\d{1,2}:\d{2})/);
  return match ? match[1] : '';
}

function cacheKey(city: string, country: string, extra: string): string {
  return `${foldCountry(city)}|${foldCountry(country)}|${extra}`;
}

async function fetchJson(url: string, ms = 3500): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function timingsUrl(city: string, country: string, iso: string): string {
  const params = new URLSearchParams({
    city,
    method: String(prayerMethod(country)),
  });
  const mapped = aladhanCountry(country);
  if (mapped) params.set('country', mapped);
  return `https://api.aladhan.com/v1/timingsByCity/${isoToAladhan(iso)}?${params.toString()}`;
}

async function loadDayTime(city: string, country: string, iso: string): Promise<string> {
  const key = cacheKey(city, country, iso);
  if (dayCache.has(key)) return dayCache.get(key) ?? '';
  const pending = dayInflight.get(key);
  if (pending) return pending;
  const job = (async () => {
    try {
      const body = (await fetchJson(timingsUrl(city, country, iso))) as {
        data?: { timings?: { Dhuhr?: string } };
      };
      const time = parseDhuhr(body.data?.timings?.Dhuhr);
      if (time) dayCache.set(key, time);
      return time;
    } catch {
      return '';
    } finally {
      dayInflight.delete(key);
    }
  })();
  dayInflight.set(key, job);
  return job;
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  async function run(): Promise<void> {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
}

function withDeadline(work: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), ms);
    work.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

export async function attachJumuaTimes(rows: JumuaPlace[]): Promise<void> {
  const needed = rows.filter((row) => row.jumuaDate && !row.jumuaTime && cleanCity(row.city));
  if (needed.length === 0) return;

  const jobs: JumuaPlace[] = [];
  const seen = new Set<string>();
  for (const row of needed) {
    const city = cleanCity(row.city);
    const key = cacheKey(city, row.country, row.jumuaDate);
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push(row);
    if (jobs.length >= 8) break;
  }

  await withDeadline(
    runPool(jobs, 4, async (row) => {
      const time = await loadDayTime(cleanCity(row.city), row.country, row.jumuaDate);
      if (time) row.jumuaTime = time;
    }),
    5000,
  );

  for (const row of needed) {
    if (row.jumuaTime) continue;
    const city = cleanCity(row.city);
    row.jumuaTime = dayCache.get(cacheKey(city, row.country, row.jumuaDate)) ?? '';
  }
}
