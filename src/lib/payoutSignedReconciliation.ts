export interface SignedPayoutLine {
  restaurantId: string;
  payoutReference: string;
  description: string;
  category: string;
  amount: number;
}

/** Mirrors the SQL grouping: charges and refunds cannot cancel or hide missing movements. */
export function reconcileSignedPayouts(oldLines: SignedPayoutLine[], apiLines: SignedPayoutLine[]) {
  const group = (lines: SignedPayoutLine[]) => {
    const result = new Map<string, { cents: number; count: number }>();
    for (const line of lines) {
      const key = JSON.stringify([line.restaurantId, line.payoutReference, line.description,
        line.category, Math.sign(line.amount)]);
      const current = result.get(key) || { cents: 0, count: 0 };
      current.cents += Math.round(line.amount * 100);
      current.count++;
      result.set(key, current);
    }
    return result;
  };
  const old = group(oldLines), api = group(apiLines);
  return [...new Set([...old.keys(), ...api.keys()])].map(key => {
    const before = old.get(key), after = api.get(key);
    return { key, oldCents: before?.cents ?? null, newCents: after?.cents ?? null,
      deltaCents: (after?.cents || 0) - (before?.cents || 0),
      cause: !before ? 'missing_legacy' : !after ? 'missing_api' :
        before.cents === after.cents ? 'concordant' : 'amount_difference' };
  });
}