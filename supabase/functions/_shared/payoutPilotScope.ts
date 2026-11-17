export const PILOT_STORES: Record<string, string> = {
  'a7d5bd5a-0225-50a0-8ffb-78162ae651e7': 'f2345ce0-fe43-4903-a259-acc86a6e67a9',
  'c3eee44c-0a67-5bda-9020-df3fdf328371': 'a7c4d67f-cbba-417b-ad4c-97e7d46a7287',
  '37b27fc0-bb7e-5c2e-abd0-48dd5471d2c4': '599ca4a2-7bd4-4dbb-a01a-667a0e876722',
};
export const PILOT_WINDOWS = [
  ['2026-06-01', '2026-06-30'], ['2026-07-01', '2026-07-30'],
  ['2026-07-31', '2026-08-29'], ['2026-08-30', '2026-09-28'],
  ['2026-09-29', '2026-10-28'], ['2026-10-29', '2026-11-15'],
] as const;
export function pilotLineAllowed(store: string, restaurant: string, date: string | null) {
  return PILOT_STORES[store] === restaurant && date !== null && date >= '2026-06-01' && date <= '2026-11-15';
}
export function pilotWindowAllowed(store: string, start: string, end: string) {
  return !!PILOT_STORES[store] && PILOT_WINDOWS.some(w => w[0] === start && w[1] === end);
}
export function pilotDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${(m[3].length === 2 ? m[1] : m[2]).padStart(2, '0')}-${(m[3].length === 2 ? m[2] : m[1]).padStart(2, '0')}`;
}