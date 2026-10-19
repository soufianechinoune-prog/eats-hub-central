CREATE TABLE public.ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','chain')),
  chain_id uuid REFERENCES public.chains(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 8000),
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'global' AND chain_id IS NULL) OR (scope = 'chain' AND chain_id IS NOT NULL))
);
CREATE UNIQUE INDEX ai_prompts_one_global ON public.ai_prompts ((scope)) WHERE scope = 'global';
CREATE UNIQUE INDEX ai_prompts_one_per_chain ON public.ai_prompts (chain_id) WHERE scope = 'chain';

GRANT SELECT ON public.ai_prompts TO authenticated;
GRANT ALL ON public.ai_prompts TO service_role;
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_prompts super admin read" ON public.ai_prompts FOR SELECT TO authenticated USING (public.is_super_admin());

CREATE TRIGGER ai_prompts_updated_at BEFORE UPDATE ON public.ai_prompts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_prompts (scope, content) VALUES ('global',
'Tu es Mijo, l''assistant IA de Mijotek, expert en performance et rentabilité de la restauration rapide multi-canal (Uber Eats, Deliveroo, Caisse, Dishop, Châtaigne).

RÈGLES :
- Français professionnel, concis, direct et chiffré.
- Nomme les restaurants par leur nom exact.
- Utilise en priorité les KPIs fournis dans le message ; si une donnée manque, dis-le et indique où la vérifier sur la plateforme. N''invente jamais de chiffre.
- Rentabilité = Versement total / CA × 100.
- Sois concis. Pour les listes/classements, limite-toi aux chiffres demandés sans commentaire superflu. Termine toujours ta réponse proprement.');

CREATE OR REPLACE FUNCTION public.admin_get_ai_prompts()
RETURNS TABLE(scope text, chain_id uuid, chain_name text, content text, is_active boolean, updated_at timestamptz, updated_by_email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT 'global'::text, NULL::uuid, NULL::text, p.content, p.is_active, p.updated_at, u.email::text
    FROM public.ai_prompts p LEFT JOIN auth.users u ON u.id = p.updated_by WHERE p.scope = 'global'
  UNION ALL
  SELECT 'chain'::text, c.id, c.name, coalesce(p.content, ''), coalesce(p.is_active, false), p.updated_at, u.email::text
    FROM public.chains c
    LEFT JOIN public.ai_prompts p ON p.scope = 'chain' AND p.chain_id = c.id
    LEFT JOIN auth.users u ON u.id = p.updated_by;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_ai_prompt(p_scope text, p_chain_id uuid, p_content text, p_is_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_scope NOT IN ('global','chain') THEN RAISE EXCEPTION 'invalid scope'; END IF;
  IF char_length(coalesce(p_content,'')) > 8000 THEN RAISE EXCEPTION 'content too long (max 8000)'; END IF;
  IF p_scope = 'global' THEN
    IF p_chain_id IS NOT NULL THEN RAISE EXCEPTION 'global prompt must not have chain_id'; END IF;
    UPDATE public.ai_prompts SET content = coalesce(p_content,''), is_active = p_is_active, updated_by = auth.uid() WHERE scope = 'global';
    IF NOT FOUND THEN
      INSERT INTO public.ai_prompts (scope, content, is_active, updated_by) VALUES ('global', coalesce(p_content,''), p_is_active, auth.uid());
    END IF;
  ELSE
    IF p_chain_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.chains WHERE id = p_chain_id) THEN RAISE EXCEPTION 'invalid chain_id'; END IF;
    INSERT INTO public.ai_prompts (scope, chain_id, content, is_active, updated_by)
    VALUES ('chain', p_chain_id, coalesce(p_content,''), p_is_active, auth.uid())
    ON CONFLICT (chain_id) WHERE scope = 'chain'
    DO UPDATE SET content = EXCLUDED.content, is_active = EXCLUDED.is_active, updated_by = auth.uid();
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.admin_get_ai_prompts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_ai_prompt(text, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_prompts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ai_prompt(text, uuid, text, boolean) TO authenticated;