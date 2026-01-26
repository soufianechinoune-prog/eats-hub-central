
# Correction du filtre restaurants dans les données de ventes

## Problème

Le nombre de ventes affiché (3921 pour "Naan TENDERS") est identique quel que soit le restaurant sélectionné car l'appel RPC ignore le filtre restaurant.

| Sélection | Attendu | Affiché |
|-----------|---------|---------|
| Bonneuil seul | ~800 ventes | 3921 |
| Athis-Mons + Bonneuil | ~1600 ventes | 3921 |
| Tout le réseau | 3921 ventes | 3921 |

**Cause :** Ligne 188 de `BogoSimulator.tsx` passe `p_restaurant_ids: null` au lieu de `restaurantIds`.

---

## Solution

Passer les `restaurantIds` sélectionnés à la fonction RPC pour filtrer les ventes par restaurant.

---

## Modifications

### Fichier : `src/components/menu/offers/BogoSimulator.tsx`

**1. Modifier l'appel RPC (ligne 186-189)**

```tsx
// Avant (BUG)
const { data, error } = await supabase.rpc("get_product_sales_for_period", {
  p_start_date: startDate,
  p_restaurant_ids: null // All restaurants for network-wide popularity
});

// Après (CORRIGÉ)
const { data, error } = await supabase.rpc("get_product_sales_for_period", {
  p_start_date: startDate,
  p_restaurant_ids: restaurantIds.length > 0 ? restaurantIds : null
});
```

**2. Ajouter `restaurantIds` aux dépendances du useEffect**

Le hook `useEffect` doit se re-exécuter quand les restaurants sélectionnés changent :

```tsx
// Avant
}, [salesPeriod, menuItems]);

// Après  
}, [salesPeriod, menuItems, restaurantIds]);
```

---

## Résultat attendu

| Sélection | Ventes affichées |
|-----------|------------------|
| Bonneuil seul | ~800-1000 |
| Athis-Mons + Bonneuil | ~1600-2000 |
| Tout le réseau (aucune sélection) | ~3921 |

Les chiffres de ventes refléteront désormais les performances réelles de chaque restaurant.
