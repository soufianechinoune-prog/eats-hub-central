

# Corriger l'index unique de la table order_errors

## Le probleme

Les 32 145 lignes ont ete correctement lues par le parser, mais l'insertion en base echoue a chaque ligne avec l'erreur :

> "there is no unique or exclusion constraint matching the ON CONFLICT specification"

La cause : l'index unique utilise une **expression** `COALESCE(item_title, '')`, mais le code fait `ON CONFLICT (restaurant_id, uber_order_id, item_title)` sur la colonne brute. PostgreSQL ne reconnait pas l'equivalence.

## La solution

Une seule migration SQL. **Aucun fichier de code modifie.**

| Action | Detail |
|--------|--------|
| Supprimer l'ancien index | `DROP INDEX order_errors_dedup_idx` |
| Nettoyer les NULL existants | `UPDATE order_errors SET item_title = '' WHERE item_title IS NULL` |
| Rendre item_title NOT NULL | `ALTER COLUMN item_title SET DEFAULT '', SET NOT NULL` |
| Recreer l'index simple | `CREATE UNIQUE INDEX ... ON (restaurant_id, uber_order_id, item_title)` |

## Pourquoi c'est sans risque

- Le parser `parse-inaccurate-orders` utilise deja `item_title || ''` donc il n'envoie jamais de NULL
- Les donnees existantes sont nettoyees avant de changer la contrainte
- Aucun autre code ne depend de l'expression COALESCE dans l'index
- Aucun parser n'est modifie

