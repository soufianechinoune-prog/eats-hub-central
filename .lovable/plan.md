
# Nouvelle page : Comparaison Temps de Preparation + Livraison

## Objectif
Creer une page de comparaison dediee au "Temps de preparation + livraison" (temps total commande-livraison) avec les memes fonctionnalites que la page "Comparaison Temps de preparation" actuelle.

## Architecture

La nouvelle page repliquera exactement le design de `/compare/prep-time` avec :
- Tri multi-colonnes (Rang, Nom, Temps, Commandes)
- Barre de recherche en temps reel
- Export PDF complet
- Section KPIs reseau (Plus rapide, Plus lent, Moyenne, etc.)
- Selecteur de periode avance (OverviewPeriodSelector)
- Toggle Epingles/Reseau (NetworkViewToggle)
- Selecteur de plateforme (Uber Eats, Deliveroo, Global)
- Heatmap des patterns temporels

## Differences avec Temps de preparation

| Element | Temps preparation | Temps prep+livraison |
|---------|-------------------|---------------------|
| Champ DB | `initial_prep_time_minutes` | `total_prep_delivery_time_minutes` |
| Seuil Excellent | <= 4 min | <= 25 min |
| Seuil Tres bien | 4-5 min | 25-30 min |
| Seuil Bon | 5-6 min | 30-35 min |
| Seuil A surveiller | 6-8 min | 35-40 min |
| Seuil Lent | > 8 min | > 40 min |
| Icone | Clock (amber) | Truck (violet) |
| Couleur primaire | Amber (#F59E0B) | Violet (#8B5CF6) |

## Fichiers a creer

### 1. Page principale
`src/pages/TotalDeliveryTimeComparison.tsx`
- Copie de PrepTimeComparison.tsx adaptee
- Champ de donnees : `total_prep_delivery_time_minutes`
- Nouveaux seuils de performance
- Icone Truck, couleur violet
- Titre : "Comparaison Temps prepa+livraison"
- localStorage key : `total-delivery-time-comparison-state`

### 2. Composants
`src/components/compare/TotalDeliveryTimeFullRankingTable.tsx`
- Table avec tri, recherche, pagination
- Seuils adaptes (25-40 min)
- Barres de progression couleur adaptees
- Redirection vers `/analytics/operations?tab=totalDelivery`

`src/components/compare/TotalDeliveryTimeInsightsSection.tsx`
- KPIs avec seuils adaptes
- Icones et couleurs violet

`src/components/compare/TotalDeliveryTimeHeatmapGrid.tsx`
- Heatmap heure/jour avec seuils adaptes

### 3. Hook d'export
`src/hooks/useTotalDeliveryTimeExport.ts`
- PDF avec couleur violet
- Seuils de performance adaptes

### 4. Route
Ajouter dans `src/App.tsx` :
- Route : `/compare/total-delivery-time`

## Section technique

### Seuils de performance (minutes)
```text
Excellent     : <= 25 min  (vert emeraude)
Tres bien     : 25-30 min  (vert)
Bon           : 30-35 min  (ambre)
A surveiller  : 35-40 min  (orange)
Lent          : > 40 min   (rouge)
```

### Requete Supabase
```typescript
supabase
  .from("order_history")
  .select("restaurant_id, total_prep_delivery_time_minutes, order_datetime, platform")
  .in("restaurant_id", restaurantIds)
  .gte("order_datetime", dateRange.start.toISOString())
  .lte("order_datetime", dateRange.end.toISOString())
  .not("total_prep_delivery_time_minutes", "is", null)
```

### Formatage temps
Le formatage existant (`formatMinutesToDisplay`) sera reutilise car il gere deja les durees plus longues.

### Persistance localStorage
```typescript
const STORAGE_KEY = "total-delivery-time-comparison-state";
// Structure identique a prep-time-comparison-state
```

## Resume des livrables

1. **TotalDeliveryTimeComparison.tsx** - Page principale
2. **TotalDeliveryTimeFullRankingTable.tsx** - Table avec tri/recherche
3. **TotalDeliveryTimeInsightsSection.tsx** - Section KPIs
4. **TotalDeliveryTimeHeatmapGrid.tsx** - Heatmap patterns
5. **useTotalDeliveryTimeExport.ts** - Export PDF
6. **App.tsx** - Ajout route `/compare/total-delivery-time`
