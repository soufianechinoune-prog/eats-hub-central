-- Table pour logger les interactions du chatbot WhatsApp
CREATE TABLE public.chatbot_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  manager_phone TEXT NOT NULL,
  manager_name TEXT,
  query TEXT NOT NULL,
  response TEXT,
  intent TEXT, -- 'analytics', 'comparison', 'action_request', 'report_request', 'greeting', 'unknown'
  detected_entities JSONB DEFAULT '{}', -- Ex: {"metric": "revenue", "period": "yesterday", "comparison": true}
  response_time_ms INTEGER, -- Temps de réponse de l'IA en millisecondes
  ai_model TEXT DEFAULT 'google/gemini-2.5-flash',
  tokens_used INTEGER,
  was_successful BOOLEAN DEFAULT true,
  error_message TEXT,
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5), -- 1-5 rating si feedback reçu
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_chatbot_interactions_restaurant ON public.chatbot_interactions(restaurant_id);
CREATE INDEX idx_chatbot_interactions_created_at ON public.chatbot_interactions(created_at DESC);
CREATE INDEX idx_chatbot_interactions_intent ON public.chatbot_interactions(intent);

-- Enable RLS
ALTER TABLE public.chatbot_interactions ENABLE ROW LEVEL SECURITY;

-- Policies permissives pour l'admin
CREATE POLICY "Allow all on chatbot_interactions" ON public.chatbot_interactions
  FOR ALL USING (true) WITH CHECK (true);

-- Commentaires pour documentation
COMMENT ON TABLE public.chatbot_interactions IS 'Logs des interactions entre managers et le chatbot WhatsApp';
COMMENT ON COLUMN public.chatbot_interactions.intent IS 'Type de requête détecté: analytics, comparison, action_request, report_request, greeting, unknown';
COMMENT ON COLUMN public.chatbot_interactions.detected_entities IS 'Entités extraites de la requête (métrique, période, etc.)';
COMMENT ON COLUMN public.chatbot_interactions.response_time_ms IS 'Temps de réponse de l IA en millisecondes';