
# Plan — Comparaison à périmètre constant (LFL) — Revenus & Ventes

## 1. Principe de calcul (la règle d'or)

Pour chaque mois M de la période sélectionnée :
- on calcule l'ensemble `R_N(M)` = restos avec ≥ 1 commande en M de l'année N
- on calcule `R_N-1(M)` = restos avec ≥ 1 commande en M de l'année N-1
- **périmètre LFL du mois M = `R_N(M) ∩ R_N-1(M)`**
- on agrège N et N-1 sur ce périmètre, mois par mois
- au total annuel : on additionne les 12 totaux mensuels LFL (donc un resto peut compter dans certains mois et pas d'autres — comportement retail standard)

Le périmètre LFL est **dynamique par mois**, jamais figé sur l'année.

## 2. Backend — 2 nouvelles RPC

### `get_lfl_scope_monthly(chain_id, restaurant_ids, year)`
Renvoie pour chaque mois (1-12) :
- `month`
- `restaurants_in_n` (uuid[])
- `restaurants_in_n_minus_1` (uuid[])
- `lfl_restaurants` (uuid[] — l'intersection)
- `total_restaurants_in_scope` (count des restos avec activité N ou N-1)
- `lfl_count`

Source : `SELECT DISTINCT restaurant_id FROM orders WHERE order_datetime AT TIME ZONE 'Europe/Paris'` groupé par (mois, année). Une seule requête, deux années. RBAC via `is_super_admin() OR user_has_chain_access`. `SET statement_timeout='30s'`.

### `get_profitability_monthly_lfl(chain_id, restaurant_ids, year)`
Mêmes colonnes que `get_profitability_monthly` (sales, payout, net_payout, meal_voucher, orders_count, item_promo_incl_vat) **mais agrégées uniquement sur le périmètre LFL de chaque mois**, pour N **et** N-1 en une seule réponse :
- 12 lignes × 2 ans
- chaque ligne porte aussi `lfl_restaurant_ids` (pour transparence)

Logique interne : CTE qui calcule l'intersection mois par mois, puis JOIN sur `orders` avec `unnest()` pour forcer l'index `idx_orders_restaurant_datetime`.

→ Les KPIs annuels LFL sont obtenus en sommant les 12 lignes.

## 3. Frontend

### 3.1 État global — `AnalyticsContext.tsx`
Ajout :
```ts
lflMode: boolean;
setLflMode: (b: boolean) => void;
```
Persisté en localStorage avec les autres préférences (sans hydration race).

### 3.2 Toggle UI — `Analytics.tsx` (header Revenus & Ventes)
À droite du sélecteur d'année :
```
[Switch] Périmètre constant (LFL)   [Info ⓘ tooltip]
```
Quand actif : badge vert "X / Y restos comparables" (clic → ouvre `LflScopeDialog`).

### 3.3 Nouveau composant — `LflScopeDialog.tsx`
Sheet/Dialog listant pour chaque mois :
- "Mars 2026 — 18 / 22 restos comparables"
- Exclus : nom + raison (`Pas d'activité en mars 2025` / `Pas d'activité en mars 2026` — déduit via les 2 ensembles)

### 3.4 Hook — `useLflProfitability.ts`
- `enabled: lflMode === true`
- Appelle `get_profitability_monthly_lfl` + `get_lfl_scope_monthly` en parallèle
- Renvoie `{ monthlyLfl, scopeByMonth, totalsLfl }`
- `staleTime: 5 min`, `retry: false`

### 3.5 Branchement dans `Analytics.tsx`
- `effectiveProfitabilityData` = `lflMode ? lflData.monthlyLfl : profitabilityData`
- Idem pour `prevProfitabilityData` (déjà inclus dans la réponse LFL)
- Pas d'appel doublon : si LFL ON, on **désactive** `get_profitability_monthly` standard pour éviter 2 RPC

### 3.6 KPIs — affichage du double delta
Composant `KPIComparisonBadge` :
- Mode normal : `+12,3% vs N-1`
- Mode LFL ON : `+12,3% brut · +7,1% LFL` (deux pills côte à côte, LFL en couleur primary)

### 3.7 Graphiques (`AnalyticsCharts.tsx`)
3 graphiques concernés (Rentabilité globale, Évolution CA, Évolution Promos, Analyse Croisée) :
- Reçoivent `effectiveProfitabilityData` (déjà mensualisé)
- Aucun changement de structure, juste la source
- Sous-titre dynamique : "Périmètre constant — N restos comparables" quand LFL ON

## 4. Garanties data

- **Aucune migration destructive** : 2 nouvelles RPC, rien n'est modifié sur les RPC existantes
- **Aucun changement** sur `orders`, `monthly_revenue`, `daily_sales_uber`
- Toggle OFF par défaut → comportement **identique à aujourd'hui**, zero régression possible
- Multi-tenant : RBAC standard via `user_has_chain_access`, sentinel UUID `0000...` respecté
- TZ Paris dans toutes les agrégations (mémoire `network-stats-tz-paris`)
- Pattern `unnest()` + ID arrays explicites (mémoire `rpc-empty-selection-handling-pattern`)

## 5. Hors scope (à confirmer plus tard si tu valides ce socle)

- LFL sur Finances & Frais, Conversion, Avis : même mécanique réplicable mais on attend ton OK sur Revenus & Ventes d'abord
- Export PDF avec mention "périmètre constant" : trivial à ajouter une fois le toggle stable
- Mode "Manuel" (choisir restos à exclure) : peut être ajouté plus tard sans casser

## 6. Détails techniques (section technique)

**Fichiers créés :**
- `supabase/migrations/<ts>_lfl_rpcs.sql` — `get_lfl_scope_monthly` + `get_profitability_monthly_lfl`
- `src/hooks/useLflProfitability.ts`
- `src/components/analytics/LflScopeDialog.tsx`
- `src/components/analytics/LflToggle.tsx`
- `src/components/analytics/KPIComparisonBadge.tsx` (ou extension d'un composant existant)

**Fichiers modifiés :**
- `src/contexts/AnalyticsContext.tsx` — ajout `lflMode`
- `src/pages/Analytics.tsx` — toggle dans header + branchement `effectiveProfitabilityData`
- `src/components/analytics/AnalyticsCharts.tsx` — sous-titre + source dynamique

**Important comme demandé** : avant chaque écriture de fichier, je te montrerai le code en bloc dans le chat pour validation. Tu valides → je crée. On commence par la migration SQL, puis le hook, puis l'UI.

## 7. Ordre d'implémentation proposé

1. Migration SQL (2 RPC) — je te montre le SQL, tu valides
2. Hook `useLflProfitability` — je te montre le TS
3. Toggle + contexte — je te montre les diffs
4. Branchement dans `Analytics.tsx` + KPIs double delta
5. Dialog "X / Y restos" avec liste exclus
6. Test visuel ensemble sur 2026 vs 2025
