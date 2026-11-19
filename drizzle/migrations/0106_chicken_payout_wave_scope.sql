ALTER TABLE public.payout_adjustment_backfill_requests DROP CONSTRAINT payout_adjustment_backfill_requests_chain_id_check;
ALTER TABLE public.payout_adjustment_backfill_requests ADD CONSTRAINT payout_adjustment_backfill_requests_chain_id_check CHECK (chain_id IN ('ce67f809-d017-41c5-8bd0-a98086cd3881'::uuid,'110e05b8-5136-45cc-a385-265360104844'::uuid));
ALTER TABLE public.payout_adjustment_backfill_state ADD COLUMN schedule_job_id bigint;
CREATE OR REPLACE FUNCTION public.guard_payout_wave_api_access() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE access_status text;
BEGIN
 IF NEW.status IN ('queued','dispatching') THEN
 SELECT a.status INTO access_status FROM public.get_uber_api_access_status(NEW.chain_id) a WHERE a.restaurant_id=NEW.restaurant_id;
 IF access_status IS NULL OR access_status NOT IN ('ok','silencieux') THEN
 NEW.status := 'awaiting_access'; NEW.error := 'Awaiting Uber API access approval';
 END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.payout_wave_finish(p_token uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job_id bigint;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM payout_adjustment_backfill_state WHERE id AND lease_token=p_token) THEN RETURN; END IF;
 IF NOT EXISTS (SELECT 1 FROM payout_adjustment_backfill_requests WHERE status IN ('queued','dispatching','requested','received','collecting','collected','staging')) THEN
 UPDATE payout_adjustment_backfill_state SET status=CASE WHEN status='paused' THEN 'paused' ELSE 'finished' END, finished_at=now() WHERE id;
 END IF;
 SELECT schedule_job_id INTO job_id FROM payout_adjustment_backfill_state WHERE id AND status IN ('finished','paused');
 IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
 UPDATE payout_adjustment_backfill_state SET lease_until=NULL,lease_token=NULL WHERE id AND lease_token=p_token;
END $$;
REVOKE ALL ON FUNCTION public.guard_payout_wave_api_access(), public.payout_wave_finish(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_payout_wave_api_access(), public.payout_wave_finish(uuid) TO service_role;