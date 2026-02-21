

## Acceleration de l'import "Paiements (commandes)"

### Ce qui ralentit

La fonction `parse-payment-report` traite les commandes par lots de **50 lignes** avec **500ms de pause** entre chaque lot. Pour un fichier de 20 000 lignes, cela represente :
- 400 batches x 500ms = **3 min 20s de pauses seules** (sans compter le traitement)

### Modifications prevues

Fichier : `supabase/functions/parse-payment-report/index.ts`

| Parametre | Avant | Apres |
|-----------|-------|-------|
| BATCH_SIZE | 50 | 200 |
| Delai inter-batch (orders) | 500ms | 150ms |
| Delai inter-batch (adjustments) | 500ms | 150ms |

Avec ces changements :
- 100 batches au lieu de 400
- 15s de pauses au lieu de 3min20
- **Gain estime : x4 a x5 plus rapide**

### Pourquoi c'est safe

- L'index couvrant `idx_order_items_order_id_covering` reduit la pression I/O
- Les upserts utilisent `onConflict: 'uber_order_id,uber_flow_id'` donc zero risque de doublons
- On reste raisonnable (batch de 200, pas 1000)
- Les retries cote client (2 tentatives) protegent contre les erreurs ponctuelles

### Details techniques

Trois modifications dans le fichier :
1. Ligne 231 : `BATCH_SIZE` passe de 50 a 200
2. Ligne 863 : delai orders passe de 500 a 150ms
3. Ligne 947 : delai adjustments passe de 500 a 150ms

