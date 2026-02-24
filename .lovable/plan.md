

# Détail Uber / Deliveroo par restaurant dans le Comparatif

## Concept

Ajouter une flèche d'expansion sur chaque ligne du tableau. Au clic, deux sous-lignes apparaissent sous le restaurant : une ligne **Uber Eats** et une ligne **Deliveroo**, chacune avec un badge plateforme et ses propres métriques.

## Données disponibles

Le hook `useNetworkStats` calcule déjà en interne les métriques par plateforme (variables `uberRevenue`, `deliverooRevenue`, `uberOrders`, `deliverooOrders`, `uberNetPayout`, `deliverooNetPayout`) mais ne les expose pas. Les métriques opérationnelles (note, erreurs, prépa+livr, inactivité) restent Uber-only car les sources Deliveroo ne fournissent pas ces données.

## Modifications

### 1. `src/hooks/useNetworkStats.ts`
- Ajouter à l'interface `RestaurantNetworkStats` un objet `platformBreakdown` :
```typescript
platformBreakdown: {
  uber: { revenue: number; orders: number; avgBasket: number; netPayout: number; profitability: number | null };
  deliveroo: { revenue: number; orders: number; avgBasket: number; netPayout: number; profitability: number | null };
}
```
- Dans le `useMemo` de calcul (ligne ~353-492), construire cet objet à partir des variables déjà existantes (`uberRevenue`, `deliverooRevenue`, etc.) et l'inclure dans le return

### 2. `src/components/overview/RestaurantComparisonTable.tsx`
- Importer `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` et `Badge` et l'icône `ChevronRight`
- Ajouter un state `expandedRows: Set<string>` pour tracker quelles lignes sont ouvertes
- Sur chaque `TableRow` de restaurant, ajouter une icône chevron dans la première colonne (à côté du numéro) qui toggle l'expansion
- Sous chaque ligne principale, rendre conditionnellement 2 sous-lignes :
  - **Ligne Uber** : badge vert "Uber Eats", CA Uber, Versement Uber, Rentab Uber, Cmds Uber, Panier Uber + les métriques opérationnelles (note, erreurs, etc.) car Uber-only
  - **Ligne Deliveroo** : badge cyan "Deliveroo", CA Deliveroo, Versement Deliveroo, Rentab Deliveroo, Cmds Deliveroo, Panier Deliveroo + "—" pour les colonnes opérationnelles non disponibles
- Style : fond légèrement plus clair (`bg-muted/10`), texte plus petit (`text-xs`), indentation via padding-left sur le nom
- Le clic sur la ligne principale conserve la navigation vers le détail restaurant ; seul le clic sur le chevron toggle l'expansion (stopPropagation)

### Résultat visuel

```text
#  RESTAURANT                    CA        VERSEMENT   RENTAB.  CMDS  ...
▸ 1  Chicken Street - Argenteuil  19 304 €   12 685 €   65.7%   929   ...
     [Uber Eats]                  14 200 €    9 100 €   64.1%   680   ...
     [Deliveroo]                   5 104 €    3 585 €   70.2%   249   ...
  2  Chicken Street - Reims       10 690 €    6 661 €   62.3%   459   ...
```

