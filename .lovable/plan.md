

# Reduire la taille des chunks et ajouter un retry automatique

## Probleme

L'edge function plante avec l'erreur **WORKER_LIMIT** ("not enough compute resources") quand elle traite 15 000 lignes. Avec un fichier de 387 445 lignes, ca fait 26 chunks -- et une partie echoue systematiquement car le serveur n'a pas assez de memoire.

Chaque echec compte 15 000 erreurs, d'ou les 60 000+ erreurs visibles a l'ecran.

## Solution

### 1. Reduire CHUNK_SIZE de 15 000 a 5 000

Fichier : `src/pages/ReportImport.tsx`

Passer la constante `CHUNK_SIZE` de 15 000 a 5 000 lignes. Cela triple le nombre de chunks (26 -> 78), mais chaque chunk sera 3x plus leger en memoire, evitant le WORKER_LIMIT.

### 2. Ajouter un retry automatique (max 2 tentatives)

Fichier : `src/pages/ReportImport.tsx`

Quand un chunk echoue avec une erreur reseau ou WORKER_LIMIT, attendre 3 secondes et re-essayer une fois avant de compter comme erreur definitive. Cela gere les echecs transitoires (le serveur a juste besoin de liberer de la memoire).

### 3. Ne pas envoyer la ligne de description dans les chunks

Fichier : `src/pages/ReportImport.tsx`

La ligne de description (ligne 1) fait ~4 000 caracteres et n'est PAS utilisee par l'edge function pour le parsing (seul le header avec les noms de colonnes est necessaire). Envoyer uniquement la ligne de header (pas la description) dans `preHeaderLines` pour reduire la taille du payload de chaque chunk.

Concretement : `preHeaderLines = [allRecords[headerIndex]]` au lieu de `allRecords.slice(0, headerIndex + 1)`.

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| `src/pages/ReportImport.tsx` | CHUNK_SIZE: 15000 -> 5000 ; retry automatique sur echec ; ne pas envoyer la description line |

## Resultat attendu

- 78 chunks de 5 000 lignes au lieu de 26 chunks de 15 000
- Chaque chunk passe sans WORKER_LIMIT
- Les echecs transitoires sont retentes automatiquement
- Import complet des 387 445 lignes sans erreur

