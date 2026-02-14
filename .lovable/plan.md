
# Ajouter le toggle Epingles/Reseau au niveau global de la page Analytics

## Statut: ✅ Implémenté

Le `NetworkViewToggle` est désormais dans le bandeau `AnalyticsHeader` et influence tous les onglets Analytics via `AnalyticsContext.isNetworkView`.

### Fichiers modifiés
- `src/contexts/AnalyticsContext.tsx` - ajout `isNetworkView` + persistance localStorage
- `src/components/analytics/AnalyticsHeader.tsx` - toggle dans le bandeau + comptages pinned/actifs
- `src/components/analytics/OperationsAnalytics.tsx` - filtre réactif au toggle
- `src/components/analytics/UberOneAnalysis.tsx` - supprimé le toggle local, utilise le contexte
- `src/pages/Analytics.tsx` - restaurantFilter réactif au toggle
