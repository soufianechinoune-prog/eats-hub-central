CREATE TABLE public.deliveroo_sales_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id uuid REFERENCES public.chains(id),
  restaurant_id uuid REFERENCES public.restaurants(id),
  deliveroo_name text NOT NULL,
  normalized_name text NOT NULL,
  order_number text NOT NULL,
  status text NOT NULL,
  sent_at timestamptz NOT NULL,
  delivered_at timestamptz,
  subtotal numeric NOT NULL DEFAULT 0,
  commission numeric NOT NULL DEFAULT 0,
  commission_vat numeric NOT NULL DEFAULT 0,
  net numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  source_file text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deliveroo_sales_orders_unique UNIQUE (deliveroo_name, order_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveroo_sales_orders TO authenticated;
GRANT ALL ON public.deliveroo_sales_orders TO service_role;

ALTER TABLE public.deliveroo_sales_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chain members can read deliveroo sales orders"
ON public.deliveroo_sales_orders FOR SELECT TO authenticated
USING (chain_id IS NOT NULL AND public.user_has_chain_access(chain_id));

CREATE POLICY "Chain members can write deliveroo sales orders"
ON public.deliveroo_sales_orders FOR ALL TO authenticated
USING (chain_id IS NOT NULL AND public.user_has_chain_access(chain_id))
WITH CHECK (chain_id IS NOT NULL AND public.user_has_chain_access(chain_id));

CREATE INDEX idx_dso_chain_sent ON public.deliveroo_sales_orders (chain_id, sent_at);
CREATE INDEX idx_dso_restaurant_sent ON public.deliveroo_sales_orders (restaurant_id, sent_at);
CREATE INDEX idx_dso_normalized ON public.deliveroo_sales_orders (normalized_name);

CREATE TRIGGER update_deliveroo_sales_orders_updated_at
BEFORE UPDATE ON public.deliveroo_sales_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_network_deliveroo_summary(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
RETURNS TABLE(restaurant_id uuid, total_revenue numeric, total_payable numeric, order_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    d.restaurant_id,
    COALESCE(SUM(d.subtotal), 0)::numeric AS total_revenue,
    COALESCE(SUM(d.net), 0)::numeric AS total_payable,
    COUNT(*)::bigint AS order_count
  FROM public.deliveroo_sales_orders d
  WHERE d.restaurant_id = ANY(p_restaurant_ids)
    AND d.status = 'Terminée'
    AND d.sent_at >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND d.sent_at <  ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY d.restaurant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_deliveroo_sales(p_start_date date, p_end_date date, p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS TABLE(day date, restaurant_id uuid, revenue numeric, commission_total numeric, net numeric, order_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '20s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    (d.sent_at AT TIME ZONE 'Europe/Paris')::date AS day,
    d.restaurant_id,
    COALESCE(SUM(d.subtotal), 0)::numeric AS revenue,
    COALESCE(SUM(d.commission + d.commission_vat), 0)::numeric AS commission_total,
    COALESCE(SUM(d.net), 0)::numeric AS net,
    COUNT(*)::bigint AS order_count
  FROM public.deliveroo_sales_orders d
  WHERE d.status = 'Terminée'
    AND d.restaurant_id IS NOT NULL
    AND (p_restaurant_ids IS NULL OR d.restaurant_id = ANY(p_restaurant_ids))
    AND d.sent_at >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND d.sent_at <  ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY 1, 2;
END;
$function$;