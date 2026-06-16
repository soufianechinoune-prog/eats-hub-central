CREATE OR REPLACE FUNCTION public.admin_list_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  command text,
  active boolean,
  last_runs_7d bigint,
  failed_runs_7d bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    j.jobid,
    j.jobname,
    j.schedule,
    j.command,
    j.active,
    COALESCE(r.runs, 0)   AS last_runs_7d,
    COALESCE(r.failed, 0) AS failed_runs_7d
  FROM cron.job j
  LEFT JOIN (
    SELECT jobid,
           COUNT(*)                                       AS runs,
           COUNT(*) FILTER (WHERE status <> 'succeeded')  AS failed
    FROM cron.job_run_details
    WHERE start_time > now() - interval '7 days'
    GROUP BY jobid
  ) r USING (jobid);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_cron_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_cron_jobs() TO authenticated;