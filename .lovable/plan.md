

# Remplacer "Tout le mois" par "Sur la période" dynamique

## Problème
Le bouton "Tout le mois" dans le Funnel de Conversion est statique et incorrect quand la période sélectionnée est une année ou une plage personnalisée.

## Solution
Remplacer le label "Tout le mois" par un texte dynamique "Sur la période" qui reflète le choix fait dans le sélecteur de dates en haut de page. Le composant recevra les infos de période nécessaires pour construire ce label.

## Fichiers modifiés

### 1. `src/components/analytics/ConversionFunnelChart.tsx`
- Ajouter des props : `periodMode`, `selectedMonth`, `selectedYear` (déjà présent), `dateRange`
- Remplacer le texte fixe `"Tout le mois"` par un label dynamique :
  - Mode **mois** : "Tout le mois" (mars 2026 → reste pertinent)
  - Mode **année** : "Toute l'année" ou "Année 2026"
  - Mode **range** : "Sur la période" 
  - Mode **7d/30d/current_month/previous_week** : "Sur la période"
- Logique simple via une fonction `getPeriodLabel()` qui retourne le bon texte selon `periodMode`

### 2. `src/components/analytics/AnalyticsCharts.tsx`
- Passer les nouvelles props `periodMode`, `selectedMonth`, `dateRange` depuis le contexte Analytics vers `<ConversionFunnelChart />`
- Ces valeurs sont déjà disponibles via `useAnalyticsContext()` utilisé dans le composant parent

## Résultat attendu
- Vue "Année 2026" → bouton affiche **"Toute la période"**
- Vue "Mars 2026" → bouton affiche **"Tout le mois"**
- Vue "Période perso." → bouton affiche **"Toute la période"**

