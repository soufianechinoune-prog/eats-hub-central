import { describe, expect, it } from 'vitest';
import { reconcileSignedPayouts, type SignedPayoutLine } from './payoutSignedReconciliation';

const line = (amount: number, description = 'Autres frais', restaurantId = 'Angers'): SignedPayoutLine =>
  ({ restaurantId, payoutReference: '2026-01', description, category: 'eco_contribution', amount });

describe('Signed bidirectional payout reconciliation', () => {
  it('never tolerates a real one-cent discrepancy', () => {
    expect(reconcileSignedPayouts([line(-26.89)], [line(-26.90)])[0])
      .toMatchObject({ oldCents: -2689, newCents: -2690, deltaCents: -1, cause: 'amount_difference' });
  });
  it('reports old charges missing from API with a positive delta', () => {
    expect(reconcileSignedPayouts([line(-26.89)], [])[0]).toMatchObject({ cause: 'missing_api', deltaCents: 2689 });
  });
  it('reports API refunds absent from the old import', () => {
    expect(reconcileSignedPayouts([], [line(26.89)])[0]).toMatchObject({ cause: 'missing_legacy', deltaCents: 2689 });
  });
  it('preserves negative delta for an API-only charge', () => {
    expect(reconcileSignedPayouts([], [line(-26.89)])[0].deltaCents).toBe(-2689);
  });
  it('preserves negative delta for an old-only refund', () => {
    expect(reconcileSignedPayouts([line(26.89)], [])[0].deltaCents).toBe(-2689);
  });
  it('never treats equal signed net totals as concordance', () => {
    const rows = reconcileSignedPayouts([line(-26.89), line(26.89)], []);
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.cause === 'missing_api')).toBe(true);
  });
  it('matches a split aggregate exactly at the cent', () => {
    expect(reconcileSignedPayouts([line(-199.73)], [line(-76.65), line(-41.43), line(-81.21), line(-0.44)])[0])
      .toMatchObject({ cause: 'concordant', oldCents: -19973, newCents: -19973, deltaCents: 0 });
  });
  it('does not compensate discrepancies across restaurants', () => {
    expect(reconcileSignedPayouts([line(-26.89)], [line(-26.89, 'Autres frais', 'Colombes')])
      .map(r => r.cause).sort()).toEqual(['missing_api', 'missing_legacy']);
  });
  it('requires matching refund and charge separately', () => {
    expect(reconcileSignedPayouts([line(-10), line(2)], [line(-9), line(1)]).map(r => r.cause))
      .toEqual(['amount_difference', 'amount_difference']);
  });
  it('reports changed categories as classification discrepancies, not missing lines', () => {
    const api = { ...line(0.37), category: 'tax_rounding' };
    const old = { ...line(0.37), category: 'adjustment' };
    expect(reconcileSignedPayouts([old], [api])).toMatchObject([
      { cause: 'classification_difference', deltaCents: 0, oldCents: 37, newCents: 37 },
    ]);
  });
});