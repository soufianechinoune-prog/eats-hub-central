import { describe, it, expect } from 'vitest';
import { identifyAdjustmentLines, batchAdjustmentGroups } from '../../supabase/functions/parse-payment-report/lineIdentity';
const row = (amount: number, index: number) => ({ payout_reference_id: 'reference',
  uber_store_id: 'store', amount, description: 'Autres frais',
  raw_columns: { date: '2026-01-09', value: String(amount) }, source_record_index: index });
describe('payment source identity', () => {
  it('preserves individual source amounts', async () => {
    const r = await identifyAdjustmentLines([row(-76.65, 1), row(-41.43, 2), row(-0.44, 3)], 'report');
    expect(new Set(r.map(x => x.source_line_key)).size).toBe(3);
    expect(r.map(x => x.amount)).toEqual([-76.65, -41.43, -0.44]);
  });
  it('keeps keys stable across reordered overlapping reports', async () => {
    const a = await identifyAdjustmentLines([row(-76.65, 1), row(-41.43, 2)], 'a');
    const b = await identifyAdjustmentLines([row(-41.43, 50), row(-76.65, 51)], 'b');
    expect(a.map(x => x.source_line_key).sort()).toEqual(b.map(x => x.source_line_key).sort());
  });
  it('keeps two identical source occurrences without duplicating on replay', async () => {
    const a = await identifyAdjustmentLines([row(-41.43, 1), row(-41.43, 2)], 'a');
    const b = await identifyAdjustmentLines([row(-41.43, 1), row(-41.43, 2)], 'a');
    expect(new Set(a.map(x => x.source_line_key)).size).toBe(2);
    expect(a.map(x => x.source_line_key)).toEqual(b.map(x => x.source_line_key));
  });
  it('keeps a replacement group intact across the 100-line boundary', () => {
    const first = Array.from({ length: 99 }, (_, i) => ({ ...row(-1, i), description: 'Ads' }));
    const eco = [row(-76.65, 100), row(-41.43, 101), row(-81.21, 102)];
    expect(batchAdjustmentGroups([...first, ...eco]).map(b => b.length)).toEqual([99, 3]);
  });
  it('rejects a group over the RPC 1000-line maximum before any import', () => {
    expect(() => batchAdjustmentGroups(Array.from({ length: 1001 }, (_, i) => row(-1, i)))).toThrow('atomic import limit');
  });
});