

# Fix: deduplication des donnees hebdomadaires de conversion

## Probleme

La table `daily_conversion` contient des valeurs **identiques** pour chaque jour d'une meme semaine par restaurant (c'est Uber qui fournit la data a la semaine). Le code actuel **somme** toutes les lignes quotidiennes, ce qui produit :
- S1 = 1 jour (ex: samedi 1er mars seul) → valeur correcte × 1
- S2 = 7 jours identiques → valeur correcte × 7

Resultat : S1 parait anormalement faible et les autres semaines sont gonflees.

## Solution

Au lieu de sommer directement toutes les lignes par semaine, **deduplicquer par (restaurant, semaine)** : ne garder qu'une seule ligne par restaurant par semaine, puis sommer ces lignes dedupliquees.

## Fichiers modifies

### 1. `src/components/analytics/AnalyticsCharts.tsx` (lignes ~1232-1247 et ~1249-1260)

Dans `aggregatedConversionData`, section weekly :
- Creer une cle composite `restaurant_id + weekKey`
- Ne garder qu'une seule ligne par couple (restaurant, semaine) — la premiere rencontree
- Puis sommer par semaine comme actuellement

Meme correction pour `prevWeeklyMap`.

### 2. `src/components/analytics/ConversionFunnelChart.tsx` (lignes ~289-300)

Dans `weeklyBreakdown` :
- Meme logique de deduplication par (restaurant_id, weekKey)
- Ne garder qu'une ligne par restaurant par semaine avant de sommer

### 3. Verifier aussi les aggregations mensuelles et daily

Les memes duplications affectent potentiellement :
- Le mode "monthly" (un mois complet a 4 semaines = valeurs × ~28-31)
- Le mode "daily" (correct car on somme par date, mais chaque restaurant apparait avec la meme valeur chaque jour → les totaux sont gonfles)

Le probleme est **structural** : toutes les aggregations de `daily_conversion` qui somment doivent deduplicquer par restaurant+semaine d'abord.

La correction consistera a ecrire une fonction utilitaire `deduplicateWeeklyConversion(data)` qui :
1. Groupe par `(restaurant_id, weekStartKey)`
2. Garde une seule ligne par groupe
3. Retourne le tableau deduplique

Cette fonction sera appelee avant toute aggregation (weekly, monthly, daily, funnel).

