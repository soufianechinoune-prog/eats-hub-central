
CREATE TABLE public.uber_direct_resync_queue (
  id bigserial PRIMARY KEY,
  pass text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','error')),
  attempts int NOT NULL DEFAULT 0,
  result jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pass, window_start)
);
GRANT ALL ON public.uber_direct_resync_queue TO service_role;
GRANT SELECT ON public.uber_direct_resync_queue TO authenticated;
ALTER TABLE public.uber_direct_resync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin read" ON public.uber_direct_resync_queue FOR SELECT TO authenticated USING (public.is_super_admin());

INSERT INTO public.uber_direct_resync_queue (pass, window_start, window_end)
SELECT 'aligne_00h', s, least(s + interval '7 days', '2026-11-10 09:00+00'::timestamptz)
FROM generate_series('2026-06-14 22:00+00'::timestamptz, '2026-11-10 08:59+00'::timestamptz, interval '7 days') s;

CREATE OR REPLACE FUNCTION public.uber_direct_resync_stop() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'uber-direct-resync';
END $$;
REVOKE ALL ON FUNCTION public.uber_direct_resync_stop() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uber_direct_resync_stop() TO service_role;
