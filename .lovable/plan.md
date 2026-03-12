

## Problème identifié

Les 4 KPIs en haut ("Heures moyennes/semaine", "CA moyen/heure", "Restaurants Uber", "Restaurants Deliveroo") dépendent **entièrement** de la table `restaurant_opening_hours`. Si un restaurant n'a pas d'horaires saisis, `restaurantStats` retourne un tableau vide (ligne 121 : `if (!openingHoursData?.length) return []`), d'où les 0 partout.

Tu viens de supprimer l'éditeur d'horaires de la fiche restaurant — ces KPIs ne seront donc jamais alimentés pour les restaurants sans horaires pré-existants.

## Solution proposée

Rendre ces KPIs **indépendants** des horaires manuels en les basant sur les données de commandes réelles :

### Changements dans `src/pages/OpeningHoursComparison.tsx`

1. **Supprimer la dépendance aux horaires pour `restaurantStats`** : retirer la condition `if (!openingHoursData?.length)` qui bloque tout. Les horaires deviennent optionnels (enrichissement si disponibles).

2. **Déduire les heures d'activité des commandes** : calculer les heures réelles d'activité à partir des timestamps de commandes via une nouvelle requête RPC ou en exploitant les données existantes de `revenueData` (qui contient déjà order_count et revenue par restaurant).

3. **Remplacer les 4 KPIs** :
   - **"Heures moyennes / semaine"** → Calculer les heures distinctes avec commandes (depuis `orders`), moyennées sur le nombre de semaines de la période
   - **"CA moyen / heure"** → CA total / heures d'activité réelles (déduites des commandes)
   - **"Restaurants Uber"** → Compter les restaurants avec commandes Uber dans la période (basé sur `orders.platform` ou présence dans la table orders)
   - **"Restaurants Deliveroo"** → Idem pour Deliveroo (basé sur `deliveroo_orders`)

4. **Nouvelle RPC `get_active_hours_summary`** (migration SQL) : agrège par restaurant le nombre d'heures distinctes avec au moins une commande, le nombre de semaines actives, et le décompte par plateforme. Cela évite de tout charger côté client.

5. **Conserver la section heatmap des horaires** comme optionnelle : elle s'affiche seulement si des horaires manuels existent, sinon elle est masquée.

### Migration SQL

Créer une fonction RPC qui retourne pour chaque restaurant :
- `distinct_active_hours` : nombre d'heures distinctes dans la période avec ≥1 commande
- `active_weeks` : nombre de semaines avec ≥1 commande  
- `avg_hours_per_week` : hours distinctes / semaines actives
- `has_uber` / `has_deliveroo` : boolean basé sur la présence de commandes

Cela garantit que les KPIs reflètent la **réalité opérationnelle** plutôt que des données saisies manuellement.

