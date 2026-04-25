-- Fix get_user_role() to also return roles for users with chain-scoped access (not just super_admin)
-- Previously, only users with chain_id IS NULL got a role, leaving 'client' and chain-scoped 'importer' as null
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_chain_access
  WHERE user_id = auth.uid()
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'importer' THEN 2
      WHEN 'client' THEN 3
      ELSE 4
    END
  LIMIT 1;
$$;