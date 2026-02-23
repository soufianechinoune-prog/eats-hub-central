

## Acceleration de l'import articles pour instance Medium

### Contexte

L'instance passe de Tiny a Medium, ce qui augmente significativement la capacite CPU, memoire et I/O de la base. On peut donc desserrer les parametres de throttling sans risquer de saturer la base.

### Modifications dans `supabase/functions/parse-item-report/index.ts`

| Parametre | Actuel (Tiny) | Nouveau (Medium) | Explication |
|-----------|---------------|-------------------|-------------|
| LOOKUP_CHUNK_SIZE | 20 | 80 | Medium supporte des requetes plus larges |
| Delai entre lookups | 500ms | 100ms | Moins de pause necessaire |
| BATCH_SIZE (upsert) | 25 | 50 | Retour a la taille d'origine |
| CONCURRENCY | 1 | 2 | 2 batches en parallele a nouveau |
| INTER_BATCH_DELAY | 500ms | 200ms | Delai reduit mais toujours present |

### Impact estime

- Temps d'import pour un fichier de 147K lignes : **~8-12 min** au lieu de 25-30 min
- La base Medium a suffisamment de ressources pour gerer ces parametres sans timeout
- Les mecanismes de retry (3 tentatives avec backoff) restent en place comme filet de securite

### Fichier concerne

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/parse-item-report/index.ts` | Remonter les parametres de batch/lookup/concurrence pour profiter de l'instance Medium |

