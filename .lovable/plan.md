

# Fix : erreurs 502 Bad Gateway lors de l'import de gros fichiers (350k lignes)

## Problème

L'import de 350 156 lignes génère ~70 chunks de 5 000 lignes envoyés au serveur. Chaque chunk fait des batch upserts de 200 lignes avec seulement 150ms de délai entre batches. Sur les gros volumes, la base de données sature et Cloudflare renvoie une erreur 502 Bad Gateway. Résultat : 200 erreurs sur le chunk 70.

Le message d'erreur affiché contient le HTML brut de la page Cloudflare 502 au lieu d'un message lisible.

## Corrections

### 1. Réduire la taille des batches et augmenter le délai (`supabase/functions/parse-payment-report/index.ts`)

- Réduire `BATCH_SIZE` de 200 à 100
- Augmenter le délai inter-batch de 150ms à 300ms
- Cela réduit la pression sur la base de données

### 2. Ajouter un retry automatique sur les erreurs 502/réseau

Quand un batch upsert échoue avec une erreur contenant "502", "Bad gateway", "network", ou "fetch" :
- Attendre 2 secondes
- Retenter une fois
- Si le retry échoue aussi, alors comptabiliser l'erreur

### 3. Nettoyer le message d'erreur affiché

Dans le traitement d'erreur du batch, détecter si le message contient du HTML (`<!DOCTYPE` ou `<html`) et le remplacer par un message lisible : "Erreur serveur temporaire (502) - le serveur était surchargé"

### 4. Afficher un message d'erreur propre côté client (`src/pages/ReportImport.tsx`)

Si les erreurs retournées contiennent du HTML, les filtrer/nettoyer avant affichage pour éviter le mur de HTML brut visible sur ta capture.

## Fichiers modifiés

- `supabase/functions/parse-payment-report/index.ts` : batch size, délai, retry, nettoyage erreurs
- `src/pages/ReportImport.tsx` : filtrage des erreurs HTML avant affichage

## Résultat attendu

- Les erreurs 502 transitoires seront automatiquement retentées (1 retry)
- Les messages d'erreur seront lisibles (plus de HTML brut)
- La pression sur la base sera réduite, diminuant les risques de 502

