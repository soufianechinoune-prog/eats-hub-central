

## Correction des timeouts sur l'import articles (parse-item-report)

### Probleme

La table `order_items` a grandi suffisamment pour que les operations `upsert` et les lookups par `flow_id` depassent le timeout de la base de donnees. Chaque chunk echoue avec "canceling statement due to statement timeout", produisant 5000 erreurs.

### Cause racine

1. **Lookup des flow IDs** : 1700 IDs cherches en chunks de 100 via `.in('uber_flow_id', chunk)` -- chaque requete scanne trop de donnees
2. **Upsert en batches de 50** avec `ON CONFLICT (order_id, item_id)` -- la resolution de conflit est lente sur une grosse table
3. **Concurrence de 2 batches simultanes** qui amplifie la charge

### Solution

Modifier `supabase/functions/parse-item-report/index.ts` pour reduire la pression sur la base :

**1. Reduire la taille des lookups et batches :**

| Parametre | Avant | Apres |
|-----------|-------|-------|
| LOOKUP_CHUNK_SIZE | 100 | 50 |
| BATCH_SIZE (upsert) | 50 | 25 |
| CONCURRENCY | 2 | 1 (sequentiel) |
| INTER_BATCH_DELAY | 250ms | 500ms |

**2. Ajouter un timeout explicite plus long sur le client Supabase :**
- Actuellement le client utilise le timeout par defaut
- Ajouter une option de timeout etendu ou utiliser `.rpc()` avec un statement_timeout plus eleve n'est pas possible directement depuis le SDK
- La solution est de reduire la charge par requete pour rester sous le timeout existant

**3. Ajouter un delai entre les chunks de lookup :**
- Actuellement les 18 chunks de lookup sont lances sans pause
- Ajouter un delai de 200ms entre chaque chunk pour laisser la base respirer

### Detail technique des modifications

Dans `supabase/functions/parse-item-report/index.ts` :

- Ligne ~342 : `LOOKUP_CHUNK_SIZE = 100` devient `50`
- Ajouter un `await sleep(200)` entre chaque chunk de lookup (boucle ligne ~350)
- Ligne ~556 : `BATCH_SIZE = 50` devient `25`
- Ligne ~557 : `CONCURRENCY = 2` devient `1`
- Ligne ~558 : `INTER_BATCH_DELAY = 250` devient `500`

### Fichier concerne

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/parse-item-report/index.ts` | Reduire tailles de batch/lookup, passer en sequentiel, ajouter delais entre chunks |

### Impact

- Import plus lent unitairement (~25-30 min au lieu de 12-15 min pour un fichier de 147K lignes)
- Mais les chunks ne seront plus en timeout, donc l'import aboutira au lieu d'echouer a 100%
- Une fois que ca fonctionne, on pourra optimiser davantage si necessaire (index supplementaires, etc.)

