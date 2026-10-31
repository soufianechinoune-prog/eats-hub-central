import { describe, expect, it } from 'vitest';
import { classifyEcoLine, resolveEcoNeighbours, matchEcoMirrors, observeEcoTransition,
  type EcoSourceLine } from '../../supabase/functions/_shared/ecoReconciliation';
const rates = [
  { code: 'observed_1130', units: 1130, start: '2024-01-01', end: '2025-12-31' },
  { code: 'observed_1363', units: 1363, start: '2025-01-01', end: '2026-12-31' },
  { code: 'observed_1381', units: 1381, start: '2025-01-01', end: '2026-12-31' },
];
const line = (overrides: Partial<EcoSourceLine> = {}): EcoSourceLine => ({ id: 'a', restaurantId: 'r',
  date: '2025-09-15', amount: -26.89, volume: 238, sourceKey: 'raw', eligible: true,
  periodStart: '2024-09-09', periodEnd: '2024-09-15', ...overrides });
const classify = (overrides: Partial<EcoSourceLine>) => classifyEcoLine(line(overrides), rates);
describe('eco precise screening', () => {
  it('accepts 238 × 0.1130 = 26.894 displayed as 26.89', () => {
    expect(classify({}).candidates).toEqual([{ code: 'observed_1130', units: 1130, orders: 238, residualUnits: 40 }]);
  });
  it('uses the inclusive €0.01 boundary', () => {
    const r = [{ code: 'test', units: 1000, start: '2024-01-01', end: '2026-12-31' }];
    expect(classifyEcoLine(line({ amount: -23.81 }), r).status).toBe('candidate');
    expect(classifyEcoLine(line({ amount: -23.82 }), r).status).toBe('needs_review');
  });
  it('excludes below €5, including explicit eco labels', () => {
    expect(classify({ amount: -4.99 }).reason).toBe('below_5_euros');
    expect(classify({ amount: -5, volume: 44 }).reason).not.toBe('below_5_euros');
  });
  it('requires real volume within inclusive ±10 percent', () => {
    expect(classify({ volume: 0 }).reason).toBe('missing_payout_volume');
    expect(classify({ volume: 200 }).status).toBe('needs_review');
    expect(classify({ amount: -24.86, volume: 200 }).status).toBe('candidate'); // 220 orders
  });
  it('never screens a merged legacy total as an individual source record', () => {
    expect(classify({ sourceKey: null }).reason).toBe('legacy_aggregate');
  });
  it('does not use refund-payment volume for an unknown contribution period', () => {
    expect(classify({ amount: 26.89, periodStart: null, periodEnd: null }).reason).toBe('refund_period_unknown');
  });
});
describe('ambiguous tariffs and observed transition', () => {
  // €10.22 fits BOTH: 75 × .1363 = 10.2225 ; 74 × .1381 = 10.2194.
  const ambiguous = (id: string, start: string) => classify({ id, amount: -10.22, volume: 75,
    periodStart: start, periodEnd: start });
  const anchor = (id: string, start: string, amount: number, volume: number) => classify({ id,
    periodStart: start, periodEnd: start, amount, volume });
  it('retains eco status but does not choose by nearest residual or volume', () => {
    const a = ambiguous('a', '2025-09-01');
    expect(a.candidates.map(c => c.code)).toEqual(['observed_1363', 'observed_1381']);
    expect(a.status).toBe('candidate'); expect(a.rate).toBeNull();
  });
  it('resolves an ambiguous week between matching independent neighbours', () => {
    const result = resolveEcoNeighbours([anchor('before', '2025-08-01', -68.15, 500),
      ambiguous('a', '2025-09-01'), anchor('after', '2025-10-01', -68.15, 500)]);
    expect(result[1].rate).toBe('observed_1363'); expect(result[1].attribution).toBe('neighbours');
  });
  it('leaves ambiguity across the switch to confirm and excludes it from the date', () => {
    const result = resolveEcoNeighbours([anchor('before', '2025-08-01', -68.15, 500),
      ambiguous('a', '2025-09-01'), anchor('after', '2025-10-01', -69.05, 500)]);
    expect(result[1].rate).toBeNull(); expect(observeEcoTransition(result).exactDate).toBeNull();
    expect(observeEcoTransition(result).unresolved).toBe(1);
  });
  it('does not hide a back-and-forth contradiction or change its unique anchors', () => {
    const result = resolveEcoNeighbours([anchor('new', '2025-08-01', -69.05, 500),
      ambiguous('a', '2025-09-01'), anchor('old', '2025-10-01', -68.15, 500)]);
    expect(result[1].rate).toBeNull(); expect(observeEcoTransition(result).contradictions).toBe(1);
  });
  it('never borrows anchors from another restaurant', () => {
    const a = ambiguous('a', '2025-09-01');
    const other = { ...anchor('other', '2025-10-01', -68.15, 500), restaurantId: 'other' };
    expect(resolveEcoNeighbours([a, other])[0].rate).toBeNull();
  });
});
describe('documented mirror matching', () => {
  it('matches identical cents and original period once, never reuses a refund', () => {
    const charge = classify({}); const refund = classify({ id: 'b', date: '2025-10-01', amount: 26.89 });
    expect(matchEcoMirrors([charge, refund]).pairs).toEqual([{ chargeId: 'a', refundId: 'b', cents: 2689 }]);
    expect(matchEcoMirrors([charge, { ...charge, id: 'duplicate' }, refund]).pairs).toEqual([]);
  });
  it('does not claim the expected Angers net proves repayment of any week', () => {
    const expectedNetCents = 110838 - 122646;
    expect(expectedNetCents).toBe(-11808);
    const charge = classify({}); const refund = classify({ id: 'b', amount: 26.89, periodStart: '2024-10-01' });
    expect(matchEcoMirrors([charge, refund]).pairs).toEqual([]);
  });
});