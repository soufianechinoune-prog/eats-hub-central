
# Correction de l'incohérence Versement entre Dashboard et Finances

## Problème identifié

Le Dashboard "Comparatif des restaurants" et la page "Finances & Frais" utilisent deux sources de données différentes pour calculer le versement :

| Vue | Source | Filtre | Résultat pour 24-30/11 |
|-----|--------|--------|------------------------|
| Dashboard (useNetworkStats) | Table `payouts` | `payout_date BETWEEN 24/11 AND 30/11` | Affiche le versement du 24/11, qui couvre les ventes du **17-23/11** |
| Finances & Frais (useFinancesDrilldown) | Table `orders` | `order_datetime BETWEEN 24/11 AND 30/11` | Calcule le versement à partir des commandes réelles de la période |

### Pourquoi ce décalage ?

Les versements Uber Eats sont effectués **le lundi suivant la fin de la semaine de ventes** :
- `payout_date = 2025-11-24` → couvre les ventes du **17-23 novembre**
- `payout_date = 2025-12-01` → couvre les ventes du **24-30 novembre**

Le hook `useNetworkStats` traite `payout_date` comme si c'était la date des ventes, ce qui crée un décalage d'une semaine.

## Solution proposée

Aligner le calcul du "Versement" dans le Dashboard sur la même source que la page Finances : **utiliser la table `orders`** au lieu de `payouts`.

### Modifications

#### 1. Fichier `src/hooks/useNetworkStats.ts`

Remplacer la requête `payouts` (lignes 169-186) par une requête sur `orders` pour calculer le versement :

```typescript
// AVANT - Requête payouts (décalage d'une semaine)
const { data: payoutsData } = useQuery({
  queryKey: ["network-stats-payouts", restaurantIds, startDateStr, endDateStr],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("payouts")
      .select("restaurant_id, sales_incl_vat, net_payout, item_promo_incl_vat, meal_voucher_amount")
      .gte("payout_date", startDateStr)
      .lte("payout_date", endDateStr)
      .in("restaurant_id", restaurantIds);
    // ...
  },
});

// APRÈS - Requête orders (aligné avec Finances)
const { data: ordersPayoutData } = useQuery({
  queryKey: ["network-stats-orders-payout", restaurantIds, startDateStr, endDateStr],
  queryFn: async () => {
    // Pagination pour dépasser la limite de 1000 lignes
    const PAGE_SIZE = 1000;
    let allData = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("orders")
        .select("restaurant_id, sales_incl_vat, net_payout, item_promo_incl_vat, meal_voucher_amount")
        .gte("order_datetime", `${startDateStr}T00:00:00`)
        .lte("order_datetime", `${endDateStr}T23:59:59`)
        .in("restaurant_id", restaurantIds)
        .range(offset, offset + PAGE_SIZE - 1);
      
      if (error) throw error;
      if (data?.length) {
        allData = [...allData, ...data];
        hasMore = data.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    return allData;
  },
});
```

#### 2. Mise à jour du calcul de rentabilité (lignes 292-327)

Adapter le calcul pour utiliser les données agrégées de `orders` au lieu de `payouts` :

```typescript
// Profitability & Net Payout from orders (consistent with Finances)
const restoOrders = ordersPayoutData?.filter((o) => o.restaurant_id === resto.id) || [];
let profitability: number | null = null;
let netPayout = 0;

if (restoOrders.length > 0) {
  const totalSales = restoOrders.reduce(
    (sum, o) => sum + Math.max(0, Number(o.sales_incl_vat || 0)),
    0
  );
  const totalPromo = restoOrders.reduce(
    (sum, o) => sum + Math.abs(Number(o.item_promo_incl_vat || 0)),
    0
  );
  const totalNetPayoutRaw = restoOrders.reduce(
    (sum, o) => sum + Number(o.net_payout || 0),
    0
  );
  const totalMealVoucher = restoOrders.reduce(
    (sum, o) => sum + Number(o.meal_voucher_amount || 0),
    0
  );
  
  netPayout = totalNetPayoutRaw + totalMealVoucher;

  const denominator = profitabilityBase === "net"
    ? Math.max(0, totalSales - totalPromo)
    : totalSales;

  profitability = denominator > 0
    ? (netPayout / denominator) * 100
    : null;
}
```

## Résumé des fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `src/hooks/useNetworkStats.ts` | Remplacer la source `payouts` par `orders` pour le calcul du versement et de la rentabilité |

## Résultat attendu

| Période 24-30/11 | Avant | Après |
|------------------|-------|-------|
| Dashboard Versement | ~6€ (mauvaise semaine) | ~3540€ (cohérent avec Finances) |
| Rentabilité | Basée sur payouts | Basée sur orders |

## Avantages

1. **Cohérence** : Dashboard et Finances affichent les mêmes montants
2. **Précision** : Les données reflètent exactement la période sélectionnée
3. **Clarté** : Pas de confusion entre date de versement et date de vente

## Considérations

- La table `payouts` reste utile pour l'historique des virements bancaires réels (pour la comptabilité)
- La table `orders` est plus précise pour l'analyse opérationnelle jour par jour
- Cette modification n'impacte pas les autres usages de `payouts` dans l'application
