

## Correction : lignes de resume non comptabilisees dans parse-item-report

### Probleme

Le rapport "Informations de paiement (articles)" contient deux types de lignes CSV :
- **Lignes article** : avec un nom d'article dans la colonne "Nom du plat" (116 667 lignes)
- **Lignes resume** : lignes de commande sans nom d'article, contenant juste l'ID commande et le flux (71 318 lignes)

La edge function `parse-item-report` ignore correctement les lignes resume (variable `skippedRows`, ligne 255) mais ne les inclut **pas** dans les statistiques retournees. Elle retourne `skipped: orphanCount` au lieu de `skipped: orphanCount + skippedRows`.

Le frontend, lui, calcule `totalRows = dataLines.length` (toutes les lignes CSV = 187 985), ce qui cree l'incoherence :
- Comptabilisees : 116 667 (inserted) + 0 (updated) + 0 (skipped) + 0 (errors) = 116 667
- Total : 187 985
- Ecart : 71 318 lignes non comptabilisees

### Solution

Ajouter `skippedRows` au compteur `skipped` dans les deux reponses de la edge function (dry run et import reel).

### Details techniques

**Fichier : `supabase/functions/parse-item-report/index.ts`**

1. **Reponse dry run** (ligne 489) : remplacer `skipped: orphanCount` par `skipped: orphanCount + skippedRows`

2. **Reponse import reel** (ligne 595) : remplacer `skipped: orphanCount` par `skipped: orphanCount + skippedRows`

Cela garantit que inserted + skipped + errors = totalRows cote frontend, eliminant le faux avertissement d'incoherence.
