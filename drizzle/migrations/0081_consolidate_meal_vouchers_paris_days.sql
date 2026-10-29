SET LOCAL statement_timeout = '0';
CREATE TABLE public.meal_voucher_daily_summary (
 restaurant_id uuid NOT NULL,
 day date NOT NULL,
 provider text NOT NULL DEFAULT '',
 uber_revenue_ttc numeric NOT NULL DEFAULT 0,
 uber_order_count bigint NOT NULL DEFAULT 0,
 tr_amount numeric NOT NULL DEFAULT 0,
 tr_order_count bigint NOT NULL DEFAULT 0,
 positive_tr_amount numeric NOT NULL DEFAULT 0,
 PRIMARY KEY (restaurant_id, day, provider)
);
GRANT SELECT ON public.meal_voucher_daily_summary TO authenticated;
GRANT ALL ON public.meal_voucher_daily_summary TO service_role;
ALTER TABLE public.meal_voucher_daily_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY meal_voucher_summary_read ON public.meal_voucher_daily_summary FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND public.user_has_chain_access(r.chain_id)));
COMMENT ON TABLE public.meal_voucher_daily_summary IS 'Recomputable calendar-day Paris projection of orders, including every provider. Signed statement deltas maintain corrections and deletes; never use the 4h revenue business-day projection for these RPCs.';

CREATE OR REPLACE FUNCTION public.mv_summary_delta() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE source_sql text;
BEGIN
 IF TG_OP = 'INSERT' THEN
  source_sql := 'SELECT restaurant_id, order_datetime, meal_voucher_provider, sales_incl_vat, meal_voucher_amount, 1::bigint AS sign FROM new_rows';
 ELSIF TG_OP = 'DELETE' THEN
  source_sql := 'SELECT restaurant_id, order_datetime, meal_voucher_provider, sales_incl_vat, meal_voucher_amount, -1::bigint AS sign FROM old_rows';
 ELSE
  source_sql := 'SELECT restaurant_id, order_datetime, meal_voucher_provider, sales_incl_vat, meal_voucher_amount, 1::bigint AS sign FROM new_rows UNION ALL SELECT restaurant_id, order_datetime, meal_voucher_provider, sales_incl_vat, meal_voucher_amount, -1::bigint AS sign FROM old_rows';
 END IF;
 EXECUTE 'INSERT INTO public.meal_voucher_daily_summary AS s (restaurant_id, day, provider, uber_revenue_ttc, uber_order_count, tr_amount, tr_order_count, positive_tr_amount)
 SELECT restaurant_id, (order_datetime AT TIME ZONE ''Europe/Paris'')::date, COALESCE(meal_voucher_provider, ''''),
 SUM(sign * COALESCE(sales_incl_vat, 0)), SUM(sign), SUM(sign * COALESCE(meal_voucher_amount, 0)),
 SUM(CASE WHEN meal_voucher_amount > 0 THEN sign ELSE 0 END), SUM(CASE WHEN meal_voucher_amount > 0 THEN sign * meal_voucher_amount ELSE 0 END)
 FROM (' || source_sql || ') x WHERE restaurant_id IS NOT NULL AND order_datetime IS NOT NULL
 GROUP BY 1,2,3 ORDER BY 1,2,3
 ON CONFLICT (restaurant_id, day, provider) DO UPDATE SET
 uber_revenue_ttc = s.uber_revenue_ttc + EXCLUDED.uber_revenue_ttc,
 uber_order_count = s.uber_order_count + EXCLUDED.uber_order_count,
 tr_amount = s.tr_amount + EXCLUDED.tr_amount,
 tr_order_count = s.tr_order_count + EXCLUDED.tr_order_count,
 positive_tr_amount = s.positive_tr_amount + EXCLUDED.positive_tr_amount';
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.mv_summary_delta() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mv_summary_delta() TO service_role;

-- Lock source writes until the initial snapshot and triggers commit atomically.
LOCK TABLE public.orders IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO public.meal_voucher_daily_summary (restaurant_id, day, provider, uber_revenue_ttc, uber_order_count, tr_amount, tr_order_count, positive_tr_amount)
SELECT restaurant_id, (order_datetime AT TIME ZONE 'Europe/Paris')::date, COALESCE(meal_voucher_provider, ''),
 COALESCE(SUM(sales_incl_vat),0), COUNT(*), COALESCE(SUM(meal_voucher_amount),0),
 COUNT(*) FILTER (WHERE meal_voucher_amount > 0), COALESCE(SUM(meal_voucher_amount) FILTER (WHERE meal_voucher_amount > 0),0)
FROM public.orders WHERE restaurant_id IS NOT NULL AND order_datetime IS NOT NULL GROUP BY 1,2,3;
CREATE TRIGGER mv_summary_insert AFTER INSERT ON public.orders REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.mv_summary_delta();
CREATE TRIGGER mv_summary_update AFTER UPDATE ON public.orders REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.mv_summary_delta();
CREATE TRIGGER mv_summary_delete AFTER DELETE ON public.orders REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.mv_summary_delta();

CREATE OR REPLACE FUNCTION public.get_meal_voucher_breakdown(p_restaurant_ids uuid[], p_date_from date, p_date_to date)
RETURNS TABLE(restaurant_id uuid, provider text, amount numeric, order_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
 SELECT s.restaurant_id, s.provider, SUM(s.positive_tr_amount)::numeric, SUM(s.tr_order_count)::bigint
 FROM public.meal_voucher_daily_summary s JOIN public.restaurants r ON r.id=s.restaurant_id
 WHERE s.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
 AND s.day BETWEEN p_date_from AND p_date_to
 AND s.provider IN ('Edenred','Swile','Sodexo','UpDejeuner','Bimpli (ex Apetiz)','Pluxee')
 GROUP BY s.restaurant_id,s.provider HAVING SUM(s.tr_order_count)>0;
$fn$;
CREATE OR REPLACE FUNCTION public.get_meal_voucher_totals(p_restaurant_ids uuid[], p_date_from date, p_date_to date)
RETURNS TABLE(restaurant_id uuid, uber_revenue_ttc numeric, uber_order_count bigint, tr_amount numeric, tr_order_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
 SELECT s.restaurant_id, COALESCE(SUM(s.uber_revenue_ttc),0)::numeric, SUM(s.uber_order_count)::bigint,
 COALESCE(SUM(s.tr_amount) FILTER (WHERE s.provider IN ('Edenred','Swile','Sodexo','UpDejeuner','Bimpli (ex Apetiz)','Pluxee')),0)::numeric,
 COALESCE(SUM(s.tr_order_count) FILTER (WHERE s.provider IN ('Edenred','Swile','Sodexo','UpDejeuner','Bimpli (ex Apetiz)','Pluxee')),0)::bigint
 FROM public.meal_voucher_daily_summary s JOIN public.restaurants r ON r.id=s.restaurant_id
 WHERE s.restaurant_id=ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id) AND s.day BETWEEN p_date_from AND p_date_to
 GROUP BY s.restaurant_id HAVING SUM(s.uber_order_count)>0;
$fn$;
REVOKE ALL ON FUNCTION public.get_meal_voucher_breakdown(uuid[],date,date), public.get_meal_voucher_totals(uuid[],date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meal_voucher_breakdown(uuid[],date,date), public.get_meal_voucher_totals(uuid[],date,date) TO authenticated, service_role;
ANALYZE public.meal_voucher_daily_summary;