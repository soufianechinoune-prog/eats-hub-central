
# Plan : Suppression des tableaux inutiles

## Composants à supprimer

| Composant | Lignes | Description |
|-----------|--------|-------------|
| Performance par période | 445-461 | Card contenant `RatingsHeatmapGrid` |
| Analyse des Tags Réseau | 463-466 | Composant `NetworkTagsAnalysis` |

## Modifications

### Fichier : `src/pages/RatingsComparison.tsx`

1. **Supprimer les imports inutilisés** (lignes 7 et 13, 17) :
   - `BarChart3` de lucide-react (plus utilisé après suppression)
   - `RatingsHeatmapGrid` 
   - `NetworkTagsAnalysis`

2. **Supprimer le code des composants** :
   - Lignes 445-461 : Card "Performance par période"
   - Lignes 463-466 : `NetworkTagsAnalysis`

3. **Supprimer le code inutilisé** :
   - Lignes 240-249 : `heatmapStats` (useMemo qui n'est plus nécessaire)

## Résultat

La page conservera :
- Les KPIs globaux
- La section Insights
- Le tableau de classement complet (`RatingsFullRankingTable`)
- La distribution des notes (bar chart)

La page sera plus légère et focalisée sur les métriques essentielles.
