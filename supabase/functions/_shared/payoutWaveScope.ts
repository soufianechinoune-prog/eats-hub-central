export const WAVE_CHAIN = 'ce67f809-d017-41c5-8bd0-a98086cd3881';
export const EXCLUDED_STORES = ['a7d5bd5a-0225-50a0-8ffb-78162ae651e7', 'c3eee44c-0a67-5bda-9020-df3fdf328371', '37b27fc0-bb7e-5c2e-abd0-48dd5471d2c4'];
export const MAX_REQUESTS = 3;
export const REFUSAL_LIMIT = 3;
export function uberApiAccessAllowed(granted: boolean | null | undefined) {
  return granted === true;
}
export function waveLineAllowed(chain: string, store: string, date: string | null) {
  return chain === WAVE_CHAIN && !EXCLUDED_STORES.includes(store) && date !== null && date >= '2025-12-01' && date <= '2026-11-15';
}