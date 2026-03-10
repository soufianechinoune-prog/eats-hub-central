

## Plan: Simplifier la page Éco-Contribution

### Changements

**1. `src/components/analytics/EcoContributionSection.tsx`**
- Supprimer le système d'onglets "Synthèse" / "Détail (318)" — garder uniquement le contenu de la synthèse directement
- Supprimer les imports et références à `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` et `EcoContributionDetail`
- Supprimer l'état `activeTab`
- Le contenu actuel de `TabsContent value="synthese"` devient le contenu direct de la Card

**2. `src/components/analytics/AnalyticsHeader.tsx`**
- Ajouter un prop `hideFilters?: boolean`
- Quand `hideFilters` est `true`, masquer : le sélecteur de restaurants, les boutons plateforme (Uber/Deliveroo/Global), et le toggle Épinglés/Réseau
- Cela donnera une barre vide (ou quasi-vide) — on pourrait aussi masquer toute la barre

**3. `src/pages/Analytics.tsx`**
- Passer `hideFilters={true}` à `<AnalyticsHeader>` quand `viewMode === "eco-contribution"`
- L'EcoContributionSection continuera à recevoir `selectedPlatform="global"` et tous les restaurants par défaut (comportement déjà existant grâce au fallback dans le hook)

### Résultat
- Plus d'onglet "Détail" redondant
- Plus de sélection restaurant / plateforme / réseau en haut
- La vue globale avec recherche en bas reste le point d'entrée unique

