-- Sécurité (lot 1) : les tranches mensuelles des tickets de caisse étaient lisibles et
-- modifiables directement avec la clé publique (aucune règle d'accès sur les partitions).
-- Les tables mères (caisse_tickets, caisse_ticket_lines, caisse_ticket_payments) gardent leurs
-- règles : l'application passe par elles, donc rien ne change pour les utilisateurs.
-- Le serveur (service_role) et les fonctions SECURITY DEFINER ne sont pas concernés.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.relname IN ('caisse_tickets', 'caisse_ticket_lines', 'caisse_ticket_payments')
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.relname);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;

-- Les prochaines tranches naissent fermées, elles aussi.
CREATE OR REPLACE FUNCTION public.ensure_caisse_partitions(p_months integer DEFAULT 6, p_from date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start date;
  v_end date;
  v_month date;
  v_created integer := 0;
  v_parent text;
  v_part text;
BEGIN
  v_start := date_trunc('month', coalesce(p_from, current_date - interval '1 month'))::date;
  v_end := date_trunc('month', current_date + (p_months || ' months')::interval)::date;
  v_month := v_start;
  WHILE v_month <= v_end LOOP
    FOREACH v_parent IN ARRAY ARRAY['caisse_tickets', 'caisse_ticket_lines', 'caisse_ticket_payments'] LOOP
      v_part := v_parent || '_' || to_char(v_month, 'YYYYMM');
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = v_part
      ) THEN
        EXECUTE format(
          'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
          v_part, v_parent, v_month, (v_month + interval '1 month')::date
        );
        EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', v_part);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_part);
        v_created := v_created + 1;
      END IF;
    END LOOP;
    v_month := (v_month + interval '1 month')::date;
  END LOOP;
  RETURN v_created;
END;
$function$;
