

## Plan révisé : Optimiser la page Avis (synthèse des deux diagnostics)

### Problème
La page Avis charge 74K+ lignes via `select("*")` avec 2 appels `useCustomerReviews` = ~150 requêtes paginées au chargement.

### Corrections

**1. Migration SQL — RPC `get_reviews_overview_stats`**
Agrège directement en SQL : note moyenne, distribution des notes, total, distribution thumbs, top tags. L'onglet Aperçu n'a plus besoin de lignes individuelles.

**2. `src/hooks/useReviews.ts` — Select ciblé**
Remplacer `select("*")` par les colonnes réellement utilisées dans chaque fonction (`fetchAllCustomerReviews` et `fetchAllMenuItemReviews`).

**3. `src/pages/Reviews.tsx` — Chargement conditionnel + fusion des appels**
- Ajouter un state `activeTab` et passer `enabled` conditionnel à chaque hook
- Fusionner les 2 appels `useCustomerReviews` en un seul sur la période étendue (90j), puis filtrer en mémoire pour la période normale
- Onglet "Aperçu" : utilise la RPC uniquement (0 lignes)
- Onglet "Clients" : charge les reviews individuelles seulement si actif
- Onglet "Plats" : charge menu_item_reviews seulement si actif
- Onglet "Météo" : charge les reviews étendues seulement si actif

**4. `src/components/reviews/ReviewsOverview.tsx`**
Adapter pour consommer les stats de la RPC au lieu des tableaux de lignes brutes.

### Fichiers modifiés
- Migration SQL (nouvelle RPC)
- `src/hooks/useReviews.ts`
- `src/pages/Reviews.tsx`
- `src/components/reviews/ReviewsOverview.tsx`

### Résultat attendu
- Onglet Aperçu : 1 requête SQL agrégée, affichage < 1s
- Onglets secondaires : chargement à la demande uniquement
- Payload réduit (colonnes ciblées)
- Plus de double appel inutile

