import { describe, expect, it } from 'vitest';
import { advertisingAudit, familyAuditCause, type FamilyAuditRow } from './payoutLotAudit';
const row = (overrides: Partial<FamilyAuditRow> = {}): FamilyAuditRow => ({
  restaurantId: 'Angers', payoutReference: '02/02', family: 'advertising', direction: -1,
  oldCents: -2749, newCents: -20725, covered: true, ...overrides,
});
describe('bounded payout lot audit', () => {
  it('keeps a one-cent discrepancy distinct from concordance', () => {
    expect(familyAuditCause(row({ oldCents: -1000, newCents: -1001 }))).toBe('amount_difference');
    expect(familyAuditCause(row({ oldCents: -1000, newCents: -1000 }))).toBe('concordant');
  });
  it('does not call an uncovered API absence a financial missing movement', () => {
    expect(familyAuditCause(row({ covered: false, newCents: null }))).toBe('coverage_not_established');
  });
  it('retains both signed directions of missing movements', () => {
    expect(familyAuditCause(row({ oldCents: null }))).toBe('missing_legacy');
    expect(familyAuditCause(row({ newCents: null }))).toBe('missing_api');
  });
  it('finds the exact Angers advertising shortfall without netting unrelated families', () => {
    expect(advertisingAudit([row(), row({ family: 'other_payments', oldCents: -20594, newCents: -20594 })]))
      .toMatchObject({ understatedCents: 17976, affectedPayouts: 1, comparablePayouts: 1 });
  });
  it('uses all covered payouts as the denominator, not just advertising payouts', () => {
    expect(advertisingAudit([row(), row({ payoutReference: 'next', family: 'other_payments' }),
      row({ payoutReference: 'uncovered', covered: false })]).comparablePayouts).toBe(2);
  });
  it('nets advertising credits separately from positive-only understatement', () => {
    expect(advertisingAudit([row(), row({ direction: 1, oldCents: 0, newCents: 17976 })]))
      .toMatchObject({ understatedCents: 0, affectedPayouts: 0, netCorrectionCents: 0 });
  });
});