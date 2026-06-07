INSERT INTO public.splash_backfill_jobs (chain_id, connection_id, restaurant_splash_id, restaurant_name, year, month, status)
SELECT DISTINCT
  '110e05b8-5136-45cc-a385-265360104844'::uuid,
  '16a139ba-fef5-43e9-9320-f40319b6716e'::uuid,
  m.restaurant_splash_id,
  m.splash_name,
  2026,
  6,
  'pending'
FROM public.splash360_restaurant_mapping m
WHERE m.chain_id = '110e05b8-5136-45cc-a385-265360104844'
ON CONFLICT (chain_id, restaurant_splash_id, year, month) DO UPDATE
  SET status = 'pending', attempts = 0, last_error = NULL, updated_at = now();