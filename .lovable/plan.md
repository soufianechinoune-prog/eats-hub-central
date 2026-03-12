

## Diagnostic

Le problème vient de cette ligne dans `Analytics.tsx` (ligne 1388) :

```
{viewMode !== "eco-contribution" && <AnalyticsHeader />}
```

Le `AnalyticsHeader` (qui contient le sélecteur de restaurants) est **masqué** sur la page Éco-Contribution. Pourtant, le composant `EcoContributionSection` utilise `selectedRestaurants` venant du contexte global (localStorage).

Quand tu navigues via URL directement, le localStorage peut contenir une sélection précédente (ex: 1 seul restaurant). Comme il n'y a pas de sélecteur visible pour la changer, tu restes bloqué sur cette sélection.

Sur l'autre navigateur/onglet, le localStorage est vide (`selectedRestaurants = []`), donc le fallback `restaurants.map(r => r.id)` s'applique → 92 restaurants.

## Correction

**Ignorer `selectedRestaurants` dans `EcoContributionSection`** : cette page a ses propres filtres (année, recherche, solde +/-). Le filtre global de restaurants ne devrait pas s'appliquer ici.

### Fichier : `src/pages/Analytics.tsx`

Passer un tableau vide pour `selectedRestaurants` au composant `EcoContributionSection`, ou passer tous les IDs de restaurants. Cela force l'affichage de tous les restaurants ayant des données éco-contribution.

```tsx
<EcoContributionSection
  restaurants={restaurants || []}
  selectedRestaurants={[]}  // ← toujours vide = afficher tous
  selectedYear={selectedYear}
  selectedMonth={drillDownMonth}
  selectedPlatform={selectedPlatform}
/>
```

C'est un changement d'une seule ligne. Les filtres internes (recherche, solde +/-, année) continueront de fonctionner normalement.

