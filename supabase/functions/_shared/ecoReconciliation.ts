/** Integer units: amounts are cents, rates are ten-thousandths of a euro.
 * Candidate detection never establishes VAT treatment or official tariffs.
 */
export interface EcoRateWindow {
  code: string;
  units: number;
  start: string;
  end: string;
}
export interface EcoSourceLine {
  id: string;
  restaurantId: string;
  date: string;
  amount: number;
  sourceKey: string | null;
  eligible: boolean;
  volume: number | null;
  /** Only a documented contribution period, never the payment date. */
  periodStart?: string | null;
  periodEnd?: string | null;
}
export interface EcoCandidate { code: string; units: number; orders: number; residualUnits: number }
export interface EcoClassification extends EcoSourceLine {
  status: 'candidate' | 'excluded' | 'needs_review';
  reason: string;
  candidates: EcoCandidate[];
  rate: string | null;
  attribution: 'unique' | 'neighbours' | 'to_confirm' | null;
}
export const ECO_MIN_CENTS = 500;
export const ECO_TOLERANCE_UNITS = 100; // €0.01

export function classifyEcoLine(line: EcoSourceLine, rates: EcoRateWindow[]): EcoClassification {
  const base: EcoClassification = { ...line, status: 'needs_review', reason: '', candidates: [], rate: null, attribution: null };
  if (!Number.isFinite(line.amount) || !line.eligible) return { ...base, status: 'excluded', reason: 'unrelated_category' };
  const cents = Math.round(Math.abs(line.amount) * 100);
  if (cents < ECO_MIN_CENTS) return { ...base, status: 'excluded', reason: 'below_5_euros' };
  if (!line.sourceKey) return { ...base, reason: 'legacy_aggregate' };
  if (!line.volume || !Number.isInteger(line.volume) || line.volume < 1) return { ...base, reason: 'missing_payout_volume' };
  // Positive corrections often cover other weeks/years. Do not borrow the current payout's volume.
  if (line.amount > 0 && (!line.periodStart || !line.periodEnd)) return { ...base, reason: 'refund_period_unknown' };
  const start = line.periodStart || line.date;
  const end = line.periodEnd || line.date;
  const candidates = rates.filter(r => r.start <= end && r.end >= start).flatMap(r => {
    const orders = Math.round(cents * 100 / r.units);
    const residualUnits = Math.abs(cents * 100 - orders * r.units);
    const valid = orders > 0 && residualUnits <= ECO_TOLERANCE_UNITS &&
      Math.abs(orders - line.volume) * 10 <= line.volume;
    return valid ? [{ code: r.code, units: r.units, orders, residualUnits }] : [];
  });
  if (!candidates.length) return { ...base, reason: 'no_rate_with_matching_volume' };
  return { ...base, candidates, status: 'candidate', reason: 'rounded_multiple_and_volume',
    rate: candidates.length === 1 ? candidates[0].code : null,
    attribution: candidates.length === 1 ? 'unique' : 'to_confirm' };
}

/** Only independent, negative weekly observations can constrain an ambiguous tariff.
 * Solve all monotone paths, not greedy nearest-neighbour guesses. Contradictory anchors stay visible.
 */
export function resolveEcoNeighbours(lines: EcoClassification[]): EcoClassification[] {
  const output = lines.map(l => ({ ...l }));
  const restaurants = new Set(output.map(l => l.restaurantId));
  for (const restaurantId of restaurants) {
    const group = output.filter(l => l.restaurantId === restaurantId && l.status === 'candidate' &&
      l.amount < 0 && l.periodStart && l.periodEnd).sort((a, b) =>
        (a.periodStart || '').localeCompare(b.periodStart || '') || a.id.localeCompare(b.id));
    const weekly = new Map<string, EcoClassification[]>();
    for (const line of group) {
      const key = `${line.periodStart}/${line.periodEnd}`;
      weekly.set(key, [...(weekly.get(key) || []), line]);
    }
    const buckets = [...weekly.values()];
    const options = buckets.map(bucket => bucket[0].candidates.map(c => c.units)
      .filter(u => bucket.every(l => l.candidates.some(c => c.units === u))));
    const forward: Set<number>[] = [];
    for (let i = 0; i < options.length; i++) {
      forward.push(new Set(options[i].filter(u => i === 0 || [...forward[i - 1]].some(p => p <= u))));
    }
    const backward: Set<number>[] = Array.from({ length: options.length }, () => new Set<number>());
    for (let i = options.length - 1; i >= 0; i--) {
      backward[i] = new Set(options[i].filter(u => i === options.length - 1 || [...backward[i + 1]].some(n => n >= u)));
    }
    for (let i = 0; i < buckets.length; i++) {
      const viable = [...forward[i]].filter(u => backward[i].has(u));
      for (const line of buckets[i]) {
        if (line.candidates.length === 1) continue;
        const chosen = viable.length === 1 ? line.candidates.find(c => c.units === viable[0]) : undefined;
        if (chosen) { line.rate = chosen.code; line.attribution = 'neighbours'; }
        else { line.rate = null; line.attribution = 'to_confirm'; }
      }
    }
  }
  return output;
}

export interface EcoMirrorPair { chargeId: string; refundId: string; cents: number }
/** Exact documented period + amount + restaurant. Ambiguous groups are not greedily netted. */
export function matchEcoMirrors(lines: EcoClassification[]) {
  const pairs: EcoMirrorPair[] = [];
  const candidates = lines.filter(l => l.status === 'candidate' && l.periodStart && l.periodEnd);
  const used = new Set<string>();
  for (const charge of candidates.filter(l => l.amount < 0)) {
    const same = (l: EcoClassification) => l.restaurantId === charge.restaurantId &&
      l.periodStart === charge.periodStart && l.periodEnd === charge.periodEnd &&
      Math.round(Math.abs(l.amount) * 100) === Math.round(Math.abs(charge.amount) * 100);
    const charges = candidates.filter(l => l.amount < 0 && same(l));
    const refunds = candidates.filter(l => l.amount > 0 && same(l) && l.date >= charge.date);
    if (charges.length !== 1 || refunds.length !== 1 || used.has(refunds[0].id)) continue;
    used.add(refunds[0].id);
    pairs.push({ chargeId: charge.id, refundId: refunds[0].id, cents: Math.round(Math.abs(charge.amount) * 100) });
  }
  const paired = new Set(pairs.map(p => p.chargeId));
  return { pairs, pending: candidates.filter(l => l.amount < 0 && !paired.has(l.id)).map(l => l.id),
    unallocatedRefunds: candidates.filter(l => l.amount > 0 && !used.has(l.id)).map(l => l.id) };
}

export function observeEcoTransition(lines: EcoClassification[], oldRate = 'observed_1363', newRate = 'observed_1381') {
  // Unique anchors only: inferred/ambiguous rates and payment dates cannot manufacture a transition.
  const anchors = lines.filter(l => l.status === 'candidate' && l.amount < 0 && l.attribution === 'unique' && l.periodStart && l.periodEnd);
  const old = anchors.filter(l => l.rate === oldRate);
  const next = anchors.filter(l => l.rate === newRate);
  const lastOld = old.map(l => l.periodEnd || '').sort().at(-1) || null;
  const firstNew = next.map(l => l.periodStart || '').sort()[0] || null;
  const contradictions = firstNew ? old.filter(l => (l.periodEnd || '') >= firstNew).length : 0;
  return { lastOld, firstNew, contradictions,
    exactDate: lastOld && firstNew && contradictions === 0 &&
      Date.parse(firstNew) - Date.parse(lastOld) === 86400000 ? firstNew : null,
    unresolved: lines.filter(l => l.status === 'candidate' && l.attribution === 'to_confirm').length };
}