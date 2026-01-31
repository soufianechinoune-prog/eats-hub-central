
# Alignement des sources de données pour les rapports WhatsApp

## Problème identifié

L'Edge Function affiche **4.39** (38 avis) alors que le dashboard affiche **4.41** (39 avis) pour la même période.

**Cause** : L'Edge Function filtre par `review_date` tandis que le dashboard filtre par `order_date`.

| Critère | Edge Function | Dashboard |
|---------|---------------|-----------|
| Colonne de filtre | `review_date` | `order_date` |
| Résultat 12-18 jan | 38 avis, 4.39 | 39 avis, 4.41 |

## Solution en 2 parties

### Partie 1 : Aligner le filtre de date (correction immédiate)

Modifier les Edge Functions pour filtrer par `order_date` comme le fait le dashboard.

**Fichier** : `supabase/functions/generate-ai-report/index.ts`

Lignes 158-171 : Changer `review_date` → `order_date`

```typescript
// Avant
const { data: reviews } = await supabase
  .from('customer_reviews')
  .select('overall_rating, customer_type')
  .eq('restaurant_id', restaurantId)
  .gte('review_date', start_date)    // ← BUG
  .lte('review_date', end_date + 'T23:59:59');

// Après  
const { data: reviews } = await supabase
  .from('customer_reviews')
  .select('overall_rating, customer_type')
  .eq('restaurant_id', restaurantId)
  .gte('order_date', start_date)     // ← Aligné avec dashboard
  .lte('order_date', end_date);      // ← Pas besoin du T23:59:59 pour date simple
```

Même correction pour `prevReviews` (lignes 166-171).

**Fichier** : `supabase/functions/generate-weekly-report/index.ts`

Appliquer la même modification aux requêtes de reviews.

### Partie 2 : Architecture future (recommandation)

Créer une table `daily_ratings` pré-agrégée par restaurant/date :

```sql
CREATE TABLE daily_ratings AS
SELECT 
  restaurant_id,
  order_date::date as date,
  COUNT(*) as review_count,
  AVG(overall_rating) as average_rating
FROM customer_reviews
WHERE order_date IS NOT NULL
GROUP BY restaurant_id, order_date::date;
```

Cela permettrait :
- Cohérence garantie entre dashboard et rapports
- Performances améliorées (pas de recalcul)
- Source unique de vérité

Cette partie est optionnelle et peut être implémentée ultérieurement.

## Fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `supabase/functions/generate-ai-report/index.ts` | `review_date` → `order_date` (2 requêtes) |
| `supabase/functions/generate-weekly-report/index.ts` | `review_date` → `order_date` (2 requêtes) |

## Résultat attendu

Après correction, les rapports WhatsApp afficheront :
- **Juvisy semaine 12-18** : 4.41 (39 avis) — identique au dashboard
- **Semaine précédente** : valeur alignée également

Le message passera de "Gros gap vs 4.39" à "Gros gap vs 4.41".
