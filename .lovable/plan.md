
# Plan : Amélioration de la récupération de données dans BogoProjectionDialog

## Contexte

Le message "Pas d'historique de ventes" apparaît car la requête actuelle ne trouve pas les données. Deux problèmes :
1. Pas de filtre par restaurant sélectionné
2. Correspondance exacte par `item_title` ne fonctionne pas (variations de noms)
3. Période fixe de 30 jours sans possibilité de choix

## Modifications a effectuer

### 1. Ajouter un sélecteur de période de référence

Dans `BogoProjectionDialog.tsx`, ajouter un état et un sélecteur UI pour la période :

```typescript
type SalesPeriod = "30days" | "90days" | "year" | "all";

const SALES_PERIOD_LABELS: Record<SalesPeriod, string> = {
  "30days": "30 derniers jours",
  "90days": "90 derniers jours",
  "year": "Cette année",
  "all": "Tout l'historique",
};

const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("90days");
```

Composant UI : Select avec les 4 options, placé dans l'en-tête du dialog ou juste avant la section historique.

---

### 2. Corriger la requête pour utiliser le pattern qui fonctionne

Remplacer la requête actuelle par le pattern éprouvé :

```typescript
// Calculer la date de début selon la période
const getStartDate = (period: SalesPeriod): string | null => {
  const now = new Date();
  switch (period) {
    case "30days": return subDays(now, 30).toISOString();
    case "90days": return subDays(now, 90).toISOString();
    case "year": return startOfYear(now).toISOString();
    default: return null; // "all" = pas de filtre
  }
};

// Requête via la jointure orders -> order_items
const startDate = getStartDate(salesPeriod);

let query = supabase
  .from("orders")
  .select(`
    order_datetime,
    restaurant_id,
    order_items (
      item_title,
      quantity,
      sales_incl_vat
    )
  `);

// Filtre par date si applicable
if (startDate) {
  query = query.gte("order_datetime", startDate);
}

// Filtre par restaurants sélectionnés
if (selectedRestaurantIds.length > 0) {
  query = query.in("restaurant_id", selectedRestaurantIds);
}

const { data: orders, error } = await query;

// Flatten et agréger
const allItems = orders?.flatMap(o => o.order_items || []) || [];
```

---

### 3. Ajouter le fuzzy matching pour les noms d'articles

Importer et utiliser `normalizeName` comme dans les autres simulateurs :

```typescript
import { normalizeName } from "@/lib/fuzzyMatch";

// Créer un map des noms normalisés vers les items sélectionnés
const normalizedToItem = new Map<string, MenuItem>();
selectedItems.forEach(item => {
  normalizedToItem.set(normalizeName(item.name), item);
});

// Matcher les order_items
allItems.forEach(row => {
  const normalizedTitle = normalizeName(row.item_title);
  
  // Exact match
  if (normalizedToItem.has(normalizedTitle)) {
    // Ajouter aux stats
    return;
  }
  
  // Fuzzy match : inclus/inclut
  for (const [normalized, item] of normalizedToItem) {
    if (normalizedTitle.includes(normalized) || normalized.includes(normalizedTitle)) {
      // Ajouter aux stats
      break;
    }
  }
});
```

---

### 4. Passer les restaurants sélectionnés au dialog

Dans `BogoSimulatorUber.tsx`, s'assurer que `selectedRestaurantIds` est bien passé :

```typescript
<BogoProjectionDialog
  open={showProjection}
  onOpenChange={setShowProjection}
  selectedItems={selectedItemsForProjection}
  selectedRestaurantIds={selectedRestaurantIds}  // Déjà passé
  ...
/>
```

---

### 5. UI pour le sélecteur de période dans le dialog

Ajouter dans la section historique de ventes :

```text
┌─────────────────────────────────────────────────────────────┐
│  📦 Historique de ventes                                    │
│                                                             │
│  Période de référence : [Select: 90 derniers jours ▼]       │
│                                                             │
│  ┌─────────────────────┬─────────────────────┐              │
│  │ Quantité vendue     │ CA généré           │              │
│  │ 247 unités          │ 2 098,50 €          │              │
│  │ ~8,2 / jour         │ ~69,95 € / jour     │              │
│  └─────────────────────┴─────────────────────┘              │
│                                                             │
│  📍 Données basées sur 2 restaurants sélectionnés           │
└─────────────────────────────────────────────────────────────┘
```

---

### 6. Afficher le contexte des données

Sous les statistiques, indiquer :
- Le nombre de jours de la période
- Le nombre de restaurants pris en compte
- Le nombre d'articles matchés

```typescript
<p className="text-xs text-muted-foreground">
  Basé sur {selectedRestaurantIds.length > 0 
    ? `${selectedRestaurantIds.length} restaurant(s)` 
    : "tous les restaurants"} 
  • {selectedItems.length} article(s)
</p>
```

---

## Résumé des fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `src/components/menu/offers/BogoProjectionDialog.tsx` | Sélecteur de période + requête corrigée + fuzzy matching + affichage contexte |

---

## Résultat attendu

Au lieu de "Pas d'historique de ventes", l'utilisateur verra :

- Un sélecteur pour choisir 30j / 90j / année / tout
- Les vraies stats de ventes pour les articles sélectionnés
- Le contexte (restaurants, période) clairement affiché
- Les projections basées sur les données réelles
