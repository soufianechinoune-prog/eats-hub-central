-- Gain livraison WhatsApp : détail par commande « de bout en bout » (demande Soufiane, 25/11/2026).
--
-- get_chataigne_delivery_gain_orders renvoie en plus, par commande :
--   articles payés en livraison, mêmes articles au prix emporté, frais de service payés par le client,
--   frais Châtaigne, frais Stripe, solde des frais de service, résultat complet.
-- total payé = articles + frais de livraison + frais de service (vérifié sur les commandes sans offre).
--
-- Les frais Châtaigne et Stripe ne sont PAS dans la donnée : ce sont des ESTIMATIONS réglées par enseigne
-- dans chataigne_channel_fees (affichées « estimé » sur la page). Ils n'entrent pas dans le gain livraison.
-- Enseigne sans réglage → colonnes vides.
-- Contrôle Reims 1 → 24/11/2026 : 21 commandes, markup 75,35 €, gain −4,11 €, solde frais de service +4,60 €,
-- résultat complet +0,49 € (identique au fichier Excel remis le 25/11).

CREATE TABLE IF NOT EXISTS public.chataigne_channel_fees (
  chain_id uuid PRIMARY KEY REFERENCES public.chains(id) ON DELETE CASCADE,
  chataigne_fee_eur numeric NOT NULL CHECK (chataigne_fee_eur >= 0),
  stripe_pct numeric NOT NULL CHECK (stripe_pct >= 0 AND stripe_pct < 1),
  stripe_fixed_eur numeric NOT NULL CHECK (stripe_fixed_eur >= 0),
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chataigne_channel_fees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chataigne_channel_fees FROM anon, authenticated;
GRANT ALL ON public.chataigne_channel_fees TO service_role;
INSERT INTO public.chataigne_channel_fees (chain_id, chataigne_fee_eur, stripe_pct, stripe_fixed_eur, note) VALUES
  ('110e05b8-5136-45cc-a385-265360104844', 1.00, 0.015, 0.25, 'Estimation : Châtaigne ~1 € HT par commande, TVA autoliquidée (Soufiane) ; Stripe tarif public cartes européennes 1,5 % + 0,25 €, à remplacer par le taux du contrat')
ON CONFLICT (chain_id) DO NOTHING;

DROP FUNCTION IF EXISTS public.get_chataigne_delivery_gain_orders(date, date, uuid);
CREATE FUNCTION public.get_chataigne_delivery_gain_orders(p_start date, p_end date, p_restaurant_id uuid)
 RETURNS TABLE(order_id uuid, short_id text, order_datetime timestamptz, total_amount numeric,
   markup numeric, delivery_fee numeric, real_cost numeric, cap_cost numeric, distance_km numeric,
   gain_cap numeric, gain_real numeric, items_without_ref numeric,
   service_fee numeric, items_delivery numeric, items_takeaway numeric,
   chataigne_fee numeric, stripe_fee numeric, service_balance numeric, full_result numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
    WHERE r.id = p_restaurant_id AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  ),
  c AS (
    SELECT c.*,
      COALESCE((
        SELECT SUM((x.value -> 'amount' ->> 'amount')::numeric)
        FROM public.chataigne_orders o,
          jsonb_array_elements(CASE WHEN jsonb_typeof(o.raw_payload -> 'charges') = 'array' THEN o.raw_payload -> 'charges' ELSE '[]'::jsonb END) x
        WHERE o.id = c.order_id AND x.value ->> 'type' = 'service'), 0) AS svc
    FROM public.chataigne_delivery_gain_core(p_start, p_end, (SELECT a FROM ids)::uuid[]) c
    WHERE c.no_offer
  ),
  k AS (
    SELECT c.*, f.chataigne_fee_eur AS chat,
      ROUND(c.total_amount * f.stripe_pct + f.stripe_fixed_eur, 2) AS stripe
    FROM c LEFT JOIN public.chataigne_channel_fees f ON f.chain_id = c.chain_id
  )
  SELECT k.order_id, k.short_id, k.order_datetime, k.total_amount,
    ROUND(k.markup, 2), ROUND(k.delivery_fee, 2), ROUND(k.real_cost, 2), ROUND(k.cap_cost, 2), ROUND(k.distance_km, 1),
    ROUND(k.markup + k.delivery_fee - k.cap_cost, 2), ROUND(k.markup + k.delivery_fee - k.real_cost, 2), k.qty_no_ref,
    ROUND(k.svc, 2),
    -- total payé = articles + frais de livraison + frais de service (vérifié sur les commandes sans offre)
    ROUND(k.total_amount - k.delivery_fee - k.svc, 2),
    ROUND(k.total_amount - k.delivery_fee - k.svc - k.markup, 2),
    k.chat, k.stripe,
    ROUND(k.svc - k.chat - k.stripe, 2),
    ROUND(k.markup + k.delivery_fee - k.real_cost + k.svc - k.chat - k.stripe, 2)
  FROM k
  ORDER BY k.order_datetime DESC;
$function$;
REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain_orders(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain_orders(date, date, uuid) TO authenticated, service_role;
