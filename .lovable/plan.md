

# Ajouter order_errors comme source de donnees pour le dashboard Erreurs

## Le probleme

Le dashboard "Erreurs" (onglet sur Analytics > Operations) utilise uniquement `daily_order_accuracy` qui ne couvre que 4 restaurants. Les 16+ autres restaurants affichent "Aucune donnee disponible" alors que la table `order_errors` contient leurs donnees d'erreurs.

## La solution

Ajouter une requete sur `order_errors` comme source de donnees de fallback dans le composant `OrderAccuracyDashboard`. Quand `daily_order_accuracy` n'a pas de donnees pour les restaurants selectionnes, le dashboard utilisera `order_errors` a la place.

## Fichier modifie

| Fichier | Changement |
|---------|-----------|
| `src/components/operations/OrderAccuracyDashboard.tsx` | Ajouter une requete fallback sur `order_errors` et adapter l'agregation |

## Detail technique

### Nouvelle requete fallback

Ajouter une requete `useQuery` sur la table `order_errors` qui se declenche quand `daily_order_accuracy` est vide pour les restaurants selectionnes :

```text
order_errors
  .select("restaurant_id, uber_order_id, financial_impact, error_date, error_category")
  .in("restaurant_id", restaurantIds)
  .gte("error_date", effectiveDateRange.startDate)
  .lte("error_date", effectiveDateRange.endDate)
```

### Adaptation de l'agregation

Quand on utilise `order_errors` comme source :

- **Commandes incorrectes** : `COUNT(DISTINCT uber_order_id)` au lieu de `SUM(incorrect_orders_count)`
- **Impact financier** : `SUM(financial_impact)` au lieu de `SUM(total_refund)`
- **Categories** : mapper `error_category` vers les categories existantes du dashboard :
  - "Articles manquants" -> Articles manquants
  - "Commande incorrecte" -> Mauvaise commande
  - "Article incorrect" -> Article incorrect
  - "Problemes lies a la qualite des aliments" -> nouvelle categorie
  - "Autre" -> Autre
- **Evolution** : grouper par `error_date` pour le graphique journalier/mensuel
- **Taux d'erreur** : utiliser `daily_sales_uber_deduped` pour le denominateur (deja en place)

### Logique de fallback

```text
1. Charger daily_order_accuracy (source actuelle)
2. Charger order_errors (nouvelle source)
3. Si daily_order_accuracy a des donnees -> l'utiliser (priorite aux donnees officielles Uber)
4. Sinon, si order_errors a des donnees -> l'utiliser avec le message "Source: Import CSV"
5. Sinon -> afficher "Aucune donnee"
```

### Impact sur les sous-composants

- Le graphique d'evolution (`ErrorRateEvolutionChart`) recoit deja des donnees pre-formatees, pas d'impact
- La repartition par categorie sera construite a partir de `error_category` au lieu des colonnes dediees
- Les KPIs (taux d'erreur, impact financier, nombre d'erreurs) restent identiques dans leur presentation
- Le message d'info en haut du dashboard indiquera "Source: Import CSV" au lieu de "Donnees officielles Uber Eats"

### Donnees confirmees en base

`order_errors` contient des donnees pour 20 restaurants en 2026, dont Argenteuil (129 commandes erronees, 1696EUR d'impact).
`daily_order_accuracy` ne couvre que 4 restaurants.

