## Objectif

Afficher le **% de dépenses publicitaires Uber Eats / CA TTC** par restaurant, en global réseau, et selon la période sélectionnée. Indicateur neutre (pas de seuil contractuel, la plateforme sert plusieurs chaînes).

## Données — confirmé en base

- **Dépenses pub Uber** : `payout_adjustments` où `category = 'advertising'`
  - "Dépenses publicitaires" (123 lignes, -26 583,90 €) — prélèvement
  - "Crédits publicitaires" (1 ligne, +3,48 €) — remboursement
  - → `ads_spend = ABS(SUM(amount))` sur les deux libellés combinés
- **CA TTC** : `orders.sales_incl_vat` (source canonique, Europe/Paris)
- **Hors périmètre** : `marketing_adjustment` (cofinancement BOGO, déjà tracké ailleurs)
- **V1 = Uber Eats uniquement**. Deliveroo : non affiché tant que les Ads Deliveroo ne sont pas importées.

## Calcul

```
Pour chaque restaurant et période :
  ads_spend   = ABS(SUM(payout_adjustments.amount
                        WHERE category='advertising'
                          AND payout_date BETWEEN start AND end))
  revenue_ttc = SUM(orders.sales_incl_vat
                        WHERE (order_datetime AT TIME ZONE 'Europe/Paris')::date
                              BETWEEN start AND end)
  ads_pct     = ads_spend / NULLIF(revenue_ttc, 0) * 100

Réseau = SUM(ads_spend) / SUM(revenue_ttc)   -- jamais une moyenne de pourcentages
```

## Implémentation

### 1. RPC `get_ads_revenue_ratio` (SECURITY DEFINER)

```sql
get_ads_revenue_ratio(
  p_start_date     date,
  p_end_date       date,
  p_restaurant_ids uuid[]
) RETURNS TABLE (
  restaurant_id uuid,
  ads_spend     numeric,
  revenue_ttc   numeric,
  ads_pct       numeric
)
```

- Filtrage dates en `AT TIME ZONE 'Europe/Paris'` sur `orders`.
- Bornes naturelles sur `payout_date` (déjà type `date`).
- Aggrégat par `restaurant_id`.

### 2. Hook `useAdsRevenueRatio`

`src/hooks/useAdsRevenueRatio.ts` :
- Format date local (`format(date, "yyyy-MM-dd")`)
- Attente sentinelle UUID `0000...`
- Resolve "All restaurants" → IDs explicites
- Retour : `{ networkAdsSpend, networkRevenue, networkPct, byRestaurant: [{id, name, adsSpend, revenue, pct}], isLoading }`

### 3. Affichage

**a) Overview — KPI Card "% Pub / CA Uber"**
- Bloc neutre (pas d'alerte rouge/vert) avec :
  - Grand chiffre : `2,4 %`
  - Sous-ligne : `26 580 € de pub / 1 098 200 € de CA TTC`
  - Tag plateforme "Uber Eats" (cohérent avec règles de filtrage plateforme)
- Visible uniquement si plateforme = Uber Eats ou Global.

**b) Tableau "Comparaison restaurants"**
- Nouvelle colonne **"% Pub / CA"** triable, format `X,X %`.
- Tooltip : `€ pub / € CA TTC` sur la période.
- Pas de code couleur conditionnel (neutre).

### 4. Périmètre V1

- Uber Eats only.
- Pas de graphique d'évolution mensuel pour la V1 (sera ajouté plus tard si utile).
- Deliveroo : aucune mention dans la UI (pas de "données indisponibles" — on n'expose simplement pas l'indicateur quand plateforme = Deliveroo).

## Fichiers à créer / modifier

- **Nouveau** : `supabase/migrations/<ts>_get_ads_revenue_ratio.sql`
- **Nouveau** : `src/hooks/useAdsRevenueRatio.ts`
- **Nouveau** : `src/components/analytics/AdsRevenueRatioCard.tsx`
- **Modifié** : page Overview pour intégrer la carte
- **Modifié** : tableau de comparaison restaurants (ajout colonne)

OK pour lancer l'implémentation ?
