
CREATE OR REPLACE FUNCTION public.get_deliveroo_payouts_detail(
  p_start_date date,
  p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  payout_date date,
  restaurant_id uuid,
  sales_incl_vat numeric,
  uber_fee_after_promo_incl_vat numeric,
  uber_fee_after_promo_excl_vat numeric,
  item_promo_incl_vat numeric,
  refund_incl_vat numeric,
  net_payout numeric,
  meal_voucher_amount numeric,
  order_count integer,
  other_payments_incl_vat numeric,
  marketing_fee_adjustment numeric
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
BEGIN
  RETURN QUERY
  WITH categorized AS (
    SELECT
      d.restaurant_id,
      (date_trunc('week', (d.delivery_datetime AT TIME ZONE 'Europe/Paris')::date))::date AS week_start,
      d.history_type,
      COALESCE(d.order_amount, 0)::numeric AS order_amount,
      COALESCE(d.commission_amount, 0)::numeric AS commission_amount,
      COALESCE(d.total_payable, 0)::numeric AS total_payable
    FROM public.deliveroo_orders d
    WHERE d.delivery_datetime >= p_start_date::timestamp
      AND d.delivery_datetime < (p_end_date + interval '1 day')::timestamp
      AND d.restaurant_id IS NOT NULL
      AND (p_restaurant_ids IS NULL OR d.restaurant_id = ANY(p_restaurant_ids))
      AND d.history_type NOT IN ('Facture précédente: Livraison', 'Facture précédente: Remboursement client')
  )
  SELECT
    c.week_start AS payout_date,
    c.restaurant_id,
    COALESCE(SUM(ABS(c.order_amount)) FILTER (WHERE c.history_type IN ('Livraison', 'À emporter')), 0)::numeric AS sales_incl_vat,
    (
      COALESCE(SUM(ABS(c.commission_amount)) FILTER (WHERE c.history_type IN ('Livraison', 'À emporter')), 0)
      - COALESCE(SUM(ABS(c.total_payable)) FILTER (WHERE c.history_type = 'Commission Deliveroo sur la commande annulée'), 0)
    )::numeric AS uber_fee_after_promo_incl_vat,
    (
      COALESCE(SUM(ABS(c.commission_amount)) FILTER (WHERE c.history_type IN ('Livraison', 'À emporter')), 0)
      - COALESCE(SUM(ABS(c.total_payable)) FILTER (WHERE c.history_type = 'Commission Deliveroo sur la commande annulée'), 0)
    )::numeric AS uber_fee_after_promo_excl_vat,
    COALESCE(SUM(ABS(c.total_payable)) FILTER (WHERE c.history_type IN (
      'Partner funding from agreed voucher campaign', 'Contribution marketing',
      'Bon de réduction à payer par le restaurant', 'Publicités Marketer'
    )), 0)::numeric AS item_promo_incl_vat,
    (
      COALESCE(SUM(ABS(c.total_payable)) FILTER (WHERE c.history_type = 'Remboursement client'), 0)
      + COALESCE(SUM(ABS(c.total_payable)) FILTER (WHERE c.history_type = 'Montant commande annulée'), 0)
    )::numeric AS refund_incl_vat,
    COALESCE(SUM(c.total_payable), 0)::numeric AS net_payout,
    COALESCE(SUM(ABS(c.total_payable)) FILTER (WHERE c.history_type IN (
      'Montant commande Edenred', 'Montant commande Swile', 'Montant commande Sodexo',
      'Montant commande Up', 'Montant commande Bimpli'
    )), 0)::numeric AS meal_voucher_amount,
    COUNT(*) FILTER (WHERE c.history_type IN ('Livraison', 'À emporter'))::integer AS order_count,
    (
      COALESCE(SUM(ABS(c.total_payable)) FILTER (WHERE c.history_type IN (
        'Commission Deliveroo sur repréparation de commande',
        'Frais d''annulation de commande',
        'Eco-contribution – article L.541-10 du Code de l''environnement',
        'Remboursement client refusé'
      )), 0)
      + COALESCE(SUM(ABS(c.total_payable)) FILTER (WHERE c.history_type NOT IN (
        'Livraison', 'À emporter',
        'Montant commande Edenred', 'Montant commande Swile', 'Montant commande Sodexo', 'Montant commande Up', 'Montant commande Bimpli',
        'Remboursement client',
        'Partner funding from agreed voucher campaign', 'Contribution marketing', 'Bon de réduction à payer par le restaurant', 'Publicités Marketer',
        'Commission Deliveroo sur repréparation de commande',
        'Montant de la repréparation de commande', 'Nouvelle livraison',
        'Remboursement client refusé',
        'Crédit pour rectification de facture',
        'Montant commande annulée',
        'Commission Deliveroo sur la commande annulée',
        'Frais d''annulation de commande',
        'Eco-contribution – article L.541-10 du Code de l''environnement'
      )), 0)
    )::numeric AS other_payments_incl_vat,
    0::numeric AS marketing_fee_adjustment
  FROM categorized c
  GROUP BY c.week_start, c.restaurant_id
  ORDER BY c.week_start, c.restaurant_id;
END;
$function$;
