## Diagnostic

Trois problèmes distincts cohabitent sur `/analytics/finances` quand on est sur « Mars 2026 / Tous les restaurants ».

### 1. « 1000 versements » = troncature silencieuse (root cause des écarts de chiffres)

Le tableau **Comparatif de Rentabilité** (haut) appelle la RPC `get_orders_finance_detail`, qui renvoie **une ligne par (restaurant × jour)**. Sur ~33 restos × 31 jours = ~1023 lignes → on tape **le plafond PostgREST par défaut (`db-max-rows = 1000`)**. Le client `supabase.rpc()` ne pagine pas, donc on reçoit 1000 lignes max, silencieusement tronquées.

Conséquence : tous les totaux du haut sont **sous-estimés** par rapport au bas qui, lui, utilise désormais les RPC pré-agrégées (`get_finances_daily_uber`, etc.) qui retournent ~31 lignes (jamais tronqué).

Preuve dans la capture :
- Haut : 2 440 717 € CA / 130 466 cmd / 11 647 € remb.
- Bas (Total mars partiel) : 2 468 093 € / 132 491 cmd / 16 099 € remb.

Le bas est **plus gros** que le haut alors qu'il couvre moins de jours → preuve de la troncature.

### 2. Périodes désynchronisées entre haut et bas

- Haut (`get_orders_finance_detail(p_year, p_month)`) : **mars entier** (01 → 31).
- Bas (`OrdersAnalysisSection`) : reçoit `startDate` / `endDate` venant du sélecteur global `useDataGranularity` (ex. « 7 derniers jours » → 24–31 mars).

Donc même sans troncature, les deux blocs ne couvrent pas la même fenêtre et ne peuvent pas être confrontés.

### 3. Libellé « 1000 versements » trompeur

Le compteur affiche `payouts.length` brut. Avec la troncature, c'est un round-number suspect. Une fois la pagination en place il faudra l'afficher correctement, et idéalement le renommer en « lignes jour×resto » puisque ce ne sont pas des versements Uber mais des agrégats jour×resto issus de `orders`.

## Plan de correction

### A. Paginer la récupération du Comparatif

Dans `src/pages/Analytics.tsx`, remplacer l'appel unique `supabase.rpc('get_orders_finance_detail', ...)` par une boucle de pagination conforme au standard projet (mémoire « Pagination Standard ») :

```text
PAGE_SIZE = 1000
loop:
  rows = supabase.rpc(...).range(from, from + PAGE_SIZE - 1)
  push rows
  if rows.length < PAGE_SIZE: break
  from += PAGE_SIZE
```

Note : pour qu'un `.range()` sur RPC soit stable, ajouter un `ORDER BY restaurant_id, payout_date` dans `get_orders_finance_detail` (migration), sinon l'ordre est indéfini.

Alternative préférable si on accepte une migration : créer `get_orders_finance_detail_v2` côté serveur qui renvoie **déjà agrégé par jour uniquement** (ou par restaurant uniquement) selon ce dont a besoin le tableau Comparatif — beaucoup moins de lignes et zéro risque de cap. À voir si la table Comparatif a besoin du détail par restaurant ; si oui, on garde la pagination ; si non, on consolide côté SQL.

→ Approche retenue dans ce plan : **pagination côté hook** (changement minimal, sans toucher au format de la RPC ni casser `ProfitabilityComparisonTable` qui filtre par `restaurant_id`).

### B. Synchroniser la période du bloc « Analyse par Commandes »

Dans `src/pages/Analytics.tsx`, quand `drillDownMonth` est défini, passer à `FinancesSection` des `startDate` / `endDate` calés sur le mois drillé (1er → dernier jour) au lieu des dates globales `useDataGranularity`. Préserver les dates globales pour les autres sections qui n'ont pas de drill-down.

Concrètement : calculer `financesStartDate` / `financesEndDate` :
- si `drillDownMonth` → 1er et dernier jour du mois dans `selectedYear`
- sinon → `startDate` / `endDate` actuels

Les passer à `<FinancesSection startDate={financesStartDate} endDate={financesEndDate} />`.

Résultat attendu : haut et bas couvrent strictement la même fenêtre → totaux comparables ligne à ligne.

### C. Corriger le libellé « 1000 versements »

Dans `ProfitabilityComparisonTable.tsx` (ou là où le libellé est rendu sous « Mars 2026 »), remplacer `{payouts.length} versements` par une formulation correcte :

- texte : « X lignes (jour × restaurant) » au lieu de « versements », puisque la source n'est pas la table `payouts` mais une agrégation de `orders`.
- s'assurer que la valeur reflète bien le nombre paginé complet une fois (A) appliqué.

### D. Validation

1. `/analytics/finances`, Mars 2026, « Tous les restaurants » :
   - Vérifier que le compteur ne montre plus 1000 pile.
   - Vérifier que `Total` du bloc « Par Jour » ≈ ligne « Mars 2026 » du Comparatif pour : CA TTC, commandes, remboursements, commission, promos, versement Uber.
2. Drill sur un mois plus petit (ex. Avril en cours) : pas de régression, totaux identiques entre haut et bas.
3. Plateforme Deliveroo : non affectée (chemin séparé, pas de RPC `get_orders_finance_detail`).

## Fichiers impactés

- `src/pages/Analytics.tsx` — pagination de `dailyPayoutsData` + dérivation `financesStartDate/EndDate` quand drill-down mois.
- `src/components/analytics/ProfitabilityComparisonTable.tsx` — libellé « versements ».
- Migration SQL — ajouter `ORDER BY restaurant_id, payout_date` à `get_orders_finance_detail` pour stabiliser la pagination.

## Hors-scope

- Refonte de la RPC en agrégat mensuel pur (peut être fait plus tard si on veut diviser encore le coût).
- Re-design visuel du bloc « Analyse par Commandes ».
