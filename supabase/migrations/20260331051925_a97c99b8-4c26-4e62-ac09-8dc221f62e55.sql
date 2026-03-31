
-- 1. Table subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  payer_user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'inactive', 'trial')),
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 190.00,
  activated_at TIMESTAMPTZ DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Users see own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (payer_user_id = auth.uid());

-- 2. Table restaurant_visibility_grants
CREATE TABLE public.restaurant_visibility_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  granted_to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, granted_to_user_id)
);

ALTER TABLE public.restaurant_visibility_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages grants" ON public.restaurant_visibility_grants
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Users see grants they gave or received" 
  ON public.restaurant_visibility_grants
  FOR SELECT TO authenticated
  USING (granted_by_user_id = auth.uid() OR granted_to_user_id = auth.uid());

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant_id 
  ON public.subscriptions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payer_user_id 
  ON public.subscriptions(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
  ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_visibility_grants_restaurant 
  ON public.restaurant_visibility_grants(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_visibility_grants_granted_to 
  ON public.restaurant_visibility_grants(granted_to_user_id);
