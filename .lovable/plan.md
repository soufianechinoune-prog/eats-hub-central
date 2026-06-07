## Pourquoi c'est arrivé

La table `splash360_restaurant_mapping` a **deux colonnes indépendantes** : `chain_id` (marque de la caisse Splash) et `restaurant_id` (restaurant rattaché). **Aucune contrainte en base ne vérifie que `restaurants.chain_id == mapping.chain_id`.**

Ligne fautive aujourd'hui :
- `restaurant_splash_id = 1287`
- `splash_name = "TASTY CROUSTY AUBERVILLIERS"`
- `chain_id = Tasty Crousty` ✅
- `restaurant_id → Chicken Street - Aubervilliers` ❌ (autre marque !)

Comment ça a pu arriver :
1. La caisse #1287 a probablement été rattachée à l'origine sur la marque Chicken Street (avant que `chain_id` soit posé sur la table de mapping, migration du 17/05).
2. La migration de backfill a ensuite déduit `chain_id` à partir du `splash_name` (« TASTY CROUSTY ») → la ligne s'est retrouvée avec un `chain_id` Tasty Crousty mais le `restaurant_id` est resté pointé vers Chicken Street.
3. Dans l'UI `SplashMapping.tsx`, le dropdown ne propose que des restaurants de la marque active, mais **rien ne bloque côté serveur** un payload croisé, et la donnée historique pré-`chain_id` n'a jamais été validée.

## Ce que je propose (étape par étape, comme demandé)

### Étape 1 — Audit complet (lecture seule, à valider avant tout)
Lister **toutes** les lignes `splash360_restaurant_mapping` où `mapping.chain_id ≠ restaurants.chain_id` pour mesurer l'ampleur (pas seulement Aubervilliers). Idem sur `splash360_daily_sales` (qui a aussi un `chain_id` propre).

→ je te montre la liste, on décide cas par cas avant de toucher quoi que ce soit.

### Étape 2 — Correction des données existantes
Pour chaque ligne croisée détectée :
- Détacher le `restaurant_id` (le remettre à `NULL`) — la caisse redevient « à mapper » dans sa vraie marque.
- Repropager le `chain_id` correct sur `splash360_daily_sales` pour les ventes déjà ingérées.

Pour Aubervilliers concrètement : caisse #1287 → `restaurant_id = NULL`, puis à re-mapper proprement vers `TASTY CROUSTY AUBERVILLIERS` (`169a77c2…`) depuis la marque Tasty Crousty.

### Étape 3 — Verrou en base (le vrai garde-fou)
Ajouter un **trigger `BEFORE INSERT OR UPDATE`** sur `splash360_restaurant_mapping` qui lève une exception si `restaurant_id IS NOT NULL` et `(SELECT chain_id FROM restaurants WHERE id = NEW.restaurant_id) <> NEW.chain_id`. 

Même chose, plus léger, sur `splash360_daily_sales` (cohérence `chain_id` ↔ `restaurant_id`).

→ Plus jamais possible, même par bug UI, script de backfill ou edge function `sync-splash360`, de rattacher une caisse à un restaurant d'une autre marque. La requête échoue, on voit l'erreur tout de suite.

### Étape 4 — Renforcement UI (cosmétique)
Dans `SplashMapping.tsx` et la mutation `moveForeign`, ajouter une vérification client `restaurant.chain_id === selectedChainId` avant l'appel, avec message clair. C'est de la ceinture-bretelles : le trigger de l'étape 3 reste la garantie.

## Détails techniques

- Trigger en `SECURITY DEFINER` pour pouvoir lire `restaurants.chain_id` indépendamment des RLS.
- L'audit étape 1 se fait via `supabase--read_query`, aucune écriture.
- Les corrections étape 2 passent par une migration unique avec un `UPDATE … SET restaurant_id = NULL WHERE id IN (…)` listant explicitement les IDs identifiés à l'étape 1 (pas de masse aveugle).
- Le trigger étape 3 est créé dans la même migration que les corrections, **après** les `UPDATE`, sinon il bloquerait sa propre migration.

## Ordre d'exécution

On fait **uniquement l'étape 1 d'abord**, je te présente la liste exhaustive des rattachements croisés, tu valides les corrections, puis on enchaîne 2 + 3 + 4 dans une seule migration.
