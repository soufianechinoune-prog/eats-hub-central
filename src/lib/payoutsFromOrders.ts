import { supabase } from "@/integrations/supabase/client";

/**
 * Option B — la table `payouts` est dépréciée (vide).
 * Les versements sont recalculés côté serveur depuis `orders` + `payout_adjustments`
 * par la RPC `get_yearly_payouts_detail` (agrégats séparés puis FULL OUTER JOIN,
 * donc pas de fan-out). Les commandes sans `payout_date` sont exclues : elles
 * réapparaîtront quand la file de backfill Uber sera terminée.
 *
 * Ce helper reproduit l'ancien contrat "une ligne par (restaurant, payout_date)"
 * sur une plage de dates arbitraire.
 */
export interface PayoutRow {
  restaurant_id: string;
  payout_date: string;
  sales_incl_vat: number;
  sales_excl_vat: number;
  refund_incl_vat: number;
  refund_excl_vat: number;
  vat_refund: number;
  item_promo_incl_vat: number;
  item_promo_excl_vat: number;
  uber_fee_after_promo_incl_vat: number;
  uber_fee_after_promo_excl_vat: number;
  uber_fee_before_promo_excl_vat: number;
  uber_fee_promo_excl_vat: number;
  vat_uber_fee: number;
  delivery_promo_incl_vat: number;
  delivery_promo_excl_vat: number;
  price_adjustment_incl_vat: number;
  price_adjustment_excl_vat: number;
  other_payments_incl_vat: number;
  net_payout: number;
  order_count: number;
  tips: number;
  marketing_fee_adjustment: number;
  meal_voucher_amount: number;
  eco_contribution_refund: number;
  eco_contribution_charge: number;
}

const NUMERIC_FIELDS: (keyof PayoutRow)[] = [
  "sales_incl_vat",
  "sales_excl_vat",
  "refund_incl_vat",
  "refund_excl_vat",
  "vat_refund",
  "item_promo_incl_vat",
  "item_promo_excl_vat",
  "uber_fee_after_promo_incl_vat",
  "uber_fee_after_promo_excl_vat",
  "uber_fee_before_promo_excl_vat",
  "uber_fee_promo_excl_vat",
  "vat_uber_fee",
  "delivery_promo_incl_vat",
  "delivery_promo_excl_vat",
  "price_adjustment_incl_vat",
  "price_adjustment_excl_vat",
  "other_payments_incl_vat",
  "net_payout",
  "order_count",
  "tips",
  "marketing_fee_adjustment",
  "meal_voucher_amount",
  "eco_contribution_refund",
  "eco_contribution_charge",
];

export async function fetchPayoutRows(
  restaurantIds: string[],
  startDateStr: string,
  endDateStr: string,
): Promise<PayoutRow[]> {
  if (!restaurantIds || restaurantIds.length === 0) return [];

  const startYear = Number(startDateStr.slice(0, 4));
  const endYear = Number(endDateStr.slice(0, 4));
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  const results = await Promise.all(
    years.map((year) =>
      supabase.rpc("get_yearly_payouts_detail", {
        p_year: year,
        p_restaurant_ids: restaurantIds,
      }),
    ),
  );

  const rows: PayoutRow[] = [];
  for (const { data, error } of results) {
    if (error) throw error;
    for (const raw of ((data as any[]) || [])) {
      if (raw.payout_date < startDateStr || raw.payout_date > endDateStr) continue;
      const row: any = {
        restaurant_id: raw.restaurant_id,
        payout_date: raw.payout_date,
      };
      for (const f of NUMERIC_FIELDS) row[f] = Number(raw[f]) || 0;
      rows.push(row as PayoutRow);
    }
  }
  return rows;
}
