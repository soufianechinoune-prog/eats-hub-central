

# Correction des erreurs d'import Deliveroo - Deduplication

## Probleme identifie

Les logs montrent l'erreur PostgreSQL : **"ON CONFLICT DO UPDATE command cannot affect row a second time"**. Cela arrive quand un meme fichier CSV contient deux lignes identiques sur la cle unique `(deliveroo_uuid, history_type, delivery_datetime)`. PostgreSQL refuse de traiter deux fois la meme cle dans un seul batch d'upsert.

936 lignes sur 27 233 sont concernees (environ 3,4%).

## Solution

Ajouter une etape de **deduplication** dans la fonction `parse-deliveroo-statement` avant l'upsert en base, comme c'est deja fait pour les rapports Uber Eats.

## Details techniques

### Fichier modifie : `supabase/functions/parse-deliveroo-statement/index.ts`

Entre l'etape de construction des `dbRecords` (etape 4) et l'upsert (etape 5), ajouter une phase de deduplication :

1. Pour chaque enregistrement, generer une cle composite : `deliveroo_uuid|history_type|delivery_datetime`
2. Si plusieurs lignes partagent la meme cle, ne garder que la derniere occurrence (qui ecrase les precedentes)
3. Envoyer uniquement les enregistrements dedupliques a l'upsert

Cela corrigera les erreurs sans perte de donnees, puisque les doublons sont des lignes identiques.

### Aucune modification de base de donnees necessaire

L'index unique est deja en place. Seule la logique de l'edge function doit etre ajustee.

