
-- 1. Table user_chain_access
CREATE TABLE public.user_chain_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_id UUID REFERENCES public.chains(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'importer', 'client')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, chain_id)
);

-- 2. RLS
ALTER TABLE public.user_chain_access ENABLE ROW LEVEL SECURITY;

-- Lecture propre accès
CREATE POLICY "Users can read own access"
  ON public.user_chain_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. Fonction anti-récursion (SECURITY DEFINER → bypasse RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_chain_access
    WHERE user_id = auth.uid() AND chain_id IS NULL AND role = 'super_admin'
  );
$$;

-- 4. Policy super_admin SANS récursion
CREATE POLICY "Super admins can manage all access"
  ON public.user_chain_access FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- 5. Helpers
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_chain_access
  WHERE user_id = auth.uid() AND chain_id IS NULL LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_chain_access(p_chain_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_chain_access
    WHERE user_id = auth.uid()
    AND (chain_id = p_chain_id OR (chain_id IS NULL AND role = 'super_admin'))
  );
$$;

-- 6. Insert super_admin
INSERT INTO public.user_chain_access (user_id, chain_id, role)
SELECT id, NULL, 'super_admin'
FROM auth.users WHERE email = 'soufiane.chinoune@gmail.com';
