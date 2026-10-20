-- lovable-cron-fallback-reviewed: file bornée (~5 400 travaux) à vider en quelques jours ; le WHERE EXISTS rend les passages vides sans effet, et la cadence 2 min calque le backfill tickets existant. Le job pourra être deschedulé une fois la file drainée.
-- Automate de traitement de la file des commandes annulées Splash.
-- Cadence volontairement plus douce que le backfill tickets (toutes les 2 min, batch 4) :
-- volumes faibles (quelques annulations/jour/caisse), aucune urgence temps réel.
SELECT cron.schedule(
  'splash-deleted-backfill-tick',
  '*/2 * * * *',
  $$
  select net.http_post(
    url:='https://akcicojkrzeirffefdet.supabase.co/functions/v1/splash-deleted-backfill-worker',
    headers:='{"Content-Type":"application/json","x-worker-key":"ce30c8be9bf05b00835a424b856e461d9874c0ff36e08639"}'::jsonb,
    body:='{"batch":4,"budget_ms":55000}'::jsonb
  ) where exists (select 1 from public.splash_deleted_backfill_jobs where status in ('pending','running') and next_attempt_at <= now());
  $$
);

-- Resynchronisation glissante quotidienne : le mois courant est remis en file
-- chaque nuit pour capter les annulations récentes (upsert idempotent).
CREATE OR REPLACE FUNCTION public.requeue_current_month_splash_deleted()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.splash_deleted_backfill_jobs (restaurant_id, chain_id, station, year, month, priority)
  SELECT c.restaurant_id, c.chain_id, c.station,
         EXTRACT(YEAR FROM now() AT TIME ZONE 'Europe/Paris')::int,
         EXTRACT(MONTH FROM now() AT TIME ZONE 'Europe/Paris')::int,
         50
  FROM public.splash_restaurant_credentials c
  WHERE c.is_active = true
  ON CONFLICT (restaurant_id, station, year, month) DO UPDATE
    SET status = 'pending', page_cursor = 0, next_attempt_at = now(), locked_until = null, updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.requeue_current_month_splash_deleted() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_current_month_splash_deleted() TO service_role;

SELECT cron.schedule(
  'splash-deleted-daily-requeue',
  '45 3 * * *',
  $$SELECT public.requeue_current_month_splash_deleted();$$
);