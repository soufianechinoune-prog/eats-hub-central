

# Fix: ScrollArea dans le Classement par Étape

## Problème
Le `ScrollArea` avec `max-h-[400px]` ne fonctionne pas car Radix ScrollArea a besoin d'une hauteur fixe sur le composant, pas juste un `max-height`. Résultat : la liste s'affiche en entier sans scroll possible.

## Solution

**Fichier** : `src/components/analytics/ConversionRankingByStage.tsx` (ligne 134)

Remplacer :
```tsx
<ScrollArea className={cn(showAll && allRankings.length > 10 && "max-h-[400px]")}>
```

Par :
```tsx
<ScrollArea className={cn(showAll && allRankings.length > 10 && "h-[400px]")}>
```

Quand `showAll` est false (top 10), pas de hauteur fixe → la liste s'affiche normalement. Quand `showAll` est true et qu'il y a plus de 10 restaurants → hauteur fixe de 400px avec scroll interne.

## Résultat
- Top 10 par défaut : pas de scroll, liste courte
- "Voir tous" : liste scrollable dans un conteneur de 400px

