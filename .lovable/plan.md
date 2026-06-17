Supprimer les vignettes (cartes insights) de la page `/compare/ratings`.

### Changement
- **Fichier** : `src/pages/RatingsComparison.tsx`
- **Action** : Retirer le rendu du composant `<RatingsInsightsSection />` et son import associé.
- Les vignettes actuellement affichées (Meilleure note, Note la plus basse, Moyenne réseau, Écart max, Excellence, Attention, Plus commenté) seront supprimées de l'UI. Le reste de la page (classement complet, graphiques, filtres) reste inchangé.