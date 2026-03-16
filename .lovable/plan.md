
Objectif: corriger l’affichage Deliveroo du tableau “Comparatif des restaurants”, qui reste faux même sans cache.

Constat
- Tu ne te trompes pas: les chiffres affichés correspondent exactement à une mauvaise plage de dates.
- En base:
  - 2025-12-01 → 2025-12-31 = 30 613,26 € / 1 497 commandes
  - 2025-11-30 → 2025-12-30 = 31 282,15 € / 1 539 commandes
- Le screenshot montre précisément la 2e valeur. Donc ce n’est pas un problème de cache, c’est un bug de calcul de période côté front.

Cause racine
- `Overview.tsx` calcule bien la période mensuelle en date locale.
- Mais `useNetworkStats.ts` reconvertit ensuite `startDate` / `endDate` avec:
  - `startDate.toISOString().split("T")[0]`
  - `endDate.toISOString().split("T")[0]`
- En fuseau France, minuit local “2025-12-01 00:00” devient “2025-11-30T23:00:00.000Z”, donc la date tronquée devient `2025-11-30`.
- Résultat:
  - inclusion du 30 novembre
  - exclusion du 31 décembre
- C’est exactement ce qui produit les montants 31 282 € / 1 539 visibles dans ton écran.

Pourquoi le bug persiste après suppression du cache
- Parce que la requête refaite est toujours mauvaise.
- Le cache n’est pas la source ici; la plage demandée au backend est erronée.

Plan de correction
1. Corriger `useNetworkStats.ts`
- Remplacer tous les `toISOString().split("T")[0]` utilisés pour des dates “jour/mois” par un formatage local stable (`format(date, "yyyy-MM-dd")`), comme c’est déjà fait dans `Overview.tsx`.
- Faire la même correction pour les dates N-1.

2. Vérifier les autres hooks qui utilisent le même anti-pattern
- Priorité aux hooks qui pilotent des KPI mensuels/journaliers ou des RPC à bornes inclusives:
  - `useNetworkStats.ts`
  - `useOverviewData.ts` (certaines sous-requêtes utilisent déjà `startDateStr/endDateStr`, d’autres utilisent encore `toISOString()`)
- Ne corriger que les usages “date-only”; conserver les timestamps complets là où on veut réellement une heure UTC.

3. Harmoniser la règle
- Règle à appliquer:
  - pour une période calendrier (jour, mois, plage choisie par l’utilisateur): utiliser `yyyy-MM-dd` en local
  - pour un événement horodaté précis: garder un timestamp complet
- Cela évitera que le bug réapparaisse ailleurs.

4. Vérifications après correction
- Décembre 2025 / Argenteuil / Deliveroo dans le comparatif:
  - CA ≈ 30 613 €
  - Cmds = 1 497
  - Panier ≈ 20,45 €
  - Versement ≈ 16 952 €
- Vérifier aussi qu’on n’a pas cassé:
  - vue réseau
  - vue épinglée
  - comparaison N-1
  - autres périodes mensuelles

Détail technique
- Fichier principal impacté: `src/hooks/useNetworkStats.ts`
- Le bug est très probablement concentré là pour le tableau affiché dans ton screenshot, car ce tableau consomme `useNetworkStats`.
- `useOverviewData` semble déjà recevoir `startDateStr` / `endDateStr` corrects depuis `Overview.tsx`, donc il peut afficher d’autres blocs avec des valeurs justes pendant que le comparatif reste faux.

Résultat attendu
- Le tableau “Comparatif des restaurants” utilisera enfin la vraie période du mois sélectionné.
- Les chiffres Deliveroo de décembre 2025 pour Argenteuil ne reprendront plus le 30 novembre par erreur.
