

## Plan : Optimiser le chargement de la note moyenne via RPC SQL

### Problème confirmé
`useOverviewReviews` (ligne 104-129 de `useOverviewData.ts`) charge **toutes les lignes** de `customer_reviews` via `fetchAllPages` (74 000+ lignes paginées par 1000), puis calcule la moyenne en JavaScript (ligne 429-431). C'est exactement ce que ton ingénieur a identifié.

### Correction

**1. Migration SQL** - Créer la RPC `get_network_ratings_summary` :
```sql
CREATE OR REPLACE FUNCTION get_network_ratings_summary(
  p_restaurant_ids UUID[],
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  restaurant_id UUID,
  avg_rating NUMERIC,
  review_count BIGINT,
  platform TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
SET statement_timeout = '10s'
AS $$
  SELECT
    restaurant_id,
    ROUND(AVG(overall_rating)::numeric, 2),
    COUNT(*),
    platform
  FROM customer_reviews
  WHERE restaurant_id = ANY(p_restaurant_ids)
    AND review_date >= p_start_date
    AND review_date <= p_end_date
    AND overall_rating IS NOT NULL
  GROUP BY restaurant_id, platform;
$$;
```

**2. Modifier `src/hooks/useOverviewData.ts`** :
- Remplacer `useOverviewReviews` (fetchAllPages sur 74K lignes) par un appel RPC qui retourne ~50 lignes agrégées
- Adapter le calcul `avgRating` (lignes 429-431) pour utiliser la moyenne pondérée depuis les agrégats au lieu de la moyenne brute
- Adapter aussi le calcul par restaurant dans la suite du fichier (ratings par resto pour le comparatif)

**3. Conserver `useOverviewReviews` pour les vues détaillées** :
- La page `/compare/ratings` et les graphiques d'évolution ont besoin des lignes individuelles — ils ne sont pas impactés
- Seule la Vue d'ensemble (`/overview`) bénéficie du changement

### Résultat attendu
- Note moyenne affichée en < 1 seconde (1 requête SQL au lieu de 74+ requêtes paginées)
- Aucun impact sur les autres vues qui utilisent les avis individuels
- Pattern identique aux autres RPCs déjà en place (`get_network_prep_time_summary`, etc.)

