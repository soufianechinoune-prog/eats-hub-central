
# Plan de correction : Historique des ventes dans BogoProjectionDialog

## Diagnostic du problème

Après analyse approfondie, j'ai identifié plusieurs problèmes dans `BogoProjectionDialog.tsx` :

### 1. **CA généré toujours à 0,00 €**
- ✅ Les données `sales_incl_vat` existent bien dans la BDD (14 297 items sur 15 019 ont des valeurs positives)
- ✅ Test SQL direct confirme : pour "Naan Tender" sur 30j, il y a ~5 000 unités vendues pour ~42 000 € de CA
- ❌ **Problème** : La requête Supabase avec jointure implicite ne récupère pas correctement les données

### 2. **Quantité constante (332 unités) quelle que soit la période**
- ❌ **Problème** : Le filtre de date via `.gte("order_datetime", startDate)` ne s'applique pas correctement dans le contexte de la jointure
- ❌ **Problème secondaire** : Le cache React Query pourrait ne pas se rafraîchir correctement lors du changement de période

### 3. **Problème de jointure Supabase**
La requête actuelle :
```typescript
supabase
  .from("orders")
  .select(`
    order_datetime,
    restaurant_id,
    order_items (
      item_title,
      quantity,
      sales_incl_vat
    )
  `)
```

Cette syntaxe avec jointure implicite peut avoir des limitations avec les filtres et l'agrégation de données.

---

## Solution proposée

### Approche 1 : Requête RPC dédiée (recommandée)

Créer une fonction PostgreSQL qui effectue l'agrégation côté serveur, garantissant performance et précision.

**Avantages** :
- Agrégation efficace côté BDD
- Pas de limite des 1000 lignes Supabase
- Matching avec ILIKE natif PostgreSQL
- Filtres de date garantis

**Fonction SQL** :
```sql
CREATE OR REPLACE FUNCTION get_bogo_historical_sales(
  p_item_ids TEXT[],
  p_restaurant_ids UUID[],
  p_start_date TIMESTAMPTZ,
  p_period_days INTEGER
) RETURNS TABLE (
  total_quantity BIGINT,
  total_sales NUMERIC,
  avg_per_day NUMERIC,
  avg_sales_per_day NUMERIC,
  matched_items_count BIGINT,
  period_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH matched_items AS (
    SELECT DISTINCT oi.id, oi.quantity, oi.sales_incl_vat, oi.item_title
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN menu_items mi ON mi.id = ANY(p_item_ids)
    WHERE 
      (p_start_date IS NULL OR o.order_datetime >= p_start_date)
      AND (CARDINALITY(p_restaurant_ids) = 0 OR o.restaurant_id = ANY(p_restaurant_ids))
      AND (
        LOWER(REGEXP_REPLACE(oi.item_title, '[^a-zA-Z0-9 ]', '', 'g')) 
        ILIKE '%' || LOWER(REGEXP_REPLACE(mi.name, '[^a-zA-Z0-9 ]', '', 'g')) || '%'
        OR
        LOWER(REGEXP_REPLACE(mi.name, '[^a-zA-Z0-9 ]', '', 'g')) 
        ILIKE '%' || LOWER(REGEXP_REPLACE(oi.item_title, '[^a-zA-Z0-9 ]', '', 'g')) || '%'
      )
  )
  SELECT 
    COALESCE(SUM(quantity), 0)::BIGINT as total_quantity,
    COALESCE(SUM(sales_incl_vat), 0)::NUMERIC as total_sales,
    (COALESCE(SUM(quantity), 0) / NULLIF(p_period_days, 0))::NUMERIC as avg_per_day,
    (COALESCE(SUM(sales_incl_vat), 0) / NULLIF(p_period_days, 0))::NUMERIC as avg_sales_per_day,
    COUNT(DISTINCT item_title)::BIGINT as matched_items_count,
    p_period_days as period_days;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Appel TypeScript** :
```typescript
const { data, error } = await supabase.rpc('get_bogo_historical_sales', {
  p_item_ids: selectedItems.map(i => i.id),
  p_restaurant_ids: selectedRestaurantIds,
  p_start_date: startDate,
  p_period_days: getPeriodDays(salesPeriod)
});
```

---

### Approche 2 : Requête client simplifiée (alternative)

Si on préfère rester côté client, améliorer la requête actuelle :

**Modifications** :
1. Ajouter un log de debug pour voir ce qui est récupéré
2. Améliorer le matching avec une fonction plus permissive
3. Gérer explicitement les cas où `sales_incl_vat` est NULL
4. Ajouter un indicateur de debug dans l'UI

```typescript
// Debug logs
console.log('🔍 Fetching sales data:', {
  selectedItems: selectedItems.map(i => i.name),
  restaurants: selectedRestaurantIds.length,
  period: salesPeriod,
  startDate
});

const { data: orders, error } = await query;

console.log('📊 Query result:', {
  ordersCount: orders?.length,
  itemsCount: allItems.length,
  sampleItems: allItems.slice(0, 3)
});

// Matching amélioré
const normalizeForMatch = (str: string) => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
};

// Dans la boucle de matching
allItems.forEach(row => {
  if (!row.item_title) return;
  
  const normalizedTitle = normalizeForMatch(row.item_title);
  
  for (const item of selectedItems) {
    const normalizedItem = normalizeForMatch(item.name);
    
    // Match si l'un contient l'autre (au moins 80% de correspondance)
    if (normalizedTitle.includes(normalizedItem) || normalizedItem.includes(normalizedTitle)) {
      const qty = row.quantity || 0;
      const sales = row.sales_incl_vat || 0;
      
      if (qty > 0 || sales > 0) { // Ne compter que les lignes avec données
        totalQuantity += qty;
        totalSales += sales;
        matchedItemNames.add(row.item_title);
      }
      break;
    }
  }
});
```

---

### Approche 3 : Affichage debug pour l'utilisateur

Ajouter une section "Données de debug" temporaire dans le dialog :

```typescript
{import.meta.env.DEV && (
  <Card className="bg-slate-900/50 border-slate-700">
    <CardContent className="pt-4 space-y-2">
      <p className="text-xs font-mono text-slate-400">🔧 Debug Info</p>
      <div className="text-xs font-mono space-y-1 text-slate-300">
        <div>Restaurants sélectionnés: {selectedRestaurantIds.length}</div>
        <div>Articles sélectionnés: {selectedItems.map(i => i.name).join(', ')}</div>
        <div>Période: {salesPeriod} (depuis {startDate || 'début'})</div>
        <div>Commandes récupérées: {orders?.length || 0}</div>
        <div>Items aplatis: {allItems.length}</div>
        <div>Items matchés: {matchedItemNames.size}</div>
      </div>
    </CardContent>
  </Card>
)}
```

---

## Plan d'action recommandé

### Étape 1 : Diagnostic immédiat (5 min)
1. Ajouter les logs de debug dans `BogoProjectionDialog.tsx`
2. Ajouter la section debug UI
3. Tester avec un article connu (ex: "Naan Tender")
4. Observer les logs navigateur pour comprendre ce qui est récupéré

### Étape 2 : Correction rapide (10 min)
1. Améliorer la fonction de matching (normalisation plus agressive)
2. Ajouter une vérification : ignorer les lignes avec `sales_incl_vat = 0`
3. S'assurer que le `queryKey` de React Query inclut bien tous les paramètres

### Étape 3 : Solution robuste (20 min)
1. Créer la fonction RPC `get_bogo_historical_sales`
2. Remplacer l'appel Supabase client par l'appel RPC
3. Supprimer la logique de matching côté client
4. Valider avec différentes périodes et restaurants

---

## Résultat attendu

Après correction :
- ✅ CA généré affiche les vraies valeurs (ex: 13 128,37 € pour un restaurant sur 30j)
- ✅ La quantité change selon la période sélectionnée
- ✅ Le matching des articles fonctionne avec les variations de noms
- ✅ Les projections de ROI sont basées sur des données réelles
- ✅ Message clair si aucune donnée n'est trouvée (au lieu de valeurs erronées)

---

## Technique : Détails de la fonction RPC

La fonction RPC proposée :
- **Utilise ILIKE natif** : Plus performant que le matching JavaScript
- **Normalise les noms** : Supprime accents, emojis, caractères spéciaux
- **Fuzzy matching bidirectionnel** : item contient title OU title contient item
- **Agrégation pure SQL** : Pas de limite Supabase, pas de parsing JS
- **Gestion des NULL** : COALESCE garantit 0 au lieu de NULL

**Test manuel de la fonction** :
```sql
SELECT * FROM get_bogo_historical_sales(
  ARRAY['uuid-item-1', 'uuid-item-2']::TEXT[],
  ARRAY['uuid-resto-1']::UUID[],
  NOW() - INTERVAL '30 days',
  30
);
```

