

# Exclure des restaurants spécifiques de l'import Deliveroo

## Contexte

Les fichiers Deliveroo de Melun (HORTENSIA) contiennent 2 restaurants : **CHICKEN STREET - Melun** et **Bangkok Factory - Melun**. L'utilisateur veut pouvoir exclure Bangkok Factory de l'import.

## Approche

Ajouter un mécanisme d'exclusion par restaurant dans l'étape de preview, côté client ET backend.

## Changements

### 1. `src/components/reports/DeliverooImportTab.tsx`

- Ajouter un state `excludedRestaurantNames: Set<string>` pour tracker les restaurants exclus
- Sur chaque badge restaurant dans le preview (ligne 513-516), ajouter un bouton X pour exclure/ré-inclure le restaurant
- Badge exclu : style barré/grisé avec possibilité de cliquer pour ré-inclure
- Passer `excludedRestaurantNames` comme paramètre au body de l'appel edge function (dry-run ET import)
- Recalculer `totalRows` et stats en excluant les lignes des restaurants exclus

### 2. `supabase/functions/parse-deliveroo-statement/index.ts`

- Accepter un nouveau paramètre optionnel `excludeRestaurantNames: string[]`
- Après `extractRows()`, filtrer les lignes dont `restaurant_name` est dans la liste d'exclusion
- Cela s'applique au dry-run (stats recalculées sans ces restaurants) ET à l'import réel

## Résultat

Dans le preview, l'utilisateur verra les badges de chaque restaurant avec un X pour exclure. Bangkok Factory sera exclu du comptage ET de l'insertion en base.

## Fichiers modifiés
- `src/components/reports/DeliverooImportTab.tsx` — UI d'exclusion + passage du paramètre
- `supabase/functions/parse-deliveroo-statement/index.ts` — filtrage des lignes exclues

