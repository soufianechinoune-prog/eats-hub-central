CREATE TABLE IF NOT EXISTS public.ai_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  monthly_limit_questions INTEGER NOT NULL DEFAULT 500,
  used_questions INTEGER NOT NULL DEFAULT 0,
  budget_cap_usd NUMERIC(10,4) DEFAULT 50.0000,
  used_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_quotas_chain_month UNIQUE (chain_id, month)
);
GRANT SELECT ON public.ai_quotas TO authenticated;
GRANT ALL ON public.ai_quotas TO service_role;
ALTER TABLE public.ai_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_quotas_select ON public.ai_quotas FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));
CREATE TRIGGER trg_ai_quotas_updated_at BEFORE UPDATE ON public.ai_quotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  user_id UUID NULL,
  conversation_id UUID NULL REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-5-5',
  page_route TEXT NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','error','quota_exceeded')),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  duration_ms INTEGER NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_chain_created ON public.ai_usage_log (chain_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_status ON public.ai_usage_log (status);
GRANT SELECT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_log_select ON public.ai_usage_log FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));

CREATE OR REPLACE FUNCTION public.get_or_create_monthly_ai_quota(p_chain_id UUID, p_default_limit INTEGER DEFAULT 500)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_month DATE; q RECORD;
BEGIN
  IF NOT (public.is_super_admin() OR public.user_has_chain_access(p_chain_id)) THEN
    RAISE EXCEPTION 'Accès refusé pour cette enseigne';
  END IF;
  v_month := date_trunc('month', now() AT TIME ZONE 'Europe/Paris')::date;
  INSERT INTO public.ai_quotas (chain_id, month, monthly_limit_questions)
  VALUES (p_chain_id, v_month, p_default_limit) ON CONFLICT (chain_id, month) DO NOTHING;
  SELECT * INTO q FROM public.ai_quotas WHERE chain_id = p_chain_id AND month = v_month;
  RETURN jsonb_build_object(
    'chain_id', q.chain_id, 'month', q.month,
    'monthly_limit_questions', q.monthly_limit_questions,
    'used_questions', q.used_questions,
    'remaining_questions', GREATEST(0, q.monthly_limit_questions - q.used_questions),
    'budget_cap_usd', q.budget_cap_usd, 'used_cost_usd', q.used_cost_usd,
    'is_exceeded', q.used_questions >= q.monthly_limit_questions);
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_or_create_monthly_ai_quota(UUID, INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_monthly_ai_quota(UUID, INTEGER) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.increment_ai_quota(p_chain_id UUID, p_cost_usd NUMERIC DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_month DATE; q RECORD;
BEGIN
  v_month := date_trunc('month', now() AT TIME ZONE 'Europe/Paris')::date;
  INSERT INTO public.ai_quotas (chain_id, month) VALUES (p_chain_id, v_month)
  ON CONFLICT (chain_id, month) DO UPDATE
    SET used_questions = public.ai_quotas.used_questions + 1,
        used_cost_usd = public.ai_quotas.used_cost_usd + COALESCE(p_cost_usd, 0)
  RETURNING * INTO q;
  IF q.used_questions = 0 THEN
    UPDATE public.ai_quotas SET used_questions = used_questions + 1,
      used_cost_usd = used_cost_usd + COALESCE(p_cost_usd, 0)
    WHERE id = q.id RETURNING * INTO q;
  END IF;
  RETURN jsonb_build_object('used_questions', q.used_questions,
    'monthly_limit_questions', q.monthly_limit_questions, 'used_cost_usd', q.used_cost_usd);
END; $$;
REVOKE EXECUTE ON FUNCTION public.increment_ai_quota(UUID, NUMERIC) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_quota(UUID, NUMERIC) TO service_role;