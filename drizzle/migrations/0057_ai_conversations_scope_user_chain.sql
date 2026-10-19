ALTER TABLE public.ai_conversations ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.ai_conversations ADD COLUMN IF NOT EXISTS chain_id uuid REFERENCES public.chains(id) ON DELETE CASCADE;
UPDATE public.ai_conversations c SET chain_id = l.chain_id, user_id = l.user_id
FROM (SELECT DISTINCT ON (conversation_id) conversation_id, chain_id, user_id FROM public.ai_usage_log WHERE conversation_id IS NOT NULL ORDER BY conversation_id, created_at) l
WHERE l.conversation_id = c.id AND c.chain_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_chain ON public.ai_conversations (user_id, chain_id, updated_at DESC);

DROP POLICY IF EXISTS "Authenticated access on ai_conversations" ON public.ai_conversations;
CREATE POLICY "ai_conversations owner in chain" ON public.ai_conversations FOR ALL TO authenticated
USING (user_id = auth.uid() AND chain_id IS NOT NULL AND (public.user_has_chain_access(chain_id) OR public.is_super_admin()))
WITH CHECK (user_id = auth.uid() AND chain_id IS NOT NULL AND (public.user_has_chain_access(chain_id) OR public.is_super_admin()));

DROP POLICY IF EXISTS "Authenticated access on ai_messages" ON public.ai_messages;
CREATE POLICY "ai_messages via own conversation" ON public.ai_messages FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()));