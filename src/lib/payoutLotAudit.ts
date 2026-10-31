export interface FamilyAuditRow {
  restaurantId: string;
  payoutReference: string;
  family: string;
  direction: number;
  oldCents: number | null;
  newCents: number | null;
  covered: boolean;
}

export function familyAuditCause(row: FamilyAuditRow) {
  if (!row.covered) return 'coverage_not_established';
  if (row.oldCents === null) return 'missing_legacy';
  if (row.newCents === null) return 'missing_api';
  return row.newCents === row.oldCents ? 'concordant' : 'amount_difference';
}

/** Prevalence denominator includes all covered payouts, including those without advertising. */
export function advertisingAudit(rows: FamilyAuditRow[]) {
  const payouts = new Map<string, { covered: boolean; oldCents: number; newCents: number }>();
  for (const row of rows) {
    const key = JSON.stringify([row.restaurantId, row.payoutReference]);
    const payout = payouts.get(key) ?? { covered: true, oldCents: 0, newCents: 0 };
    payout.covered &&= row.covered;
    if (row.family === 'advertising') {
      payout.oldCents += row.oldCents ?? 0;
      payout.newCents += row.newCents ?? 0;
    }
    payouts.set(key, payout);
  }
  const comparable = [...payouts.values()].filter(p => p.covered);
  const gaps = comparable.map(p => p.oldCents - p.newCents);
  return {
    comparablePayouts: comparable.length,
    affectedPayouts: gaps.filter(c => c > 0).length,
    understatedCents: gaps.reduce((sum, c) => sum + Math.max(c, 0), 0),
    overstatedCents: gaps.reduce((sum, c) => sum + Math.max(-c, 0), 0),
    netCorrectionCents: gaps.reduce((sum, c) => sum + c, 0),
  };
}