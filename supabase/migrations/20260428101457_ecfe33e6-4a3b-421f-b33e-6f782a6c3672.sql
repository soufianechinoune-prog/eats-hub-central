-- Étendre la normalisation pour gérer aussi "Tasty Crousty" et "Tastu Crousty" (typo en base)
CREATE OR REPLACE FUNCTION public.normalize_resto_name(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(public.unaccent(coalesce(input, ''))),
        '^(chicken\s*street|tasty\s*crousty|tastu\s*crousty)\s*-?\s*', '', 'g'
      ),
      '\s+', '', 'g'
    ),
    '[^a-z0-9]', '', 'g'
  );
$function$;

-- Relancer le mapping automatique
SELECT * FROM public.splash360_auto_map_restaurants();