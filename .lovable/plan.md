

# Ajouter le % du CA Brut à côté du badge plateforme dans les sous-lignes

## Objectif

Dans les sous-lignes extensibles du tableau "Comparatif des restaurants", afficher le pourcentage de contribution au CA total du restaurant à gauche du badge plateforme (ex: "71% Uber Eats", "29% Deliveroo").

## Changements

### `src/components/overview/RestaurantComparisonTable.tsx`

**1. Ajouter un prop `revenueShare` au composant `PlatformSubRow`**

Ajouter un prop `revenueShare` (number, pourcentage 0-100) à l'interface du composant. Il sera calculé par le parent : `(data.revenue / resto.revenue) * 100`.

**2. Afficher le pourcentage à gauche du badge**

Dans la cellule du nom de plateforme (ligne 98-110), ajouter un `<span>` avec le pourcentage avant le `<Badge>` :

```tsx
<TableCell className="pl-8 text-xs">
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] text-muted-foreground font-medium min-w-[28px] text-right">
      {revenueShare.toFixed(0)}%
    </span>
    <Badge ...>
      {platform}
    </Badge>
  </div>
</TableCell>
```

**3. Passer le prop depuis les appels**

Aux lignes 370-385, calculer et passer le pourcentage :

```tsx
<PlatformSubRow
  platform="Uber Eats"
  data={resto.platformBreakdown.uber}
  revenueShare={resto.revenue > 0 ? (resto.platformBreakdown.uber.revenue / resto.revenue) * 100 : 0}
  ...
/>
<PlatformSubRow
  platform="Deliveroo"
  data={resto.platformBreakdown.deliveroo}
  revenueShare={resto.revenue > 0 ? (resto.platformBreakdown.deliveroo.revenue / resto.revenue) * 100 : 0}
  ...
/>
```

### Fichier modifié
- `src/components/overview/RestaurantComparisonTable.tsx`

### Résultat visuel
Chaque sous-ligne affichera par exemple : `71% [Uber Eats]` et `29% [Deliveroo]`, donnant immédiatement la répartition du CA par plateforme.

