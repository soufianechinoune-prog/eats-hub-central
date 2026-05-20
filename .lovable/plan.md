
## Objectif

Mettre en évidence les frais d'offres Uber (0,89€ HT par commande promo taxée) via un **suivi continu et historique**, croisable avec le CA et la rentabilité.

L'onglet `/analytics/offers` existe déjà mais affiche surtout des KPI ponctuels sur la période sélectionnée. On va le **restructurer en sous-onglets** pour ajouter une vraie vue "suivi historique".

## Architecture proposée

Dans la page `/analytics/offers`, ajouter un `Tabs` à 3 sous-onglets :

```text
[ Synthèse ]   [ Historique frais 0,89€ ]   [ Croisements ]
   ↑ existant         ↑ NOUVEAU                ↑ NOUVEAU
```

- **Synthèse** = vue actuelle (KPI cards + table + heatmap)
- **Historique frais 0,89€** = nouveau, dédié au suivi continu
- **Croisements** = nouveau, mise en relation avec CA / rentabilité

Pas de nouvelle entrée sidebar — on enrichit l'onglet existant pour rester cohérent.

## Sous-onglet 1 — "Historique frais 0,89€"

Trois blocs verticaux :

**1. Bandeau hero**
- Total frais sur la période sélectionnée (gros chiffre)
- Évolution vs N-1 (delta % + flèche)
- Sparkline 12 derniers mois (mini courbe sous le chiffre)
- Nombre de commandes taxées + frais moyen réel (vs 0,89€ attendu)

**2. Courbe historique globale (toute la marque)**
- ComposedChart : barres = frais €, ligne = nb commandes taxées
- **Toggle de granularité** : Mois / Semaine / Jour (chips au-dessus du chart)
- Tooltip riche : frais, cmds taxées, frais/cmd
- Respecte la période globale (`AnalyticsContext`)

**3. Courbes par restaurant**
- Multi-line chart : 1 courbe par restaurant (top 8 + "Autres")
- Même toggle de granularité que ci-dessus
- Légende cliquable pour masquer/afficher
- Bouton "Voir tous" → table déroulante avec total par resto

## Sous-onglet 2 — "Croisements"

Deux graphiques côte à côte (responsive : empilés < 1280px) :

**1. Frais 0,89€ vs CA HT**
- ComposedChart mensuel
- Axe Y gauche : CA HT (`sales_excl_vat - item_promo_excl_vat`)
- Axe Y droit : frais offres
- Ligne secondaire : ratio `frais / CA` en %
- Permet de voir si les frais croissent plus vite que le CA

**2. Frais 0,89€ vs Rentabilité**
- Même format
- Axe Y gauche : versement total (`net_payout + meal_voucher_amount`)
- Axe Y droit : frais offres
- Ligne : taux de rentabilité réseau %
- Montre l'impact direct des frais sur la rentabilité

Scope : niveau réseau (agrégation globale), respect du filtre restaurant si pinning actif.

## Détail technique

**Données — `useOffersAnalytics` (hook existant)**
- Déjà tout présent : `monthlyStats` (frais + cmds taxées par mois × restaurant)
- Étendre pour supporter `granularity: 'day' | 'week' | 'month'` (paramètre du hook)
- Ajouter `weeklyStats` et `dailyStats` calculés depuis la requête source

**Croisement CA / rentabilité**
- Nouveau hook `useOfferFeesCorrelation(restaurantIds, startDate, endDate)`
- Source : RPC déjà existante `get_profitability_monthly` (renvoie `sales_excl_vat`, `item_promo_excl_vat`, `net_payout`, `meal_voucher_amount` par mois × resto)
- Croisement local : joindre par `month_key` avec `monthlyStats.totalFees`
- Pas de nouvelle RPC nécessaire

**Fichiers à créer / modifier**
- `src/components/analytics/OffersAnalyticsSection.tsx` — wrapper Tabs (3 sous-onglets)
- `src/components/analytics/offers/OffersSummaryTab.tsx` — extraction du contenu actuel
- `src/components/analytics/offers/OfferFeesHistoryTab.tsx` — NOUVEAU (sous-onglet 1)
- `src/components/analytics/offers/OfferFeesCorrelationTab.tsx` — NOUVEAU (sous-onglet 2)
- `src/hooks/useOffersAnalytics.ts` — ajout `granularity` + `weeklyStats` / `dailyStats`
- `src/hooks/useOfferFeesCorrelation.ts` — NOUVEAU

**Cohérence**
- Période globale via `useAnalyticsContext` (déjà en place)
- Sentinel UUID + `useActiveRestaurants` (rules mémoire respectées)
- Formatage dates locales `format(date, "yyyy-MM-dd")`, pas d'UTC

## Hors scope

- Pas de modif des KPI cards actuelles ni de la table "Analyse par restaurant"
- Pas de simulation "passer Gold"
- Pas d'export PDF dédié (ajout possible plus tard)
- Pas de migration SQL (toutes les données existent déjà)

## Livrable

Onglet `/analytics/offers` enrichi avec :
- Sous-onglet "Synthèse" (existant)
- Sous-onglet "Historique frais 0,89€" : bandeau + 2 courbes (global + par resto) avec toggle Jour/Semaine/Mois
- Sous-onglet "Croisements" : 2 graphiques (vs CA HT, vs Rentabilité)

Aucune modif backend, aucun risque de régression sur les vues existantes.
