-- Create report_templates table for customizable WhatsApp report templates
CREATE TABLE public.report_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'FileText',
  -- Data blocks configuration (which sections to include)
  data_blocks JSONB NOT NULL DEFAULT '{"orders_revenue": true, "rating": true, "operations": true, "errors": true}'::jsonb,
  -- Message templates
  intro_template TEXT DEFAULT '📊 Bonjour {prenom}, voici le rapport de la semaine du {date_debut} au {date_fin} :',
  outro_template TEXT DEFAULT '💪 Bonne continuation !',
  -- Global objectives stored with template
  objectives JSONB DEFAULT '{"prep_time": 20, "courier_wait": 5, "rating": 4.4, "error_rate": 3}'::jsonb,
  -- Scheduling
  is_scheduled BOOLEAN DEFAULT false,
  schedule_day INTEGER, -- 0=Sunday, 1=Monday, etc.
  schedule_time TIME,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  -- Metadata
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- Create public access policies (no auth required for now)
CREATE POLICY "Allow public read access on report_templates" 
ON public.report_templates 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access on report_templates" 
ON public.report_templates 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access on report_templates" 
ON public.report_templates 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access on report_templates" 
ON public.report_templates 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_report_templates_updated_at
BEFORE UPDATE ON public.report_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.report_templates (name, description, icon, data_blocks, intro_template, outro_template, is_default) VALUES
('KPIs Hebdo', 'Rapport complet avec tous les indicateurs de performance', 'BarChart3', 
 '{"orders_revenue": true, "rating": true, "operations": true, "errors": true}'::jsonb,
 '📊 Bonjour {prenom}, voici le rapport de la semaine du {date_debut} au {date_fin} :\n\n',
 '\n\n💪 Bonne continuation !',
 true),
('Alerte Performance', 'Focus sur les points critiques nécessitant attention', 'AlertTriangle',
 '{"orders_revenue": false, "rating": true, "operations": true, "errors": true}'::jsonb,
 '⚠️ Bonjour {prenom}, voici les points d''attention pour cette semaine :\n\n',
 '\n\nN''hésitez pas à me contacter si besoin.',
 true),
('Résumé Express', 'Version courte avec chiffre d''affaires et note uniquement', 'Zap',
 '{"orders_revenue": true, "rating": true, "operations": false, "errors": false}'::jsonb,
 '📈 {prenom}, votre résumé rapide :\n\n',
 '',
 true);