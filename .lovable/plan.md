

# Integrer les donnees Deliveroo dans la Vue d'ensemble

## Contexte

Les releves Deliveroo importes contiennent des donnees financieres exploitables pour la Vue d'ensemble. Actuellement, la carte Deliveroo affiche "--" sur presque toutes les metriques. L'objectif est d'alimenter cette carte et la carte Global avec les donnees reelles de la table `deliveroo_orders`.

## Donnees disponibles dans `deliveroo_orders`

A partir des lignes de type "Livraison", on peut extraire :
- **CA (Chiffre d'affaires)** : somme de `order_amount`
- **Versement** : somme de `total_payable`
- **Nombre de commandes** : nombre de lignes "Livraison"
- **Panier moyen** : CA / nombre de commandes
- **Rentabilite** : (total_payable / order_amount) * 100

Les metriques suivantes restent indisponibles (pas de source Deliveroo) :
- Note moyenne (deja alimentee via `customer_reviews`)
- Temps de preparation (pas dans les releves de paiement)
- Commandes incorrectes (pas dans les releves)
- Temps d'inactivite (pas dans les releves)

## Modifications prevues

### 1. `src/hooks/useOverviewData.ts` - Ajouter un hook Deliveroo

Creer un hook `useOverviewDeliverooSales` qui interroge `deliveroo_orders` :
- Filtre sur `history_type = 'Livraison'` et la periode selectionnee
- Filtre sur les restaurant_ids epingles
- Agregation : SUM(order_amount), SUM(total_payable), COUNT(*)

Integrer ces donnees dans le calcul `computedData()` pour :
- Remplir `deliveroo.profitability` avec le ratio versement/CA
- Fusionner dans `global.profitability` (ponderation Uber + Deliveroo)
- Ajouter les champs `deliverooRevenue`, `deliverooOrders`, `deliverooNetPayout` a l'interface `OverviewData`

### 2. `src/pages/Overview.tsx` - Afficher les nouvelles metriques Deliveroo

Ajouter dans la carte Deliveroo :
- **CA** : chiffre d'affaires total Deliveroo
- **Versement** : total payable Deliveroo
- **Rentabilite** : pourcentage calcule

Mettre a jour la carte Global pour combiner les donnees des deux plateformes dans le calcul de rentabilite.

### 3. `src/hooks/useNetworkStats.ts` - Integrer Deliveroo dans le tableau comparatif

Ajouter une requete sur `deliveroo_orders` par restaurant pour enrichir :
- Le CA total (Uber + Deliveroo)
- Le versement total
- Le nombre de commandes total
- La rentabilite combinee

Cela permettra au tableau "Comparatif des restaurants" d'afficher des totaux multi-plateformes.

## Details techniques

- La requete Deliveroo utilise `delivery_datetime` (timestamp) pour le filtrage temporel, similaire a `order_datetime` pour Uber
- Seules les lignes `history_type = 'Livraison'` comptent comme commandes
- Les remboursements et ajustements sont exclus du comptage de commandes mais peuvent etre inclus dans le calcul financier global
- La deduplication est deja geree cote import (index unique)
- Le hook suit le pattern existant de chargement par vagues (wave 1b avec les ventes)

