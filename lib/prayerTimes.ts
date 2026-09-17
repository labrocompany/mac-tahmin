import { GREGORIAN_MONTHS, addHijriDays, hijriParts, isoToHijri, HijriParts } from './hijri';

const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const CITY_COORDS: Array<{ keys: string[]; lat: number; lng: number; tz: string }> = [
  { keys: ['istanbul', 'kadikoy', 'besiktas', 'sariyer', 'fatih', 'umraniye', 'bakirkoy', 'zeytinburnu'], lat: 41.0082, lng: 28.9784, tz: 'Europe/Istanbul' },
  { keys: ['ankara'], lat: 39.9334, lng: 32.8597, tz: 'Europe/Istanbul' },
  { keys: ['izmir', 'karsiyaka', 'bornova'], lat: 38.4237, lng: 27.1428, tz: 'Europe/Istanbul' },
  { keys: ['bursa'], lat: 40.1826, lng: 29.0665, tz: 'Europe/Istanbul' },
  { keys: ['antalya'], lat: 36.8969, lng: 30.7133, tz: 'Europe/Istanbul' },
  { keys: ['trabzon'], lat: 41.0015, lng: 39.7178, tz: 'Europe/Istanbul' },
  { keys: ['adana'], lat: 37.0, lng: 35.3213, tz: 'Europe/Istanbul' },
  { keys: ['konya'], lat: 37.8746, lng: 32.4932, tz: 'Europe/Istanbul' },
  { keys: ['kayseri'], lat: 38.7312, lng: 35.4787, tz: 'Europe/Istanbul' },
  { keys: ['gaziantep', 'antep'], lat: 37.0662, lng: 37.3833, tz: 'Europe/Istanbul' },
  { keys: ['samsun'], lat: 41.2867, lng: 36.33, tz: 'Europe/Istanbul' },
  { keys: ['eskisehir'], lat: 39.7767, lng: 30.5206, tz: 'Europe/Istanbul' },
  { keys: ['kocaeli', 'izmit', 'gebze'], lat: 40.7654, lng: 29.9408, tz: 'Europe/Istanbul' },
  { keys: ['hatay', 'antakya'], lat: 36.2023, lng: 36.1613, tz: 'Europe/Istanbul' },
  { keys: ['mersin'], lat: 36.8121, lng: 34.6415, tz: 'Europe/Istanbul' },
  { keys: ['diyarbakir'], lat: 37.9144, lng: 40.2306, tz: 'Europe/Istanbul' },
  { keys: ['malatya'], lat: 38.3552, lng: 38.3095, tz: 'Europe/Istanbul' },
  { keys: ['rize'], lat: 41.0201, lng: 40.5234, tz: 'Europe/Istanbul' },
  { keys: ['sivas'], lat: 39.7477, lng: 37.0179, tz: 'Europe/Istanbul' },
  { keys: ['denizli'], lat: 37.7765, lng: 29.0864, tz: 'Europe/Istanbul' },
  { keys: ['manisa'], lat: 38.6191, lng: 27.4289, tz: 'Europe/Istanbul' },
  { keys: ['sakarya', 'adapazari'], lat: 40.7889, lng: 30.4053, tz: 'Europe/Istanbul' },
  { keys: ['erzurum'], lat: 39.9055, lng: 41.2658, tz: 'Europe/Istanbul' },
  { keys: ['elazig'], lat: 38.681, lng: 39.2264, tz: 'Europe/Istanbul' },
  { keys: ['ordu'], lat: 40.9862, lng: 37.8797, tz: 'Europe/Istanbul' },
  { keys: ['giresun'], lat: 40.9128, lng: 38.3895, tz: 'Europe/Istanbul' },
  { keys: ['afyon', 'afyonkarahisar'], lat: 38.7507, lng: 30.5567, tz: 'Europe/Istanbul' },
  { keys: ['alanya'], lat: 36.5444, lng: 31.9957, tz: 'Europe/Istanbul' },
  { keys: ['london', 'londra'], lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  { keys: ['manchester'], lat: 53.4808, lng: -2.2426, tz: 'Europe/London' },
  { keys: ['madrid'], lat: 40.4168, lng: -3.7038, tz: 'Europe/Madrid' },
  { keys: ['barcelona'], lat: 41.3874, lng: 2.1686, tz: 'Europe/Madrid' },
  { keys: ['milan', 'milano'], lat: 45.4642, lng: 9.19, tz: 'Europe/Rome' },
  { keys: ['rome', 'roma'], lat: 41.9028, lng: 12.4964, tz: 'Europe/Rome' },
  { keys: ['munich', 'munchen', 'munih'], lat: 48.1351, lng: 11.582, tz: 'Europe/Berlin' },
  { keys: ['berlin'], lat: 52.52, lng: 13.405, tz: 'Europe/Berlin' },
  { keys: ['paris'], lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris' },
  { keys: ['amsterdam'], lat: 52.3676, lng: 4.9041, tz: 'Europe/Amsterdam' },
  { keys: ['lisbon', 'lizbon'], lat: 38.7223, lng: -9.1393, tz: 'Europe/Lisbon' },
];

const COUNTRY_DEFAULT: Record<string, { lat: number; lng: number; tz: string }> = {
  turkey: { lat: 41.0082, lng: 28.9784, tz: 'Europe/Istanbul' },
  england: { lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  spain: { lat: 40.4168, lng: -3.7038, tz: 'Europe/Madrid' },
  italy: { lat: 41.9028, lng: 12.4964, tz: 'Europe/Rome' },
  germany: { lat: 52.52, lng: 13.405, tz: 'Europe/Berlin' },
  france: { lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris' },
  netherlands: { lat: 52.3676, lng: 4.9041, tz: 'Europe/Amsterdam' },
  portugal: { lat: 38.7223, lng: -9.1393, tz: 'Europe/Lisbon' },
};

export interface JumuaPlace {
  city: string;
  country: string;
  jumuaDate: string;
  jumuaTime: string;
  gregorianDate?: string;
  maghribTime?: string;
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

function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function dtr(d: number): number {
  return (d * Math.PI) / 180;
}

function rtd(r: number): number {
  return (r * 180) / Math.PI;
}

function fixHour(a: number): number {
  let h = a - 24 * Math.floor(a / 24);
  if (h < 0) h += 24;
  return h;
}

function julian(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

function equationOfTime(jd: number): number {
  const d = jd - 2451545.0;
  const g = 357.529 + 0.98560028 * d;
  const q = 280.459 + 0.98564736 * d;
  const l = q + 1.915 * Math.sin(dtr(g)) + 0.02 * Math.sin(dtr(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const ra = rtd(Math.atan2(Math.cos(dtr(e)) * Math.sin(dtr(l)), Math.cos(dtr(l)))) / 15;
  return q / 15 - fixHour(ra);
}

function zoneOffsetHours(iso: string, timeZone: string): number {
  const utc = new Date(`${iso}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(utc);
  const name = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 3;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) + Number(match[3] || 0) / 60);
}

function placeFor(city: string, country: string): { lat: number; lng: number; tz: string } {
  const foldedCity = fold(city);
  for (const entry of CITY_COORDS) {
    if (entry.keys.some((key) => foldedCity.includes(key) || key.includes(foldedCity))) return entry;
  }
  return COUNTRY_DEFAULT[fold(country)] ?? COUNTRY_DEFAULT.turkey;
}

function formatHour(value: number): string {
  const total = Math.round(fixHour(value) * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function sunDeclination(jd: number): number {
  const d = jd - 2451545.0;
  const g = 357.529 + 0.98560028 * d;
  const q = 280.459 + 0.98564736 * d;
  const l = q + 1.915 * Math.sin(dtr(g)) + 0.02 * Math.sin(dtr(2 * g));
  const e = 23.439 - 0.00000036 * d;
  return rtd(Math.asin(Math.sin(dtr(e)) * Math.sin(dtr(l))));
}

function sunsetHoursFromNoon(lat: number, dec: number): number {
  const x =
    (Math.sin(dtr(-0.833)) - Math.sin(dtr(lat)) * Math.sin(dtr(dec))) /
    (Math.cos(dtr(lat)) * Math.cos(dtr(dec)));
  if (x <= -1) return 12;
  if (x >= 1) return 0;
  return rtd(Math.acos(x)) / 15;
}

function localSolarNoon(iso: string, city: string, country: string): { hours: number; lat: number; turkey: boolean } | null {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  const place = placeFor(city, country);
  const tz = zoneOffsetHours(iso, place.tz);
  const jd = julian(year, month, day) - place.lng / (15 * 24);
  const noon = fixHour(12 - equationOfTime(jd));
  const hours = noon + tz - place.lng / 15;
  const turkey = fold(country) === 'turkey' || place.tz === 'Europe/Istanbul';
  return { hours, lat: place.lat, turkey };
}

export function computeDhuhr(iso: string, city: string, country: string): string {
  const local = localSolarNoon(iso, city, country);
  if (!local) return '';
  const offsetMin = local.turkey ? 5 : 0;
  return formatHour(local.hours + offsetMin / 60);
}

export function computeMaghrib(iso: string, city: string, country: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return '';
  const local = localSolarNoon(iso, city, country);
  if (!local) return '';
  const place = placeFor(city, country);
  const jd = julian(year, month, day) - place.lng / (15 * 24);
  const ha = sunsetHoursFromNoon(local.lat, sunDeclination(jd));
  const extra = local.turkey ? 3 : 0;
  return formatHour(local.hours + ha + extra / 60);
}

export function kickoffHijri(
  isoDate: string,
  time: string,
  city: string,
  country: string,
): { hijri: HijriParts | null; maghribTime: string } {
  const maghribTime = computeMaghrib(isoDate, city, country);
  const base = isoToHijri(isoDate);
  if (!base) return { hijri: null, maghribTime };
  const kickoff = time.slice(0, 5);
  if (kickoff && maghribTime && kickoff >= maghribTime) {
    const [day, month, year] = addHijriDays(base.day, base.month, base.year, 1);
    return { hijri: hijriParts(day, month, year), maghribTime };
  }
  return { hijri: base, maghribTime };
}

export async function attachJumuaTimes(rows: JumuaPlace[]): Promise<void> {
  for (const row of rows) {
    if (row.jumuaDate && !row.jumuaTime) {
      row.jumuaTime = computeDhuhr(row.jumuaDate, row.city || '', row.country || '');
    }
    const maghribDay = row.gregorianDate || '';
    if (maghribDay && !row.maghribTime) {
      row.maghribTime = computeMaghrib(maghribDay, row.city || '', row.country || '');
    }
  }
}
