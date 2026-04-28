ALTER TABLE public.splash360_daily_sales
  ADD COLUMN IF NOT EXISTS chain_id uuid;

UPDATE public.splash360_daily_sales s
SET chain_id = m.chain_id
FROM public.splash360_restaurant_mapping m
WHERE s.restaurant_splash_id = m.restaurant_splash_id
  AND s.chain_id IS NULL
  AND m.chain_id IS NOT NULL;

UPDATE public.splash360_daily_sales
SET chain_id = '110e05b8-5136-45cc-a385-265360104844'::uuid
WHERE chain_id IS NULL
  AND restaurant_splash_id = 0;

DELETE FROM public.splash360_daily_sales WHERE chain_id IS NULL;

ALTER TABLE public.splash360_daily_sales
  ALTER COLUMN chain_id SET NOT NULL;

ALTER TABLE public.splash360_daily_sales
  DROP CONSTRAINT IF EXISTS splash360_daily_sales_unique;
ALTER TABLE public.splash360_daily_sales
  DROP CONSTRAINT IF EXISTS splash360_daily_sales_restaurant_splash_id_date_granularity_pl_key;

DROP INDEX IF EXISTS public.splash360_daily_sales_unique_idx;
CREATE UNIQUE INDEX splash360_daily_sales_unique_idx
  ON public.splash360_daily_sales (chain_id, restaurant_splash_id, date, granularity, platform);

CREATE INDEX IF NOT EXISTS idx_splash360_daily_sales_chain_date
  ON public.splash360_daily_sales (chain_id, date);

DROP POLICY IF EXISTS "Allow all on splash360_daily_sales" ON public.splash360_daily_sales;
DROP POLICY IF EXISTS "Read splash360_daily_sales" ON public.splash360_daily_sales;
DROP POLICY IF EXISTS "Write splash360_daily_sales" ON public.splash360_daily_sales;
DROP POLICY IF EXISTS "Update splash360_daily_sales" ON public.splash360_daily_sales;
DROP POLICY IF EXISTS "Delete splash360_daily_sales" ON public.splash360_daily_sales;

CREATE POLICY "Read splash360_daily_sales"
  ON public.splash360_daily_sales FOR SELECT
  TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id));

CREATE POLICY "Write splash360_daily_sales"
  ON public.splash360_daily_sales FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));

CREATE POLICY "Update splash360_daily_sales"
  ON public.splash360_daily_sales FOR UPDATE
  TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id))
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));

CREATE POLICY "Delete splash360_daily_sales"
  ON public.splash360_daily_sales FOR DELETE
  TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id));
