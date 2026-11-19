import { describe, it, expect } from 'vitest';
import { WAVE_CHAIN, CHICKEN_WAVE_CHAIN, EXCLUDED_STORES, waveLineAllowed, MAX_REQUESTS, uberApiAccessAllowed, rateLimitBackoffMs, countsAsRefusal, waveRequestReadyToStage } from '../../supabase/functions/_shared/payoutWaveScope';
describe('Tasty payout wave', () => {
  it('stages a complete collected report even while other windows remain queued', () => {
    const requests = ['collected', 'queued', 'awaiting_access', 'received', 'collecting', 'completed'];
    expect(requests.filter(waveRequestReadyToStage)).toEqual(['collected']);
  });
  it('never dispatches a restaurant with RPC status refuse', () => {
    expect(uberApiAccessAllowed('refuse')).toBe(false);
    expect(uberApiAccessAllowed('ok')).toBe(true);
    expect(uberApiAccessAllowed('silencieux')).toBe(true);
    expect(uberApiAccessAllowed('non_configure')).toBe(false);
    expect(uberApiAccessAllowed(undefined)).toBe(false);
    expect(uberApiAccessAllowed(null)).toBe(false);
  });
  it('accepts only the approved date range', () => {
    expect(waveLineAllowed(WAVE_CHAIN, 'remaining', '2025-12-01')).toBe(true);
    expect(waveLineAllowed(WAVE_CHAIN, 'remaining', '2026-11-15')).toBe(true);
    expect(waveLineAllowed(WAVE_CHAIN, 'remaining', '2025-11-30')).toBe(false);
    expect(waveLineAllowed(WAVE_CHAIN, 'remaining', '2026-11-16')).toBe(false);
  });
  it('excludes pilot stores and other chains', () => {
    for (const store of EXCLUDED_STORES) expect(waveLineAllowed(WAVE_CHAIN, store, '2026-06-01')).toBe(false);
    expect(waveLineAllowed(CHICKEN_WAVE_CHAIN, 'remaining', '2026-06-01')).toBe(true);
    expect(waveLineAllowed('a9e46481-d1e7-4f9c-bb70-02af281048e6', 'remaining', '2026-06-01')).toBe(false);
  });
  it('treats 429 as rate limiting with 15/30/60 min backoff, only 403 counts as refusal', () => {
    expect(countsAsRefusal(429)).toBe(false);
    expect(countsAsRefusal(403)).toBe(true);
    expect(rateLimitBackoffMs(1)).toBe(15 * 60000);
    expect(rateLimitBackoffMs(2)).toBe(30 * 60000);
    expect(rateLimitBackoffMs(3)).toBe(60 * 60000);
    expect(rateLimitBackoffMs(9)).toBe(60 * 60000);
  });
  it('recognizes user_not_allowed regardless of HTTP code', () => {
    expect(countsAsRefusal(400, { code: 'user_not_allowed' })).toBe(true);
    expect(countsAsRefusal(500, { code: 'temporary_error' })).toBe(false);
  });
  it('enforces the Chicken Street period boundaries', () => {
    expect(waveLineAllowed(CHICKEN_WAVE_CHAIN, 'store', '2025-12-01')).toBe(true);
    expect(waveLineAllowed(CHICKEN_WAVE_CHAIN, 'store', '2026-11-15')).toBe(true);
    expect(waveLineAllowed(CHICKEN_WAVE_CHAIN, 'store', '2025-11-30')).toBe(false);
    expect(waveLineAllowed(CHICKEN_WAVE_CHAIN, 'store', '2026-11-16')).toBe(false);
  });
  it('caps requests at two per minute', () => {
    expect(MAX_REQUESTS).toBe(2);
  });
});