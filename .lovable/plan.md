# Filtrage automatique par dates d'activité des plateformes

## ✅ IMPLÉMENTÉ

### Migration base de données
Les colonnes suivantes ont été ajoutées à la table `restaurants`:
- `uber_opening_date` (DATE)
- `uber_closing_date` (DATE)
- `deliveroo_opening_date` (DATE)
- `deliveroo_closing_date` (DATE)

### Interface utilisateur
Une carte "Dates d'activité plateformes" a été ajoutée dans `RestaurantDetail.tsx` avec 4 champs date.

### Utilitaire de filtrage
Fichier créé: `src/lib/restaurantActivityFilter.ts`
- `filterActiveRestaurants(restaurants, startDate, endDate)` - Filtre les restaurants actifs pendant la période
- `getExcludedCount(restaurants, startDate, endDate)` - Compte les restaurants exclus

### Pages mises à jour
Les pages suivantes récupèrent maintenant les dates d'activité et filtrent automatiquement les restaurants:
- ✅ `DowntimeComparison.tsx`
- ✅ `RatingsComparison.tsx`
- ✅ `PrepTimeComparison.tsx`
- ✅ `TotalDeliveryTimeComparison.tsx`
- ✅ `InaccurateOrdersComparison.tsx`

### Fichier déprécié
`src/lib/restaurantOpeningDates.ts` - La logique hardcodée a été supprimée et remplacée par une fonction qui retourne toujours false.

## Logique de filtrage

Un restaurant est considéré actif pour une période si:
- **Uber Eats**: (opening_date null OU <= fin_periode) ET (closing_date null OU >= debut_periode)
- **Deliveroo**: même logique
- Inclus si **au moins une plateforme** était active

## Exemple
Avec Antony ayant `uber_opening_date: 2025-11-15`:
- Octobre 2025 → **Exclu** (ouverture après fin période)
- Novembre 2025 → **Inclus** (ouverture pendant la période)
