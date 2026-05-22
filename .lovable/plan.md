Constat

Le bouton “Charger l’analyse des commandes” existe volontairement aujourd’hui : le composant est doublement lazy-loaded.

1. `FinancesSection` n’affiche `OrdersAnalysisSection` qu’au défilement.
2. `OrdersAnalysisSection` bloque ensuite les requêtes tant que `isExpanded = false`, donc tant que tu n’as pas cliqué sur “Charger l’analyse des commandes”.

La raison historique était d’éviter de lancer automatiquement des requêtes très lourdes sur la page Finances. Mais le problème actuel, c’est que même après clic, le chargement reste trop lourd.

Cause technique principale

Aujourd’hui, `useFinancesDrilldown` récupère énormément de lignes brutes côté navigateur :

- Onglet “Par Jour” / “Par Heure” : charge toutes les commandes de la période, par pages de 1000, puis agrège en JavaScript.
- Onglet “Par Produit” : charge d’abord tous les IDs de commandes, puis récupère les `order_items` par lots.
- Onglet “Par Commande” : charge toutes les commandes individuelles, sans vraie pagination serveur, puis vérifie les articles associés par lots.
- En scope “Tous les restaurants” + année complète, ça peut représenter des dizaines/centaines de milliers de lignes à transférer et traiter côté client.

Donc oui : la donnée existe, mais la méthode de remontée est trop coûteuse.

Plan de correction

1. Supprimer le besoin du bouton pour les vues agrégées
   - Charger automatiquement l’analyse “Par Jour” dès que la page Finances est prête.
   - Garder uniquement les vues réellement lourdes sous chargement contrôlé si nécessaire.
   - Remplacer le wording par un état clair : “Chargement des agrégats…” / “Aucune donnée” / erreur visible.

2. Passer les agrégations en base de données
   - Créer une RPC dédiée pour l’analyse journalière/horaire qui agrège côté backend au lieu de renvoyer toutes les commandes.
   - Utiliser le pattern déjà efficace du projet : `unnest(p_restaurant_ids)` + `LATERAL` pour forcer l’index `idx_orders_restaurant_datetime` restaurant par restaurant.
   - Retourner seulement les lignes utiles : jour, heure, restaurant, CA, commandes, commissions, promos, remboursements, versements.

3. Optimiser l’onglet produits
   - Créer une RPC de ventilation produit côté backend.
   - Agréger `order_items` par produit avec filtre restaurant + dates côté SQL.
   - Ne retourner que les produits agrégés, pas tous les items bruts.
   - Conserver la règle métier : Deliveroo n’a pas de détail produit, donc afficher “Donnée non disponible” pour Deliveroo.

4. Corriger l’onglet commandes individuelles
   - Remplacer le chargement de toutes les commandes par une vraie pagination serveur.
   - Charger seulement la page visible, par exemple 100 commandes à la fois.
   - Ajouter `limit`, `offset`, tri, recherche, filtre livraison/emporter côté backend.
   - Ne vérifier les articles disponibles que pour les commandes visibles, pas pour toute la période.

5. Corriger les états de chargement
   - Afficher un loader spécifique par onglet au lieu d’un bloc global qui peut donner l’impression que tout est bloqué.
   - Ajouter un état d’erreur exploitable si une requête échoue ou timeout.
   - Éviter les requêtes quand le scope restaurant contient encore le sentinel `00000000-0000-0000-0000-000000000000`.

6. Validation
   - Tester `/analytics/finances` en scope “Tous les restaurants” sur 2026.
   - Vérifier que “Par Jour” arrive sans clic manuel.
   - Vérifier que l’onglet produits répond rapidement sur Uber Eats.
   - Vérifier que l’onglet commandes individuelles charge une première page rapidement et ne tente plus de récupérer toute l’année.
   - Vérifier qu’aucune requête ne part avec un scope restaurant non résolu.

Résultat attendu

La page ne dépendra plus d’un bouton manuel pour afficher les agrégats principaux, et le chargement sera beaucoup plus stable parce qu’on ne fera plus transiter toute la table `orders` / `order_items` vers le navigateur.