/**
 * The backend speaks UTC (`...Z`); the panel shows and asks for Tashkent time. Tashkent has no daylight saving (UTC+5 all year),
 * so a fixed offset is exact.
 */
export const TASHKENT_OFFSET = '+05:00';
export const TASHKENT_ZONE = 'Asia/Tashkent';

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-10-23T14:30` typed in a datetime-local field (Tashkent) → `2026-10-23T09:30:00.000Z` for the API. */
export function tashkentInputToUtcIso(value: string): string {
  const withSeconds = /T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
  return new Date(`${withSeconds}${TASHKENT_OFFSET}`).toISOString();
}

/** `2026-10-23T09:30:00Z` → `2026-10-23T14:30` for a datetime-local field. */
export function utcIsoToTashkentInput(iso: string): string {
  const shifted = new Date(Date.parse(iso) + 5 * 3_600_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** The first instant of a Tashkent calendar day (`2026-10-23`), as UTC ISO. */
export function startOfTashkentDayUtc(date: string): string {
  return new Date(`${date}T00:00:00${TASHKENT_OFFSET}`).toISOString();
}

/** The last millisecond of a Tashkent calendar day, as UTC ISO. */
export function endOfTashkentDayUtc(date: string): string {
  return new Date(`${date}T23:59:59.999${TASHKENT_OFFSET}`).toISOString();
}

/** A JavaScript Date picked in a calendar (local machine) → `yyyy-MM-dd` of that calendar day. */
export function calendarDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `dd.MM.yyyy HH:mm` in Tashkent time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = tashkentParts(iso);
  return `${t.day}.${t.month}.${t.year} ${t.hour}:${t.minute}`;
}

/** `dd.MM.yyyy` in Tashkent time. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = tashkentParts(iso);
  return `${t.day}.${t.month}.${t.year}`;
}

function tashkentParts(iso: string) {
  const shifted = new Date(Date.parse(iso) + 5 * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: pad(shifted.getUTCMonth() + 1),
    day: pad(shifted.getUTCDate()),
    hour: pad(shifted.getUTCHours()),
    minute: pad(shifted.getUTCMinutes()),
  };
}
