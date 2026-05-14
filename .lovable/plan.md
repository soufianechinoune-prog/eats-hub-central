## Diagnostic

Champs sur Marne affiche "Vide" alors que tous les jobs `PAYMENT_DETAILS_REPORT` sont `done` (29/29) et qu'Uber Manager montre bien des données de janvier 2024 à aujourd'hui.

**Cause identifiée** : la table `restaurant_uber_ids` (table d'alias utilisée par le webhook d'ingestion pour résoudre `uber_store_id → restaurant_id`) contient des entrées qui pointent vers le mauvais restaurant.

Pour Champs sur Marne :
- `uber_store_id = 60b94572-...` est bien sur le restaurant `TASTY CROUSTY CHAMPS SUR MARNE` (`c4c6295f`)
- Mais `restaurant_uber_ids` mappe ce même store_id vers `TASTY CROUSTY CHAMPIGNY SUR MARNE` (`986b1024`)
- Résultat : les 53 payouts ingérés via webhook sont attachés à Champigny → Champs sur Marne reste à 0.

**4 alias incorrects au total** (créés le 2026-04-01 « ajouté via import ») :

| Vrai propriétaire | Mal aliasé vers |
|---|---|
| TASTY CROUSTY MELUN | TASTY CROUSTY MEAUX |
| TASTY CROUSTY TOULOUSE | TASTY CROUSTY TOULOUSE CAPITOL |
| TASTY CROUSTY CHAMPS SUR MARNE | TASTY CROUSTY CHAMPIGNY SUR MARNE |
| TASTY CROUSTY RÉPUBLIQUE | TASTY CROUSTY PARIS 11 |

Conséquence : 4 restos affichent "Vide" partout, et 4 autres restos ont leur CA gonflé (mélange de leurs propres ventes + celles du voisin).

## Plan de correction

### 1. Migration SQL — assainir les données

Une seule migration, en deux temps :

**a) Réattribuer les payouts mal attachés**

```sql
UPDATE payouts p
SET restaurant_id = r_owner.id
FROM restaurants r_owner
WHERE p.uber_store_id = r_owner.uber_store_id
  AND p.restaurant_id <> r_owner.id;
```

Effet attendu : ~62 payouts re-attribués au bon resto (53 vers Champs sur Marne, 9 vers Champigny pour son propre store, etc.).

**b) Supprimer les 4 alias incorrects**

```sql
DELETE FROM restaurant_uber_ids rui
USING restaurants r_owner
WHERE r_owner.uber_store_id = rui.uber_store_id
  AND rui.restaurant_id <> r_owner.id;
```

Effet : les futurs webhooks utiliseront le mapping principal (`restaurants.uber_store_id`), qui est correct.

### 2. Garde-fou — empêcher la récidive

Ajouter une contrainte qui bloque l'insertion d'un alias `restaurant_uber_ids` pointant vers un restaurant différent du propriétaire réel du `uber_store_id` :

```sql
CREATE OR REPLACE FUNCTION public.prevent_conflicting_uber_alias()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  real_owner uuid;
BEGIN
  SELECT id INTO real_owner
  FROM restaurants
  WHERE uber_store_id = NEW.uber_store_id;

  IF real_owner IS NOT NULL AND real_owner <> NEW.restaurant_id THEN
    RAISE EXCEPTION
      'Alias Uber conflictuel : store % appartient déjà au restaurant %, refusé pour %',
      NEW.uber_store_id, real_owner, NEW.restaurant_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_conflicting_uber_alias
BEFORE INSERT OR UPDATE ON restaurant_uber_ids
FOR EACH ROW EXECUTE FUNCTION public.prevent_conflicting_uber_alias();
```

### 3. Vérification post-migration

Après application, je relance les requêtes :
- `SELECT count(*) FROM payouts WHERE restaurant_id = '<champs sur marne>'` doit passer de 0 → 53
- La page `/admin/uber-backfill-ca` doit afficher "Live" (et non "Vide") pour Champs sur Marne, Melun, Toulouse, République
- Et le CA agrégé de Champigny / Meaux / Toulouse Capitol / Paris 11 va légèrement baisser (retrait des payouts qui ne leur appartenaient pas) — c'est le comportement correct.

## Pas dans le scope

- Pas de changement UI, pas de changement de logique d'ingestion : le webhook fait déjà ce qu'il faut, c'était juste les données d'alias qui étaient cassées.
- Pas de relance de backfill : les données sont déjà dans la table `payouts`, on les déplace simplement vers le bon `restaurant_id`.
