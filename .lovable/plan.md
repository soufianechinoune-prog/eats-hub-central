## Le vrai problème

La console montre clairement l'erreur :

```
[Analytics] get_profitability_daily error: { code: "57014", message: "canceling statement due to statement timeout" }
```

Concrètement : quand on affiche l'année 2026 entière (ou plusieurs marques), la fonction SQL `get_profitability_daily` demande au serveur d'agréger **jour par jour** plusieurs millions de commandes. Elle dépasse les 45 secondes et est annulée par Postgres.

Comme la requête plante, les graphiques (Rentabilité globale, Évolution des Promotions, Analyse Croisée) reçoivent un tableau vide ou les données partielles d'un cache antérieur — d'où l'impression qu'ils sont "bloqués sur janvier".

Ce n'est **pas** la fenêtre de période qui a été réduite : c'est la donnée qui n'arrive jamais.

## Ce que je vais faire

### 1. Nouvelle RPC `get_profitability_monthly`
- Même calculs que `get_profitability_daily` (sales, payout, net_payout, meal_voucher, orders_count, item_promo_incl_vat) mais agrégés **par mois** au lieu de par jour.
- 12× moins de lignes à grouper → s'exécute en quelques secondes même sur une année entière × tout le réseau.
- Mêmes règles RBAC (`is_super_admin` / `user_has_chain_access`), mêmes timezone Europe/Paris, mêmes formules.

### 2. RPC `get_profitability_daily` conservée
- Toujours utilisée pour les vues courtes (mois, plage < 60 jours) où l'agrégation journalière est nécessaire et rapide.
- Aucun changement de logique ou de chiffres.

### 3. Sélection automatique côté front (`Analytics.tsx`)
- Si la période > ~60 jours **et** que la granularité demandée est "monthly" → on appelle la version mensuelle.
- Sinon → on garde la version journalière (vue mois/semaine).
- Le résultat mensuel est mappé vers le même format `DailyFinanceChartRow` (1 entrée par mois, datée au 1er du mois) que consomment déjà `ProfitabilityComparisonChart`, `PromotionEvolutionChart` et `CrossDataAnalysisChart`.

### 4. Aucun impact sur les chiffres
- Mêmes colonnes sources sur `orders` (sales_incl_vat, net_payout, meal_voucher_amount, item_promo_incl_vat).
- Mêmes filtres de période, même TZ.
- Les 3 graphiques afficheront les 12 mois de l'année comme avant, simplement nourris par une RPC plus légère.

### 5. Garde-fou
- Garder `staleTime` et `retry: false` pour éviter de relancer en boucle si jamais ça timeout encore.
- Logguer côté navigateur le temps de réponse pour vérifier.

## Vérification après implémentation

1. Ouvrir `/analytics/revenue` sur "Année 2026" — le graphique Rentabilité globale doit afficher janvier → mai 2026 avec la courbe N-1 complète.
2. Vérifier que les graphiques Promotions et Analyse Croisée affichent aussi tous les mois.
3. Console : plus d'erreur `57014`.
4. Aucun écart de chiffres sur janvier (déjà visible aujourd'hui) vs avant.
