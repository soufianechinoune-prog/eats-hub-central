## Diagnostic confirmé

Les 7 restaurants qui ont des commandes (Grenoble, Bordeaux, Besançon, Créteil, O'Parinor, Corbeil, Poitiers) reçoivent bien leur data **via l'API Uber** — aucun import CSV récent n'a été fait. Le `last_order = 05/06/2026` confirme un flux API en direct.

Pour les 3 UUIDs sans data, voici la vraie situation côté base :

| Restaurant | Fiche existe | UUID dans `restaurants.uber_store_id` | UUID dans `restaurant_uber_ids` | Commandes |
|---|---|---|---|---|
| **Goussainville** | Oui (`c9c9d5d4…`) | vide | `92211a3b…` mais `is_primary = false` → affiché « (ancien) » | 0 |
| **Belfort** | Oui (`b109a75c…`) | vide | aucune entrée | 0 |
| **Porte de Montreuil** | Oui (`dc061c3e…`) | vide | aucune entrée | 0 |

**Conclusion :** ce n'est pas un problème d'appel API côté worker. Le mapping `uber_store_id ⇄ restaurant` est tout simplement absent (ou marqué « ancien ») dans la base, donc le webhook/sync API n'a aucun moyen de rattacher une commande au bon restaurant — il les ignore.

Pour Goussainville, vous avez raison : l'UUID a bien été saisi à un moment, mais l'enregistrement a été stocké avec `is_primary = false` (probablement parce qu'un UUID précédent existait, ou via un transfert). Le worker API ne prend en compte que l'UUID primary → d'où le silence.

## Plan de correction

### 1. Goussainville — promouvoir l'UUID existant en « actuel »
- Mettre `is_primary = true` sur l'entrée `restaurant_uber_ids` où `uber_store_id = 92211a3b-35d7-4472-b1a1-66ddf9b0f7cf`.
- Copier ce même UUID dans `restaurants.uber_store_id` pour le rendre visible côté fiche restaurant.

### 2. Belfort — créer le mapping
- Insérer `restaurant_uber_ids` { restaurant_id = `b109a75c…`, uber_store_id = `7b9d739d-a71b-59ac-ab41-a48806496af6`, is_primary = true }.
- Renseigner `restaurants.uber_store_id = 7b9d739d…`.

### 3. Porte de Montreuil — créer le mapping
- Insérer `restaurant_uber_ids` { restaurant_id = `dc061c3e…`, uber_store_id = `502c3fd5-0b51-5489-8ef5-81e4a96c7097`, is_primary = true }.
- Renseigner `restaurants.uber_store_id = 502c3fd5…`.

### 4. Vérification post-correction
- Confirmer qu'aucune commande historique n'est encore en attente (les 3 restos ont 0 commandes aujourd'hui).
- Si Uber pousse rétroactivement la data API à l'activation côté Uber, elle sera automatiquement attachée au bon restaurant grâce au mapping ci-dessus.
- Si rien ne tombe après 24-48 h une fois Uber côté activation, vérifier les logs de l'edge function de sync API.

## À confirmer avant exécution
- **Goussainville** : aucun autre UUID Uber actuel à conserver, on fait bien de promouvoir `92211a3b…` ? (vous m'aviez dit « ancien UUID » mais il s'agit bien de l'UUID actuel Uber qu'ils utilisent maintenant.)
- **Belfort / Porte de Montreuil** : ces deux UUIDs sont bien les UUIDs **actuels** (pas d'anciens à archiver).
