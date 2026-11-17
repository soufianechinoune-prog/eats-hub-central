import { describe, it, expect } from 'vitest';
import { PILOT_STORES, PILOT_WINDOWS, pilotLineAllowed, pilotWindowAllowed } from '../../supabase/functions/_shared/payoutPilotScope';
describe('approved three-store payout pilot', () => {
  const store = 'a7d5bd5a-0225-50a0-8ffb-78162ae651e7';
  const restaurant = 'f2345ce0-fe43-4903-a259-acc86a6e67a9';
  it('limits the initial plan to 18 requests', () => {
    expect(Object.keys(PILOT_STORES)).toHaveLength(3);
    expect(PILOT_WINDOWS).toHaveLength(6);
    expect(Object.keys(PILOT_STORES).length * PILOT_WINDOWS.length).toBe(18);
  });
  it('keeps June 1 and November 15 inclusive and excludes dates outside them', () => {
    expect(pilotLineAllowed(store, restaurant, '2026-06-01')).toBe(true);
    expect(pilotLineAllowed(store, restaurant, '2026-11-15')).toBe(true);
    expect(pilotLineAllowed(store, restaurant, '2026-05-31')).toBe(false);
    expect(pilotLineAllowed(store, restaurant, '2026-11-16')).toBe(false);
    expect(pilotLineAllowed(store, restaurant, null)).toBe(false);
  });
  it('never accepts another store or restaurant', () => {
    expect(pilotLineAllowed(store, 'other-restaurant', '2026-09-14')).toBe(false);
    expect(pilotWindowAllowed('network-store', '2026-06-01', '2026-06-30')).toBe(false);
  });
  it('covers the whole interval with six windows no longer than 30 days', () => {
    let previous = Date.parse('2026-05-31');
    for (const [start, end] of PILOT_WINDOWS) {
      expect(Date.parse(start) - previous).toBe(86400000);
      expect((Date.parse(end) - Date.parse(start)) / 86400000 + 1).toBeLessThanOrEqual(30);
      expect(pilotWindowAllowed(store, start, end)).toBe(true);
      previous = Date.parse(end);
    }
    expect(previous).toBe(Date.parse('2026-11-15'));
  });
});