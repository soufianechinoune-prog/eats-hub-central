
-- 1. Purge exact duplicates from menu_item_reviews (keep earliest by created_at)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY restaurant_id, item_id, review_date, COALESCE(comment, ''), rating, thumb_up, thumb_down
           ORDER BY created_at
         ) AS rn
    FROM public.menu_item_reviews
)
DELETE FROM public.menu_item_reviews m
 USING ranked r
 WHERE m.id = r.id AND r.rn > 1;

-- 2. Purge duplicates from order_errors collapsing NULLs (keep most recent by created_at)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY restaurant_id, COALESCE(uber_order_id, ''), COALESCE(item_title, '')
           ORDER BY created_at DESC
         ) AS rn
    FROM public.order_errors
)
DELETE FROM public.order_errors o
 USING ranked r
 WHERE o.id = r.id AND r.rn > 1;

-- 3. Rebuild dedup index with NULLS NOT DISTINCT so future upserts on (restaurant_id, NULL, NULL)
--    actually collide. PostgREST onConflict on simple columns hits this index correctly.
DROP INDEX IF EXISTS public.order_errors_dedup_idx;
CREATE UNIQUE INDEX order_errors_dedup_idx
  ON public.order_errors (restaurant_id, uber_order_id, item_title)
  NULLS NOT DISTINCT;
