## Diagnostic

Tu vois deux écrans complètement différents pour la même page `/analytics/eco-contribution` :

| Capture | Marque active | Bandeau | Lignes affichées |
|---|---|---|---|
| #3 | Réseau (toutes marques) | **566 lignes · 99 restaurants · -7304,68 €** | données présentes ✅ |
| #1 et #2 | **Chicken Street** uniquement | **0 lignes · 0 restaurants · 0,00 €** | tout vide ❌ |

Pourtant en bas de la capture #1, on voit bien **106 restaurants Chicken Street** listés avec leurs SIRET et statut REP (donc la liste resto est OK). C'est uniquement le bloc "Prélèvements & Remboursements" (les lignes `payout_adjustments` + `deliveroo_orders`) qui retourne vide.

### Cause racine probable

Dans `useEcoContribution.ts`, les requêtes filtrent sur `restaurant_id IN (...)` avec les IDs de la marque Chicken Street active. Or **les lignes éco-contribution en base ne sont pas reliées au bon `restaurant_id`** pour cette marque, ou bien le `chain_id` des restos affichés ≠ celui des lignes payout.

Trois hypothèses à vérifier en SQL avant de toucher le code :

1. **Mismatch d'IDs** : les `payout_adjustments.restaurant_id` pour `category='eco_contribution'` pointent vers des UUIDs qui ne sont **pas dans `restaurants` filtrés par `chain_id = chicken_street`** (ex: anciens IDs avant succession, ou rattachés à une autre chaîne).
2. **`chain_id` NULL ou différent** sur les `restaurants` qui ont reçu les imports payout.
3. **Filtre marque trop strict** dans le hook parent : `selectedRestaurants` contient bien les 106 IDs Chicken Street mais aucun ne matche les lignes en base (les imports auraient été faits sous une autre marque/chaîne).

L'écart entre **99 restaurants ayant des lignes** (vue Réseau) et **106 restaurants Chicken Street** (vue marque) est suspect : si 99/106 sont bien Chicken Street, on devrait voir ~99 restos avec lignes en vue marque, pas 0.

## Étapes du plan

### 1. Investigation SQL (read-only, sans modifier le code)

Exécuter via `supabase--read_query` :

- Lister les distinct `restaurant_id` dans `payout_adjustments WHERE category='eco_contribution' AND payout_date >= '2026-01-01'` et vérifier combien appartiennent au `chain_id` Chicken Street.
- Comparer avec `restaurants WHERE chain_id = <chicken_street_uuid>`.
- Idem pour `deliveroo_orders WHERE history_type LIKE 'Eco-contribution%'`.
- Vérifier si certaines lignes ont `restaurant_id IS NULL` ou pointent vers des restos avec `chain_id` différent / NULL.

### 2. Identifier le type de défaut

Selon le résultat :

- **Cas A — IDs orphelins / chain_id manquant sur les restos** : créer une migration pour ré-assigner le bon `chain_id` aux restaurants concernés (à valider avec l'utilisateur avant exécution).
- **Cas B — restaurant_id obsolète sur les lignes payout** (succession de SIRET, ID resto changé) : créer une migration de remappage des `payout_adjustments.restaurant_id` via un mapping ancien_id → nouvel_id.
- **Cas C — bug de filtrage côté hook** (peu probable vu le code) : ajuster `useEcoContribution.ts`.

### 3. UX defensive (en complément)

Quand `restaurantIds.length > 0` mais `totals.lineCount === 0` :
- Afficher un message explicite : *"Aucune ligne éco-contribution rattachée à ces restaurants pour 2026. Vérifier le rattachement chain_id ou consulter la vue Réseau."*
- Afficher un mini-debug (en mode super_admin uniquement) listant `restaurantIds.length` + `byRestaurant.length` pour faciliter le diagnostic.

### 4. Validation post-fix

Recharger `/analytics/eco-contribution` avec marque Chicken Street et vérifier :
- Bandeau affiche un nombre de lignes proche de 566 (en filtrant par chain).
- Les 99 restaurants avec données apparaissent dans le tableau.
- Les drilldowns (RestaurantRow → EcoContributionDetail) montrent les lignes individuelles par mois.

## Détails techniques

- Hook concerné : `src/hooks/useEcoContribution.ts` — pas de bug évident, le filtre `.in("restaurant_id", restaurantIds)` est correct.
- Composant : `src/components/analytics/EcoContributionSection.tsx` ligne 77-79 → `restaurantIds = selectedRestaurants` (déjà filtré par chain via `useActiveRestaurants`).
- Tables impactées : `payout_adjustments`, `deliveroo_orders`, `restaurants` (colonne `chain_id`).
- Memory à respecter : isolation multi-tenant par `chain_id` (Core rule), donc toute migration doit préserver l'intégrité multi-marque.

## Ce que je ferai dès l'approbation

1. Lancer 3-4 requêtes SQL diagnostiques (read-only).
2. Te présenter les chiffres (combien d'IDs orphelins, combien de chain_id NULL, etc.).
3. Te proposer la migration ciblée correspondante avant de l'exécuter.
4. Ajouter le message d'erreur defensive dans l'UI.

Aucune modif destructive ne sera faite sans ton OK explicite sur les chiffres trouvés.
