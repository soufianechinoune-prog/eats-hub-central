

## Plan : Supprimer le chargement des reviews brutes pour l'onglet Aperçu

### Diagnostic

Ton ingénieur a raison sur le principe : `needsReviews` inclut `"overview"`, ce qui déclenche le chargement de 74K+ lignes même pour l'onglet Aperçu.

Cependant, **on ne peut pas simplement retirer `"overview"` de `needsReviews`** sans casser les graphiques. Actuellement, `ReviewsOverview` utilise encore les reviews brutes pour :

1. **Le graphique d'évolution** (daily/monthly ratings) — calculé ligne par ligne dans `dailyRatings` (lignes 244-322)
2. **La moyenne glissante 90 jours** — calculée via `useReviewsStats` avec `allReviewsForRolling`
3. **Les variations N-1** (`ratingVariation`, `volumeVariation`) — calculées côté client avec la période précédente

### Correction en 2 étapes

**Étape 1 — Enrichir la RPC `get_reviews_overview_stats`**

Ajouter au retour SQL :
- `monthly_evolution` : tableau `[{month, year, avg_rating, count}]` agrégé par mois
- `daily_evolution` : tableau `[{date, avg_rating, count}]` agrégé par jour (pour les périodes courtes)
- `previous_period` : `{avg_rating, total_count}` pour la période N-1 (même durée, décalée)

Fichier : nouvelle migration SQL modifiant `get_reviews_overview_stats`.

**Étape 2 — Adapter le frontend**

- `src/pages/Reviews.tsx` : retirer `"overview"` de `needsReviews` (ligne 112)
- `src/pages/Reviews.tsx` : retirer `isLoadingExtended` du loading de l'onglet overview (ligne 161)
- `src/components/reviews/ReviewsOverview.tsx` : utiliser `overviewStats.monthly_evolution` et `overviewStats.daily_evolution` au lieu de calculer `dailyRatings` à partir des reviews brutes
- `src/components/reviews/ReviewsOverview.tsx` : utiliser `overviewStats.previous_period` pour les variations au lieu de `stats.ratingVariation`
- `src/hooks/useReviews.ts` : mettre à jour l'interface `ReviewsOverviewStats` avec les nouveaux champs

### Résultat attendu
- Onglet Aperçu : **0 lignes individuelles chargées**, uniquement 1 appel RPC
- Graphiques d'évolution alimentés par les agrégats SQL
- Variations N-1 calculées en SQL
- La moyenne glissante 90j ne sera plus affichée sur l'onglet Aperçu (elle reste disponible sur l'onglet Météo qui charge les reviews étendues)

### Fichiers modifiés
- Migration SQL (enrichir `get_reviews_overview_stats`)
- `src/hooks/useReviews.ts` (interface)
- `src/pages/Reviews.tsx` (retirer "overview" de needsReviews + loading)
- `src/components/reviews/ReviewsOverview.tsx` (utiliser les données RPC pour les graphiques)

