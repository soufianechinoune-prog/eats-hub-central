# Rattacher Tasty Crousty Dijon à son UUID Uber

## Contexte

L'URL Uber Eats fournie décode (base64url) vers `a7d5bd5a-0225-50a0-8ffb-78162ae651e7`.
Vérifié dans `backfill_jobs` : c'est l'UUID historique de TC Dijon (167 jobs done jusqu'au
06/07/2026, puis `user_not_allowed`). Le restaurant `TASTY CROUSTY DIJON`
(`f2345ce0-fe43-4903-a259-acc86a6e67a9`) n'a aucune ligne dans `restaurant_uber_ids`.

## Action (1 requête SQL)

1. Insérer dans `restaurant_uber_ids` :
   - `restaurant_id` = `f2345ce0-fe43-4903-a259-acc86a6e67a9`
   - `uber_store_id` = `a7d5bd5a-0225-50a0-8ffb-78162ae651e7`
   (avec garde anti-doublon : insert seulement si absent)

## Effets immédiats

- Le funnel de conversion (`ingest-uber-funnel`) rapprochera Dijon par UUID → `restaurant_id`
  + `chain_id` remplis au prochain envoi.
- Les imports de rapports Uber re-fonctionneront pour ce store **dès qu'Uber aura
  re-provisionné** l'accès (action côté Uber toujours requise — les 7 tâches `pending`
  échoueront en `user_not_allowed` jusqu'au feu vert Uber).

## Hors périmètre

- Aucune modification des parseurs, aucun ré-import.
- Les autres UUIDs Tasty non mappés (26) restent à traiter après réponse d'Uber.
