
# Naviguer vers Finances avec la bonne plateforme selectionnee

## Probleme

Actuellement, quand on clique sur "Rentabilite" depuis n'importe quelle carte (Global, Uber Eats, ou Deliveroo) dans la Vue d'ensemble, la navigation emmene toujours vers Finances & Frais sans pre-selectionner la bonne plateforme. On atterrit par defaut sur l'onglet Uber Eats.

## Solution

Modifier la fonction de navigation pour qu'elle pre-selectionne la plateforme correspondante a la carte cliquee.

## Details techniques

### Fichier modifie : `src/pages/Overview.tsx`

1. **Ajouter `setSelectedPlatform`** dans le destructuring de `useAnalyticsContext()` (ligne 158)

2. **Transformer `navigateToFinancesGlobal`** en une fonction parametree qui accepte la plateforme cible :
   - `navigateToFinances("uber_eats")` depuis la carte Uber Eats
   - `navigateToFinances("deliveroo")` depuis la carte Deliveroo  
   - `navigateToFinances("global")` depuis la carte Global

3. **Mettre a jour les 3 onClick** sur les MetricRow "Rentabilite" :
   - Carte Global (ligne 551) : `onClick={() => navigateToFinances("global")}`
   - Carte Uber Eats (ligne 588) : `onClick={() => navigateToFinances("uber_eats")}`
   - Carte Deliveroo (ligne 613) : `onClick={() => navigateToFinances("deliveroo")}`

La fonction appellera `setSelectedPlatform(platform)` avant de naviguer vers `/analytics/finances`, ce qui fera que la page Finances s'ouvrira directement sur le bon onglet plateforme.
