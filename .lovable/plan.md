

## Diagnostic

### 1. Même stats Uber / Deliveroo — pourquoi ?

Trois problèmes identifiés :

- **`get_active_hours_summary`** (KPIs du haut) : ne requête que la table `orders` (Uber). Le filtre `selectedPlatform` n'est **pas transmis** à la RPC. Résultat : toujours les mêmes chiffres.
- **`get_hourly_order_performance`** (Performance par créneau) : requête uniquement `order_history` (Uber). Deliveroo est ignoré.
- **`get_products_by_time_slot`** (Top Produits) : requête uniquement `order_items` (Uber). Deliveroo est ignoré.

### 2. Produits Deliveroo — données disponibles ?

**Non.** La table `deliveroo_orders` ne contient que des données au niveau commande (montant, commission, type). Il n'y a **pas de table `deliveroo_order_items`** avec le détail des produits. On ne peut donc pas croiser les produits Deliveroo avec ceux d'Uber.

En revanche, on **peut** inclure les commandes et revenus Deliveroo dans l'analyse par créneau horaire (nombre de commandes, CA, panier moyen par slot).

---

## Plan de correction

### A. RPC `get_active_hours_summary` — ajouter filtre plateforme + données Deliveroo

Modifier la fonction pour :
1. Accepter un paramètre `p_platform` (text, nullable)
2. Si `'uber_eats'` → ne requêter que `orders`
3. Si `'deliveroo'` → ne requêter que `deliveroo_orders`
4. Si `'global'` ou NULL → combiner les deux tables (UNION ALL des heures distinctes)
5. Calculer `total_revenue` et `total_orders` en incluant Deliveroo quand applicable

### B. RPC `get_hourly_order_performance` — ajouter Deliveroo

Modifier pour :
1. Accepter `p_platform` (text)
2. En mode `deliveroo` : requêter `deliveroo_orders.delivery_datetime`
3. En mode `global` : UNION ALL des deux sources
4. Le revenue Deliveroo = `order_amount`

### C. Frontend `OpeningHoursComparison.tsx`

- Passer `selectedPlatform` aux appels RPC
- Ajouter `selectedPlatform` dans les queryKeys

### D. Frontend `HourlyOpportunitiesAnalysis.tsx`

- Recevoir `selectedPlatform` en prop
- Le passer à l'appel RPC

### E. Section "Top Produits par créneau"

- **Pas de changement pour Deliveroo** : la data produit n'existe pas
- Quand `selectedPlatform === 'deliveroo'` → afficher un message "Détail produit non disponible pour Deliveroo"
- Quand `global` → afficher les produits Uber uniquement (comportement actuel) avec une mention

---

### Résumé des fichiers modifiés

| Fichier | Action |
|---|---|
| Migration SQL | Modifier `get_active_hours_summary` + `get_hourly_order_performance` (ajout `p_platform`) |
| `src/pages/OpeningHoursComparison.tsx` | Passer `selectedPlatform` aux RPCs |
| `src/components/compare/HourlyOpportunitiesAnalysis.tsx` | Ajouter prop `platform`, passer à RPC |
| `src/components/compare/ProductsByTimeSlotAnalysis.tsx` | Afficher message si Deliveroo sélectionné |

