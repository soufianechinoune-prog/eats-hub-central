

## Objectif
Ajouter une vérification de marque dans `RestaurantDetail.tsx` : si un `selectedChainId` est actif et que le restaurant chargé n'appartient pas à cette marque, afficher un message de blocage au lieu des données.

## Correction dans `src/pages/RestaurantDetail.tsx`

1. **Importer** `useAnalyticsContext` depuis `@/contexts/AnalyticsContext`.
2. **Extraire** `selectedChainId` du contexte.
3. **Après le chargement du restaurant** (quand `restaurant` est disponible et `selectedChainId` est non-null), comparer `restaurant.chain_id` avec `selectedChainId`.
4. **Si mismatch** : afficher un écran simple avec un message "Ce restaurant n'appartient pas à la marque sélectionnée" et un bouton retour vers `/restaurants`.
5. **Si `selectedChainId === null`** : afficher normalement (pas de filtre marque actif).

### Code ajouté (après la ligne 67, avant le rendu principal)

```typescript
const { selectedChainId } = useAnalyticsContext();

// Après le bloc isLoading, avant le rendu principal :
if (!isLoading && restaurant && selectedChainId && restaurant.chain_id !== selectedChainId) {
  return (
    <div className="p-8 text-center space-y-4">
      <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Ce restaurant n'appartient pas à la marque sélectionnée</h2>
      <Button variant="outline" onClick={() => navigate("/restaurants")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux restaurants
      </Button>
    </div>
  );
}
```

## Résultat attendu
- Un utilisateur sur TASTY qui tenterait d'accéder à un restaurant Chicken Street via URL directe verrait le message de blocage.
- Si aucune marque n'est sélectionnée, tout fonctionne normalement.
- Aucun impact sur les autres pages.

