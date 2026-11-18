import { describe, expect, it } from 'vitest';
import { uniqueNetworkSiren, filterCompanyRows } from '../../supabase/functions/check-eco-organism/sirenFallback';

describe('ADEME network-wide SIREN fallback', () => {
  it('accepts Nanterre head-office IDU for its unique restaurant SIREN', () => {
    expect(uniqueNetworkSiren('95329193700027', [{ id: 'nanterre', siret: '95329193700027' }])).toBe(true);
    const rows = [{ Identifiant_societe: '95329193700019', Identifiant_unique: 'FR360924_01TNCO' }];
    expect(filterCompanyRows(rows, 'Identifiant_societe', '95329193700027')).toEqual([]);
    expect(filterCompanyRows(rows, 'Identifiant_societe', '953291937', true)[0]?.Identifiant_unique).toBe('FR360924_01TNCO');
  });
  it('rejects a SIREN shared across brands even with different establishment SIRETs', () => {
    expect(uniqueNetworkSiren('92007791400025', [{ id: 'chicken', siret: '92007791400025' }, { id: 'tasty', siret: '92007791400017' }])).toBe(false);
  });
  it('accepts Chicken Saint Priest after correcting Tasty to 10922326300012', () => {
    expect(uniqueNetworkSiren('92007791400025', [{ id: 'chicken', siret: '92007791400025' }, { id: 'tasty', siret: '10922326300012' }])).toBe(true);
    expect(filterCompanyRows([{ Identifiant_societe: '92007791400017', Identifiant_unique: 'FR418725_01RGKW' }], 'Identifiant_societe', '109223263', true)).toEqual([]);
  });
  it('rejects missing restaurants and counts SIREN-only active fiches', () => {
    expect(uniqueNetworkSiren('95329193700027', [])).toBe(false);
    expect(uniqueNetworkSiren('95329193700027', [{ id: 'a', siret: '95329193700027' }, { id: 'b', siret: null, siren: '953291937' }])).toBe(false);
  });
});