export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
/** Report-window independent identity, with occurrence slots for identical records. */
export async function identifyAdjustmentLines<T extends {
  payout_reference_id: string; uber_store_id: string; amount: number;
  description: string | null; raw_columns: Record<string, string>; source_record_index: number;
}>(rows: T[], reportHash: string) {
  const occurrences = new Map<string, number>();
  return Promise.all(rows.map(async row => {
    const canonical = JSON.stringify([row.payout_reference_id, row.uber_store_id,
      row.description || '', Math.round(row.amount * 100),
      Object.entries(row.raw_columns).sort(([a], [b]) => a.localeCompare(b))]);
    const occurrence = occurrences.get(canonical) || 0;
    occurrences.set(canonical, occurrence + 1);
    return { ...row, source_report_hash: reportHash,
      source_line_key: await sha256(`${canonical}:${occurrence}`) };
  }));
}