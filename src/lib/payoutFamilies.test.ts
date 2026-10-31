import { describe, expect, it } from 'vitest';
import { payoutFamily, reconcilePayoutFamilies } from './payoutFamilies';
import type { SignedPayoutLine } from './payoutSignedReconciliation';
const line = (amount: number, category = 'eco_contribution', description = 'Autres frais'): SignedPayoutLine =>
  ({ restaurantId: 'Angers', payoutReference: '02/02', amount, category, description });

describe('independent signed payout families', () => {
  it('isolates the actual February 2 eco family from advertising discrepancies', () => {
    const result = reconcilePayoutFamilies(
      [line(-205.94), line(-27.49, 'advertising', 'Dépenses publicitaires'), line(0.22, 'adjustment', "Ajustement lié à l'arrondissement de la TVA")],
      [line(-108.09), line(-97.85), ...[-46.18, -25.38, -28.07, -28.68, -27.05, -27.49, -24.4].map(a => line(a, 'advertising', 'Dépenses publicitaires')),
        line(0.22, 'tax_rounding', "Ajustement lié à l'arrondissement de la TVA")]);
    expect(result.find(r => r.family === 'other_payments')).toMatchObject({ oldCents: -20594, newCents: -20594, deltaCents: 0, cause: 'concordant' });
    expect(result.find(r => r.family === 'advertising')).toMatchObject({ oldCents: -2749, newCents: -20725, deltaCents: -17976 });
    expect(result.find(r => r.family === 'tax_rounding')).toMatchObject({ deltaCents: 0, cause: 'concordant' });
  });
  it('does not hide bidirectional missing charges and refunds behind a zero net', () => {
    const result = reconcilePayoutFamilies([line(-10)], [line(10)]);
    expect(result.map(r => [r.cause, r.deltaCents])).toEqual([['missing_api', 1000], ['missing_legacy', 1000]]);
  });
  it('keeps garnishment and marketing outside the other-payments family', () => {
    expect(payoutFamily(line(-65.49, 'other_fee', 'Saisie-arrêt'))).toBe('garnishment');
    expect(payoutFamily(line(228.98, 'marketing_adjustment'))).toBe('marketing_adjustment');
  });
});