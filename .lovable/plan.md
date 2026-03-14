

## Problème identifié

Le CSV Uber Eats Juin 2025 contient **deux colonnes distinctes** que le parser ne distingue pas :

| Colonne CSV | Mappé dans le parser ? | Colonne DB |
|---|---|---|
| **Frais d'utilisation de l'offre** (le 0.89€) | **NON** — ignoré | aucune |
| TVA sur les frais d'utilisation de l'offre | **NON** — ignoré | aucune |
| Ajustement marketing (TVA incluse) | OUI | `marketing_fee_adjustment` |

Résultat : les frais 0.89€ ne sont **jamais importés**. La colonne `marketing_fee_adjustment` ne contient que l'ajustement marketing (souvent 0), pas les frais d'offre. C'est pour ça que le dashboard "Offres & Frais" affiche 0€ pour Juin 2025.

La table `monthly_fees` a un champ `offer_usage_fee` mais il est rempli manuellement — pas alimenté par les imports CSV.

## Plan de correction

### 1. Ajouter 2 colonnes à la table `orders`
- `offer_usage_fee` (numeric, default 0) — montant HT des frais d'utilisation de l'offre
- `vat_offer_usage_fee` (numeric, default 0) — TVA sur ces frais

### 2. Mettre à jour le parser `parse-payment-report`
Ajouter dans le mapping des colonnes :
```
'Frais d\'utilisation de l\'offre': 'offer_usage_fee'
'TVA sur les frais d\'utilisation de l\'offre': 'vat_offer_usage_fee'
```

### 3. Mettre à jour le parser `parse-payout-summary`
Même ajout pour le mapping des colonnes du payout summary (si la colonne existe dans ce format aussi).

### 4. Mettre à jour la RPC `get_offers_analytics`
Utiliser `offer_usage_fee` au lieu de `marketing_fee_adjustment` pour détecter les commandes taxées et calculer les frais :
```sql
COUNT(*) FILTER (WHERE COALESCE(o.offer_usage_fee, 0) != 0) as taxed_orders
SUM(ABS(COALESCE(o.offer_usage_fee, 0)) + ABS(COALESCE(o.vat_offer_usage_fee, 0))) as total_offer_fees
```

### 5. Re-importer les CSV
Après déploiement, tu devras ré-importer tes CSV Juin 2025 (et les autres mois récents) pour que les frais d'utilisation de l'offre soient capturés dans les nouvelles colonnes.

### Impact
- Le dashboard "Offres & Frais" affichera les vrais frais 0.89€ + TVA
- Les frais/commande seront cohérents (~0.89€ HT ou ~1.07€ TTC)
- L'anomalie "surfacturation" à 1.18-1.26€ disparaîtra probablement (c'était un artefact de l'utilisation de la mauvaise colonne)

