

# Fix : CA HT/TVA à 0 et alignement des articles

## Diagnostic

### CA HT / TVA affichant 0,00 €
J'ai vérifié la base de données : les données sont **correctement stockées**. Par exemple la commande `#86DA6` avec CA TTC = 12,40 € a bien `sales_excl_vat = 11,27` et `vat_2_sales = 1,13` en base.

Le code source actuel (fichiers modifiés dans le message précédent) est également correct — la requête Supabase inclut `sales_excl_vat, vat_1_sales, vat_2_sales, vat_3_sales` et le useMemo les exploite.

**Cause probable** : le build précédent n'est peut-être pas encore complètement déployé. Pour sécuriser, je vais retirer les `(order as any)` inutiles et m'assurer que les types sont correctement exploités.

### Alignement des articles
Le `OrderItemsDropdown` rend une `<table>` imbriquée dans un `<td colSpan={13}>`. Les largeurs de colonnes de la table interne ne correspondent pas à celles de la table parente — d'où les montants qui tombent sous les mauvaises colonnes (sous "Commission" et "Vers. Total" au lieu de "CA HT", "TVA", "CA TTC").

## Corrections

### 1. `src/components/analytics/OrderItemsDropdown.tsx`
- Supprimer la `<table>` interne
- Retourner directement des `<TableRow>` qui s'intègrent dans la table parente
- Chaque ligne article = une `<TableRow>` avec exactement les mêmes colonnes que le tableau parent :
  - Cellule chevron (vide)
  - Cellule nom : `{qty}x {item_title}` (colSpan=2, couvre N° Commande + Date)
  - CA HT, TVA, CA TTC dans les 3 cellules correspondantes
  - 7 cellules vides (Rentab, Commission, Promos, Remb, Vers Uber, Titre Resto, Vers Total)

### 2. `src/components/analytics/OrdersAnalysisSection.tsx`
- Remplacer le `<TableRow>` wrapper avec `colSpan={13}` par un rendu direct des lignes articles dans le `<TableBody>`
- Passer à `OrderItemsDropdown` un mode "fragment" qui retourne des `<>` avec des `<TableRow>` directement

### 3. `src/hooks/useFinancesDrilldown.ts`
- Retirer les `(order as any)` pour `sales_excl_vat`, `vat_1_sales`, `vat_2_sales`, `vat_3_sales` — ces champs existent dans les types générés
- S'assurer que le type de retour de la requête est correctement inféré

## Résultat attendu
- Les montants CA HT / TVA / CA TTC s'affichent correctement pour chaque commande
- Les lignes articles dépliées sont parfaitement alignées sous les colonnes correspondantes du tableau parent

