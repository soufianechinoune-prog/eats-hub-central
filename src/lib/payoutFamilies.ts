import type { SignedPayoutLine } from './payoutSignedReconciliation';

export type PayoutFamily = 'other_payments' | 'advertising' | 'tax_rounding' | 'marketing_adjustment' | 'garnishment';

/** Reporting families do not certify any generic payment as eco-contribution. */
export function payoutFamily(line: Pick<SignedPayoutLine, 'description' | 'category'>): PayoutFamily {
  const description = line.description.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (line.category === 'advertising' || /publicit|advertis/.test(description)) return 'advertising';
  if (line.category === 'tax_rounding' || /arrondi|rounding/.test(description)) return 'tax_rounding';
  if (line.category === 'marketing_adjustment') return 'marketing_adjustment';
  if (/saisie.arret|garnish/.test(description)) return 'garnishment';
  return 'other_payments';
}

/** Each family and sign is reconciled independently; detailed source lines remain available. */
export function reconcilePayoutFamilies(oldLines: SignedPayoutLine[], apiLines: SignedPayoutLine[]) {
  const group = (lines: SignedPayoutLine[]) => {
    const result = new Map<string, { restaurantId: string; payoutReference: string; family: PayoutFamily; direction: number; cents: number; lines: SignedPayoutLine[] }>();
    for (const line of lines) {
      const family = payoutFamily(line), direction = Math.sign(line.amount);
      const key = JSON.stringify([line.restaurantId, line.payoutReference, family, direction]);
      const row = result.get(key) ?? { restaurantId: line.restaurantId, payoutReference: line.payoutReference, family, direction, cents: 0, lines: [] };
      row.cents += Math.round(line.amount * 100);
      row.lines.push(line);
      result.set(key, row);
    }
    return result;
  };
  const old = group(oldLines), api = group(apiLines);
  return [...new Set([...old.keys(), ...api.keys()])].map(key => {
    const before = old.get(key), after = api.get(key), identity = before ?? after;
    if (!identity) throw new Error('Missing reconciliation group');
    return { restaurantId: identity.restaurantId, payoutReference: identity.payoutReference,
      family: identity.family, direction: identity.direction,
      oldCents: before?.cents ?? null, newCents: after?.cents ?? null,
      deltaCents: (after?.cents ?? 0) - (before?.cents ?? 0),
      oldLines: before?.lines ?? [], newLines: after?.lines ?? [],
      cause: !before ? 'missing_legacy' : !after ? 'missing_api' : before.cents === after.cents ? 'concordant' : 'amount_difference' };
  });
}