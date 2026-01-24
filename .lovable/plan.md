

# Simplifier la page Analyse des Horaires + Nouveau croisement Produits × Créneaux

## Modifications demandées

### 1. Supprimer les badges "À surveiller" et "Sous-exploité"

**Fichier** : `src/components/compare/HourlyOpportunitiesAnalysis.tsx`

**Changements** :
- Supprimer les badges "À surveiller" (lignes 509-513)
- Supprimer les badges "Sous-exploité" (lignes 519-523)
- Conserver uniquement le badge "Point fort" (vert)
- Supprimer ces mêmes badges de la légende (lignes 561-566)

### 2. Supprimer la section "Opportunités d'extension d'horaires"

**Fichier** : `src/components/compare/OpeningHoursInsights.tsx`

**Changements** :
- Supprimer toute la section "Opportunités d'extension d'horaires" (lignes 152-195)
- Les autres sections (Jours manquants, Écarts plateformes) sont conservées

### 3. Corriger l'affichage des noms de restaurants

**Fichier** : `src/pages/OpeningHoursComparison.tsx`

**Changements** :
- Importer `extractCityName` depuis `@/lib/restaurantUtils`
- Remplacer le formatage tronqué par "CS + Ville"

```typescript
// Avant (ligne 504)
{row.name.length > 12 ? row.name.slice(0, 12) + "..." : row.name}

// Après
CS {extractCityName(row.name)}
```

---

## Nouvelle fonctionnalité : Croisement Produits × Créneaux horaires

### Concept

Créer une nouvelle section "Top Produits par Créneau" qui montre quels produits se vendent le mieux à chaque moment de la journée :

| Créneau | Top 1 | Top 2 | Top 3 |
|---------|-------|-------|-------|
| Déjeuner (11h-14h) | Menu Chicken Box (45%) | Wrap Classic (22%) | Nuggets 10pc (18%) |
| Après-midi (14h-18h) | Milkshake Oreo (38%) | Nuggets 10pc (25%) | Menu Kid (20%) |
| Dîner (18h-22h) | Menu Street XL (42%) | Menu Duo (28%) | Chicken Wings (15%) |
| Late Night (22h-00h) | Menu Street XL (55%) | Loaded Fries (25%) | Nuggets 20pc (12%) |

### Fichiers à créer/modifier

| Fichier | Description |
|---------|-------------|
| `src/hooks/useProductsByTimeSlot.ts` | Nouveau hook pour récupérer les ventes par produit et par créneau |
| `src/components/compare/ProductsByTimeSlotAnalysis.tsx` | Nouveau composant affichant le croisement |
| `src/pages/OpeningHoursComparison.tsx` | Intégrer le nouveau composant |

### Logique de données

```typescript
// Définition des créneaux (même que HourlyOpportunitiesAnalysis)
const TIME_SLOTS = [
  { label: "Déjeuner", hours: [11, 12, 13] },
  { label: "Après-midi", hours: [14, 15, 16, 17] },
  { label: "Dîner", hours: [18, 19, 20, 21] },
  { label: "Late Night", hours: [22, 23, 0, 1] },
];

// Requête: récupérer les commandes avec l'heure
const orders = await supabase
  .from("orders")
  .select("id, order_datetime")
  .gte("order_datetime", startDate)
  .lte("order_datetime", endDate)
  .in("restaurant_id", restaurantIds);

// Puis récupérer les order_items et les grouper par heure
// Calculer le top 3 produits par créneau horaire
```

### Visualisation proposée

La section affichera :
1. **Vue synthétique** : Tableau avec les top 3 produits par créneau
2. **Indicateurs visuels** :
   - Badge "Star" pour le produit n°1 de chaque créneau
   - Pourcentage du CA du créneau
   - Évolution vs période précédente (optionnel)

### Insights business

Cette analyse permettra de :
- Identifier les "produits phares" de chaque moment de la journée
- Adapter les promotions selon les créneaux (promouvoir les produits sous-performants)
- Optimiser les stocks et la préparation selon l'heure
- Détecter des opportunités (ex: produit populaire le soir mais absent des promos)

---

## Résumé des fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `src/components/compare/HourlyOpportunitiesAnalysis.tsx` | Supprimer badges "À surveiller" et "Sous-exploité" |
| `src/components/compare/OpeningHoursInsights.tsx` | Supprimer section "Opportunités d'extension" |
| `src/pages/OpeningHoursComparison.tsx` | Format "CS Ville" + intégrer nouveau composant |
| `src/hooks/useProductsByTimeSlot.ts` | **NOUVEAU** - Hook pour croisement produits × créneaux |
| `src/components/compare/ProductsByTimeSlotAnalysis.tsx` | **NOUVEAU** - Composant d'affichage |

---

## Section technique

### Structure du hook useProductsByTimeSlot

```typescript
interface ProductSlotData {
  slotLabel: string;
  slotHours: number[];
  topProducts: {
    title: string;
    quantity: number;
    revenue: number;
    percentOfSlot: number;
    rank: number;
  }[];
  totalOrders: number;
  totalRevenue: number;
}

export const useProductsByTimeSlot = (
  restaurantIds: string[],
  startDate: Date,
  endDate: Date
) => {
  // 1. Récupérer les orders avec leur datetime
  // 2. Récupérer les order_items correspondants
  // 3. Grouper par créneau horaire
  // 4. Calculer le top 3 produits par créneau
  // 5. Retourner les données agrégées
};
```

### Pattern de requête (basé sur useItemSalesAnalytics)

```typescript
// Étape 1: Récupérer les commandes avec l'heure
const { data: ordersWithHour } = await supabase
  .from("orders")
  .select("id, order_datetime")
  .gte("order_datetime", startDateStr)
  .lte("order_datetime", endDateStr + "T23:59:59")
  .in("restaurant_id", restaurantIds);

// Créer un map order_id -> heure
const orderHourMap = new Map(
  ordersWithHour.map(o => [
    o.id, 
    parseISO(o.order_datetime).getHours()
  ])
);

// Étape 2: Récupérer les items (pagination par chunks de 500)
const { data: items } = await supabase
  .from("order_items")
  .select("order_id, item_title, quantity, sales_incl_vat")
  .in("order_id", orderIds);

// Étape 3: Grouper par créneau et produit
const slotProductMap = new Map<string, Map<string, ProductData>>();

items.forEach(item => {
  const hour = orderHourMap.get(item.order_id);
  const slot = TIME_SLOTS.find(s => s.hours.includes(hour));
  // Agréger...
});
```

