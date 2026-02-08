

# Ajout des dates d'ouverture par plateforme

## Objectif
Ajouter deux champs de date dans la fiche restaurant pour indiquer quand le restaurant a ouvert sur Uber Eats et sur Deliveroo. Ces dates permettront d'exclure automatiquement les restaurants non actifs des calculs de moyennes réseau.

## Architecture

### 1. Migration base de données

Ajout de 4 nouvelles colonnes à la table `restaurants` :
- `uber_opening_date` : date d'ouverture sur Uber Eats
- `uber_closing_date` : date de fermeture sur Uber Eats (si fermé)
- `deliveroo_opening_date` : date d'ouverture sur Deliveroo
- `deliveroo_closing_date` : date de fermeture sur Deliveroo (si fermé)

```sql
ALTER TABLE public.restaurants 
ADD COLUMN uber_opening_date DATE,
ADD COLUMN uber_closing_date DATE,
ADD COLUMN deliveroo_opening_date DATE,
ADD COLUMN deliveroo_closing_date DATE;
```

### 2. Interface utilisateur - Page détail restaurant

Une nouvelle carte "Dates d'activité plateformes" sera ajoutée dans `RestaurantDetail.tsx` :

```text
┌───────────────────────────────────────────────────────┐
│ 📅 Dates d'activité plateformes                       │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Uber Eats                    Deliveroo               │
│  ┌─────────────────────┐     ┌─────────────────────┐  │
│  │ Ouverture           │     │ Ouverture           │  │
│  │ [15/03/2023    📅]  │     │ [20/04/2023    📅]  │  │
│  │                     │     │                     │  │
│  │ Fermeture           │     │ Fermeture           │  │
│  │ [Non renseigné   ]  │     │ [Non renseigné   ]  │  │
│  └─────────────────────┘     └─────────────────────┘  │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### 3. Logique de filtrage pour les moyennes réseau

Modification du hook `useNetworkStats.ts` pour :
1. Récupérer les dates d'ouverture/fermeture de chaque restaurant
2. Exclure des moyennes les restaurants où :
   - La date d'ouverture est postérieure à la fin de la période analysée
   - La date de fermeture est antérieure au début de la période analysée
3. Ajouter un indicateur visuel pour les restaurants exclus

### 4. Mise à jour du fichier hardcodé

Suppression de la logique hardcodée dans `restaurantOpeningDates.ts` et utilisation des vraies données de la DB.

## Fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| Migration SQL | Ajout des 4 colonnes de dates |
| `RestaurantDetail.tsx` | Nouvelle carte avec 4 champs date |
| `RestaurantFormDialog.tsx` | Ajout des champs pour création |
| `useNetworkStats.ts` | Filtrage par dates d'activité |
| `restaurantOpeningDates.ts` | Refactoring pour utiliser la DB |

## Section technique

### Colonnes de la migration
```sql
uber_opening_date DATE         -- Nullable, format YYYY-MM-DD
uber_closing_date DATE         -- Nullable (null = toujours actif)
deliveroo_opening_date DATE    -- Nullable
deliveroo_closing_date DATE    -- Nullable
```

### Logique de filtrage (pseudo-code)
```typescript
const isActiveForPeriod = (restaurant, startDate, endDate) => {
  // Uber Eats
  const uberActive = 
    (!restaurant.uber_opening_date || restaurant.uber_opening_date <= endDate) &&
    (!restaurant.uber_closing_date || restaurant.uber_closing_date >= startDate);
  
  // Deliveroo
  const deliverooActive = 
    (!restaurant.deliveroo_opening_date || restaurant.deliveroo_opening_date <= endDate) &&
    (!restaurant.deliveroo_closing_date || restaurant.deliveroo_closing_date >= startDate);
  
  return uberActive || deliverooActive;
};
```

### Champs du formulaire
```typescript
// Nouveaux champs à ajouter
uber_opening_date: string;      // Format YYYY-MM-DD
uber_closing_date: string;
deliveroo_opening_date: string;
deliveroo_closing_date: string;
```

### Rendu du sélecteur de date
Un input de type `date` natif sera utilisé pour la simplicité et la compatibilité mobile :
```tsx
<Input
  type="date"
  value={formData.uber_opening_date || ""}
  onChange={(e) => handleInputChange("uber_opening_date", e.target.value)}
/>
```

