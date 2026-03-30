INSERT INTO public.user_chain_access (user_id, chain_id, role)
SELECT id, NULL, 'super_admin' 
FROM auth.users 
WHERE email = 'c.soufiane@chickenstreet.fr'
ON CONFLICT (user_id, chain_id) DO NOTHING;