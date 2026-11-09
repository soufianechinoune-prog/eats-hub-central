CREATE OR REPLACE VIEW public.uber_direct_order_match WITH (security_invoker = true) AS
WITH cand AS (
  SELECT d.id AS delivery_id, o.id AS order_id
  FROM public.uber_direct_deliveries d
  JOIN public.chataigne_orders o
    ON o.short_id = d.external_id
   AND o.restaurant_id = d.restaurant_id
   AND abs(extract(epoch FROM (d.created_at_uber - o.order_datetime))) <= 6 * 3600
  WHERE d.restaurant_id IS NOT NULL AND d.external_id IS NOT NULL
),
dc AS (SELECT delivery_id, count(*) n FROM cand GROUP BY 1),
oc AS (SELECT order_id, count(*) n FROM cand GROUP BY 1)
SELECT d.id AS delivery_id, d.chain_id, d.restaurant_id, d.external_id, d.created_at_uber, d.status AS delivery_status,
       d.fee_cents, d.basket_value_cents, d.discount_cents, d.client_delivery_fee_cents, d.client_service_fee_cents,
       c.order_id, o.order_datetime, o.total_amount, o.payment_amount, o.delivery_fee_amount, o.service_charge_amount,
       CASE
         WHEN d.restaurant_id IS NULL THEN 'restaurant_non_mappe'
         WHEN coalesce(dc.n,0) = 0 THEN 'sans_correspondance'
         WHEN dc.n > 1 OR oc.n > 1 THEN 'a_verifier'
         ELSE 'apparie'
       END AS match_status,
       CASE WHEN dc.n = 1 AND oc.n = 1 AND d.fee_cents IS NOT NULL
            THEN coalesce(d.client_delivery_fee_cents,0) + coalesce(d.client_service_fee_cents,0) - d.fee_cents END AS reste_a_charge_cents
FROM public.uber_direct_deliveries d
LEFT JOIN dc ON dc.delivery_id = d.id
LEFT JOIN cand c ON c.delivery_id = d.id AND dc.n = 1
LEFT JOIN oc ON oc.order_id = c.order_id
LEFT JOIN public.chataigne_orders o ON o.id = c.order_id;
GRANT SELECT ON public.uber_direct_order_match TO authenticated, service_role;