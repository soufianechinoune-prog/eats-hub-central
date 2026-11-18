DO $migration$
DECLARE original text; replacement text;
BEGIN
 original := pg_get_functiondef('public.get_uber_api_access_status(uuid)'::regprocedure);
 replacement := replace(original, '(public.is_super_admin() OR public.user_has_chain_access(r.chain_id))', '(auth.role() = ''service_role'' OR public.is_super_admin() OR public.user_has_chain_access(r.chain_id))');
 IF replacement = original THEN RAISE EXCEPTION 'Expected access guard not found'; END IF;
 EXECUTE replacement;
END $migration$;