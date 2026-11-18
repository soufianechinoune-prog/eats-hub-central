export function cleanIdentifier(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s/g, '') : '';
}

export interface RestaurantIdentifier {
  id: string;
  siret: string | null;
  siren?: string | null;
}

export function uniqueNetworkSiren(siret: string, restaurants: RestaurantIdentifier[]): boolean {
  const siren = cleanIdentifier(siret).slice(0, 9);
  if (!/^\d{9}$/.test(siren)) return false;
  const matches = restaurants.filter(r => {
    const identifier = cleanIdentifier(r.siret) || cleanIdentifier(r.siren);
    return identifier.slice(0, 9) === siren;
  });
  return new Set(matches.map(r => r.id)).size === 1;
}

export function filterCompanyRows(rows: Record<string, unknown>[], field: string, identifier: string, prefix = false) {
  return rows.filter(row => {
    const company = cleanIdentifier(row[field]);
    return prefix ? company.slice(0, 9) === identifier : company === identifier;
  });
}