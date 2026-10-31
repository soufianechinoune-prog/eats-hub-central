/** Recognize descriptive Uber headers without borrowing a data row as the header. */
export function isPaymentHeader(row: string[]): boolean {
  const text = row.join(' ').normalize('NFKC').replace(/[\u00a0\u202f]/g, ' ');
  return text.includes('Id. de la commande') || text.includes('Id. du flux') ||
    text.includes('Nom du restaurant') || text.includes('Date de la commande') ||
    (text.includes('Order ID') && (text.includes('Workflow ID') || text.includes('Store Name'))) ||
    (text.includes('Code alphanumérique de commande tel') &&
      text.includes('Code alphanumérique de référence identifiant le versement'));
}

/** Uber can prepend a descriptive dictionary before the actual short-column header. */
export function findPaymentHeader(rows: string[][]): number {
  const candidates = rows.slice(0, 20).map((row, index) => ({ row, index })).filter(x => isPaymentHeader(x.row));
  return candidates.find(x => x.row.some(cell => cell.trim() === 'Id. du flux' || cell.trim() === 'Workflow ID'))?.index ??
    candidates[0]?.index ?? -1;
}