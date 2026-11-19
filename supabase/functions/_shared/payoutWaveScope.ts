export const WAVE_CHAIN = 'ce67f809-d017-41c5-8bd0-a98086cd3881';
export const CHICKEN_WAVE_CHAIN = '110e05b8-5136-45cc-a385-265360104844';
export function waveChainAllowed(chain: string) {
  return chain === WAVE_CHAIN || chain === CHICKEN_WAVE_CHAIN;
}
export const EXCLUDED_STORES = ['a7d5bd5a-0225-50a0-8ffb-78162ae651e7', 'c3eee44c-0a67-5bda-9020-df3fdf328371', '37b27fc0-bb7e-5c2e-abd0-48dd5471d2c4'];
export const MAX_REQUESTS = 2;
// Each collected request has already validated every report section.
export function waveRequestReadyToStage(status: string) {
  return status === 'collected';
}
export function uberApiAccessAllowed(status: string | null | undefined) {
  return status === 'ok' || status === 'silencieux';
}
export function waveLineAllowed(chain: string, store: string, date: string | null) {
  return waveChainAllowed(chain) && (chain !== WAVE_CHAIN || !EXCLUDED_STORES.includes(store)) && date !== null && date >= '2025-12-01' && date <= '2026-11-15';
}
// 429 is rate limiting, never a refusal: back off 15, 30, then 60 minutes and retry.
export function rateLimitBackoffMs(streak: number) {
  return [15, 30, 60][Math.min(Math.max(streak, 1), 3) - 1] * 60000;
}
// Access refusals only park the affected request; they never stop the wave.
export function countsAsRefusal(status: number, result: unknown = null) {
  return status === 403 || /user_not_allowed/i.test(JSON.stringify(result) ?? '');
}
