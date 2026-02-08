

# Filtrage automatique par dates d'activite des plateformes

## Objectif
Exclure automatiquement les restaurants des calculs de moyennes reseau s'ils n'etaient pas encore ouverts ou deja fermes sur une plateforme donnee pendant la periode analysee.

**Exemple concret** : Si Antony a ouvert le 15 novembre 2025, il ne doit pas etre inclus dans les calculs pour octobre 2025.

## Architecture de la solution

### 1. Utilitaire de filtrage centralise

Creer une fonction utilitaire qui filtre les restaurants en fonction de leurs dates d'activite et de la periode selectionnee :

```text
┌─────────────────────────────────────────────────────────────────┐
│ filterActiveRestaurants(restaurants, startDate, endDate)        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Pour chaque restaurant :                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Uber Eats actif pendant la periode ?                    │   │
│  │  - uber_opening_date null OU <= endDate                 │   │
│  │  - ET uber_closing_date null OU >= startDate            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Deliveroo actif pendant la periode ?                    │   │
│  │  - deliveroo_opening_date null OU <= endDate            │   │
│  │  - ET deliveroo_closing_date null OU >= startDate       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  → Inclure si au moins une plateforme etait active             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Fichiers a modifier

| Fichier | Modification |
|---------|--------------|
| `src/lib/restaurantActivityFilter.ts` | Nouveau fichier avec la logique de filtrage |
| `src/lib/restaurantOpeningDates.ts` | Supprimer la logique hardcodee (ANTONY) |
| `src/hooks/useNetworkStats.ts` | Recuperer les dates et filtrer les restaurants |
| `src/pages/Overview.tsx` | Recuperer et filtrer les restaurants actifs |
| `src/pages/RatingsComparison.tsx` | Recuperer les dates et filtrer |
| `src/pages/PrepTimeComparison.tsx` | Recuperer les dates et filtrer |
| `src/pages/DowntimeComparison.tsx` | Recuperer les dates et filtrer |
| `src/pages/TotalDeliveryTimeComparison.tsx` | Recuperer les dates et filtrer |
| `src/pages/InaccurateOrdersComparison.tsx` | Recuperer les dates et filtrer |

### 3. Mise a jour des requetes de restaurants

Dans chaque page de comparaison, la requete de restaurants doit inclure les colonnes de dates :

```typescript
// Avant
.select("id, name")

// Apres
.select("id, name, uber_opening_date, uber_closing_date, deliveroo_opening_date, deliveroo_closing_date")
```

### 4. Application du filtrage

Apres la recuperation des restaurants, appliquer le filtrage avant de calculer les statistiques :

```typescript
const activeRestaurants = useMemo(() => {
  return filterActiveRestaurants(
    allRestaurants,
    dateRange.start,
    dateRange.end
  );
}, [allRestaurants, dateRange.start, dateRange.end]);
```

## Section technique

### Nouvelle fonction de filtrage

```typescript
// src/lib/restaurantActivityFilter.ts
interface RestaurantWithDates {
  id: string;
  name: string;
  uber_opening_date?: string | null;
  uber_closing_date?: string | null;
  deliveroo_opening_date?: string | null;
  deliveroo_closing_date?: string | null;
}

function isActiveForPeriod(
  restaurant: RestaurantWithDates,
  startDate: Date,
  endDate: Date
): boolean {
  const startStr = formatDateLocal(startDate);
  const endStr = formatDateLocal(endDate);
  
  // Uber Eats : actif si (ouverture null OU ouverture <= fin periode)
  //             ET (fermeture null OU fermeture >= debut periode)
  const uberActive = 
    (!restaurant.uber_opening_date || restaurant.uber_opening_date <= endStr) &&
    (!restaurant.uber_closing_date || restaurant.uber_closing_date >= startStr);
  
  // Deliveroo : meme logique
  const deliverooActive = 
    (!restaurant.deliveroo_opening_date || restaurant.deliveroo_opening_date <= endStr) &&
    (!restaurant.deliveroo_closing_date || restaurant.deliveroo_closing_date >= startStr);
  
  // Inclure si au moins une plateforme etait active
  return uberActive || deliverooActive;
}

export function filterActiveRestaurants<T extends RestaurantWithDates>(
  restaurants: T[],
  startDate: Date,
  endDate: Date
): T[] {
  return restaurants.filter(r => isActiveForPeriod(r, startDate, endDate));
}
```

### Modification du hook useNetworkStats

```typescript
// Ligne 82-84 : Ajouter les colonnes de dates
.select("id, name, city, uber_opening_date, uber_closing_date, deliveroo_opening_date, deliveroo_closing_date")

// Ligne 294 : Filtrer les restaurants avant le calcul
const activeRestaurants = useMemo(() => {
  return filterActiveRestaurants(restaurants || [], startDate, endDate);
}, [restaurants, startDate, endDate]);
```

### Compteur de restaurants exclus (optionnel)

Afficher le nombre de restaurants exclus pour transparence :

```typescript
const excludedCount = (allRestaurants?.length || 0) - activeRestaurants.length;

// Dans le header
{excludedCount > 0 && (
  <Badge variant="outline" className="text-muted-foreground">
    {excludedCount} non actif{excludedCount > 1 ? "s" : ""} sur la periode
  </Badge>
)}
```

## Impact attendu

Avec Antony ayant `uber_opening_date: 2025-11-15` :

| Periode selectionnee | Antony inclus ? |
|---------------------|-----------------|
| Octobre 2025 | Non (ouverture apres fin periode) |
| Novembre 2025 | Oui (ouverture pendant la periode) |
| S46 (10-16 nov 2025) | Non (ouverture apres fin periode) |
| S47 (17-23 nov 2025) | Oui (ouverture avant fin periode) |

