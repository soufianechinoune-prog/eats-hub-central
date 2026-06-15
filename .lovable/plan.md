# Vérification API Uber — Avis Chicken Street Argenteuil (mai 2026)

## Constat

- L'API Uber **supporte** les rapports d'avis : `CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT` (avis client par commande, avec note globale + commentaire + tags) et `MENU_ITEM_FEEDBACK_REPORT` (👍/👎 par item).
- Notre infra **sait les traiter** : `uber-create-report` les accepte et `uber-report-webhook` parse automatiquement les CSV téléchargés depuis Uber pour remplir `customer_reviews` et `menu_item_reviews`.
- Aujourd'hui le scheduler hebdo ne déclenche **que** `PAYMENT_DETAILS_REPORT` → c'est pour ça que les 2 tables sont vides pour Chicken Street Argenteuil.

## Plan d'action (vérification ponctuelle, 0 changement de code)

### Étape 1 — Déclencher 2 appels API
Via `supabase--curl_edge_functions` sur `uber-create-report`, 2 POST pour `restaurantId=d69579a6-987a-4d42-9937-bcb6c8373155`, `startDate=2026-05-01`, `endDate=2026-05-31` :

1. `reportType: "CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT"`
2. `reportType: "MENU_ITEM_FEEDBACK_REPORT"`

Chaque appel crée une ligne dans `reports` (statut `PENDING`) et envoie la demande à Uber.

### Étape 2 — Attendre le webhook Uber (généralement 30 s à 5 min)
Polling SQL sur `reports` WHERE `restaurant_id=...` AND `report_type IN (...)` ORDER BY `created_at DESC` jusqu'à voir `status='COMPLETED'`. Uber appelle `uber-report-webhook` → CSV téléchargé → parsé → insertion dans `customer_reviews` / `menu_item_reviews`.

### Étape 3 — Vérifier la data en base
3 requêtes de contrôle :
- **Note globale par jour** : `SELECT review_date::date, COUNT(*), ROUND(AVG(overall_rating)::numeric,2) FROM customer_reviews WHERE restaurant_id=... AND review_date BETWEEN '2026-05-01' AND '2026-05-31' GROUP BY 1 ORDER BY 1;`
- **Note globale mois complet** : `SELECT COUNT(*), ROUND(AVG(overall_rating)::numeric,2) FROM customer_reviews WHERE ...`
- **Échantillon de 10 commentaires + tags** : `SELECT review_date, overall_rating, customer_comment, tags FROM customer_reviews WHERE customer_comment IS NOT NULL AND ... LIMIT 10;`

### Étape 4 — Livraison
Te restituer en chat :
- Le tableau jour-par-jour (note moyenne + nb avis)
- La moyenne sur le mois
- 10 commentaires avec leurs tags
- Statut des 2 jobs API (`COMPLETED` / `FAILED` + raison si échec)

## Détails techniques

- **Aucune écriture de code** : utilisation uniquement de `supabase--curl_edge_functions` (POST) + `supabase--read_query` (vérif).
- Si l'appel API échoue (ex : `restaurant_id` non lié à une connexion Uber active, ou Uber refuse la plage), je te le signale immédiatement.
- Hors scope : ajout au scheduler hebdo, modification d'edge functions, export ZIP. À discuter après cette vérification si la data est correcte.

## Risques / inconnues

- Délai webhook Uber non garanti — si > 10 min, je te préviens et on peut reprendre plus tard.
- Données disponibles uniquement si Uber a effectivement collecté des avis sur la période (possible qu'il y en ait peu ou pas, indépendamment de notre pipeline).
