
# Plan : Supporter les fichiers CSV volumineux pour les avis

## Probleme identifie

L'edge function `parse-reviews-order` insere les avis **un par un** (boucle for avec upsert individuel), ce qui cause un timeout sur les fichiers volumineux (~9400 lignes = 9400 requetes reseau).

### Logs d'erreur confirmes

```text
2026-02-06T15:48:42Z ERROR Insert error: 500: Internal server error (Cloudflare timeout)
```

## Solution

Modifier l'edge function pour utiliser des **batch upserts** comme le fait deja `parse-order-history` (batches de 500 lignes).

### Code actuel (lent)

```typescript
// Insere une ligne a la fois = 9400 requetes
for (const review of reviewsToInsert) {
  const { error } = await supabase
    .from('customer_reviews')
    .upsert(review, { onConflict: 'uber_order_id' });
}
```

### Code corrige (rapide)

```typescript
// Insere par lots de 500 = ~19 requetes
const batchSize = 500;
for (let i = 0; i < reviewsToInsert.length; i += batchSize) {
  const batch = reviewsToInsert.slice(i, i + batchSize);
  const { error } = await supabase
    .from('customer_reviews')
    .upsert(batch, { 
      onConflict: 'uber_order_id',
      ignoreDuplicates: false 
    });
}
```

## Avantages

| Aspect | Avant | Apres |
|--------|-------|-------|
| Requetes DB pour 9400 avis | ~9400 | ~19 |
| Temps d'execution estime | >60s (timeout) | <5s |
| Fichiers mensuels | Impossible | Possible |

## Fichier a modifier

`supabase/functions/parse-reviews-order/index.ts` (lignes 380-395)

## Resultat attendu

Le fichier mensuel de ~9400 avis s'importera en quelques secondes au lieu de timeout.
