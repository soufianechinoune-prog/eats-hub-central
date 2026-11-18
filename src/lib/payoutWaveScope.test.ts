import { describe, it, expect } from 'vitest';
import { WAVE_CHAIN, EXCLUDED_STORES, waveLineAllowed, MAX_REQUESTS, REFUSAL_LIMIT, uberApiAccessAllowed } from '../../supabase/functions/_shared/payoutWaveScope';
describe('Tasty payout wave', () => {
  it('never dispatches a restaurant marked without Uber API access', () => {
    expect(uberApiAccessAllowed(false)).toBe(false);
    expect(uberApiAccessAllowed(true)).toBe(true);
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
    expect(waveLineAllowed('110e05b8-5136-45cc-a385-265360104844', 'remaining', '2026-06-01')).toBe(false);
    expect(waveLineAllowed('a9e46481-d1e7-4f9c-bb70-02af281048e6', 'remaining', '2026-06-01')).toBe(false);
  });
  it('caps requests at three and stops at three consecutive refusals', () => {
    expect(MAX_REQUESTS).toBe(3);
    expect(REFUSAL_LIMIT).toBe(3);
  });
});