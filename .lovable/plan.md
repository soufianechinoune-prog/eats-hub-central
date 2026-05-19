## Diagnostic

Le backend répond normalement. Le ralentissement vient surtout de requêtes trop lourdes lancées côté client et de certaines RPC qui timeoutent :

- `get_ads_revenue_ratio` timeout en base (`statement timeout`) sur la page Overview.
- `useFinancesDrilldown` télécharge toutes les commandes en pagination client pour “Analyse par Commandes”, même sur de longues périodes / tous restaurants.
- Plusieurs requêtes Analytics partent avec le sentinel `00000000-0000-0000-0000-000000000000` avant résolution des vrais restaurants, ce qui génère des appels inutiles / erreurs réseau.
- Le composant “Analyse par Commandes” affiche un spinner sans timeout UI ni fallback, donc l’utilisateur voit juste un chargement interminable.

## Plan d’implémentation

1. **Optimiser le ratio Ads / CA**
   - Remplacer `get_ads_revenue_ratio` par une version plus rapide basée sur des bornes timestamp indexables.
   - Ajouter/ajuster les index nécessaires sur `payout_adjustments` et `orders` pour ce cas.
   - Garder les mêmes colonnes renvoyées pour ne pas casser l’UI.

2. **Remplacer les chargements client “Analyse par Commandes” par des RPC agrégées**
   - Ajouter des fonctions backend pour :
     - données par jour,
     - données par heure,
     - données par produit,
     - liste de commandes paginée côté serveur.
   - Le navigateur ne téléchargera plus des dizaines de milliers de lignes pour ensuite agréger localement.

3. **Mettre à jour `useFinancesDrilldown`**
   - Utiliser les nouvelles RPC selon l’onglet actif.
   - Limiter “Par Commande” à une pagination serveur initiale, au lieu de charger toute la période.
   - Conserver les champs existants pour éviter de modifier toute l’interface.

4. **Bloquer les requêtes tant que le scope restaurants n’est pas prêt**
   - Ajouter une garde explicite contre le sentinel UUID dans les appels lourds.
   - Ne pas lancer les données Ads / Analyse commandes tant que les vrais IDs restaurants ne sont pas résolus.

5. **Améliorer le feedback UI**
   - Remplacer le spinner infini par un message clair si la requête prend trop longtemps.
   - Afficher une action “Réessayer” / “Réduire la période” si besoin.

## Résultat attendu

- Overview plus stable au refresh.
- Le bloc Ads ne bloque plus le rendu et ne timeout plus.
- “Analyse par Commandes” charge beaucoup plus vite, surtout sur “Tous les restaurants”.
- Moins d’erreurs `TypeError: Load failed` causées par surcharge / appels prématurés.