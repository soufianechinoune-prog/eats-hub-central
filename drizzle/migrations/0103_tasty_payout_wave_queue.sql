CREATE TABLE public.payout_adjustment_backfill_state (id boolean PRIMARY KEY DEFAULT true CHECK(id), status text NOT NULL DEFAULT 'ready', consecutive_refusals integer NOT NULL DEFAULT 0, pause_reason text, lease_until timestamptz, lease_token uuid, next_dispatch_at timestamptz, started_at timestamptz, finished_at timestamptz);
GRANT ALL ON public.payout_adjustment_backfill_state TO service_role;
ALTER TABLE public.payout_adjustment_backfill_state ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.payout_adjustment_backfill_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chain_id uuid NOT NULL CHECK(chain_id='ce67f809-d017-41c5-8bd0-a98086cd3881'), restaurant_id uuid NOT NULL REFERENCES public.restaurants(id), uber_store_id text NOT NULL CHECK(uber_store_id NOT IN ('a7d5bd5a-0225-50a0-8ffb-78162ae651e7','c3eee44c-0a67-5bda-9020-df3fdf328371','37b27fc0-bb7e-5c2e-abd0-48dd5471d2c4')), start_date date NOT NULL CHECK(start_date>='2025-12-01'), end_date date NOT NULL CHECK(end_date<='2026-11-15' AND end_date>=start_date AND end_date-start_date<30), status text NOT NULL DEFAULT 'queued', workflow_id text UNIQUE, sections jsonb, attempts integer NOT NULL DEFAULT 0, refusal_status integer, error text, created_at timestamptz NOT NULL DEFAULT now(), requested_at timestamptz, received_at timestamptz, completed_at timestamptz, source_rows jsonb, inserted_lines integer NOT NULL DEFAULT 0, already_present_lines integer NOT NULL DEFAULT 0, UNIQUE(uber_store_id,start_date,end_date));
GRANT ALL ON public.payout_adjustment_backfill_requests TO service_role;
ALTER TABLE public.payout_adjustment_backfill_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX payout_adjustment_backfill_status ON public.payout_adjustment_backfill_requests(status,created_at);
CREATE OR REPLACE FUNCTION public.payout_wave_lock(p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE payout_adjustment_backfill_state SET lease_until=now()+interval '5 minutes',lease_token=p_token WHERE id AND status='running' AND (lease_until IS NULL OR lease_until<now());
 RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.payout_wave_finish(p_token uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM payout_adjustment_backfill_state WHERE id AND lease_token=p_token) THEN RETURN; END IF;
 IF NOT EXISTS (SELECT 1 FROM payout_adjustment_backfill_requests WHERE status IN ('queued','requested','received','collecting','collected','staging')) THEN
 UPDATE payout_adjustment_backfill_state SET status=CASE WHEN status='paused' THEN 'paused' ELSE 'finished' END, finished_at=now() WHERE id;
 END IF;
 IF EXISTS (SELECT 1 FROM payout_adjustment_backfill_state WHERE id AND status IN ('finished','paused')) THEN
 PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='tasty-payout-wave-1';
 END IF;
 UPDATE payout_adjustment_backfill_state SET lease_until=NULL,lease_token=NULL WHERE id AND lease_token=p_token;
END $$;
REVOKE ALL ON FUNCTION public.payout_wave_lock(uuid), public.payout_wave_finish(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payout_wave_lock(uuid), public.payout_wave_finish(uuid) TO service_role;