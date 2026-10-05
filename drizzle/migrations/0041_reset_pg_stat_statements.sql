CREATE OR REPLACE FUNCTION public.reset_pg_stat_statements()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT extensions.pg_stat_statements_reset();
$$;

SELECT public.reset_pg_stat_statements();