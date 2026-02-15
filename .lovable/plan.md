

# Afficher le compteur de lignes fusionnees dans l'ecran d'import

## Probleme

L'ecran d'import affiche 212 418 "Lignes totales" mais seulement 99 540 + 99 521 + 715 = 199 776 lignes comptabilisees. Les ~12 642 lignes restantes ne sont pas perdues : elles ont ete **fusionnees** lors de la deduplication (plusieurs lignes CSV pour la meme commande, ex: differents taux de TVA).

L'edge function `parse-payment-report` calcule deja ce chiffre dans `stats.merged` (ligne 930) mais le frontend ne l'affiche pas.

## Solution

### 1. Ajouter le compteur "Fusionnees" dans l'ecran de resultats

Fichier : `src/pages/ReportImport.tsx`

- Ajouter une 6eme carte KPI "Fusionnees" (en bleu/violet) entre "Mises a jour" et "Ignorees"
- Afficher `importResult.stats.merged` (ou 0 si absent)
- Avec un tooltip explicatif : "Lignes CSV fusionnees car elles concernent la meme commande (ex: TVA multiples)"

### 2. Agreger le champ `merged` dans la logique de chunking

Fichier : `src/pages/ReportImport.tsx`

- Dans la boucle de chunks (ligne ~1150), accumuler `totalMerged += chunkResult.stats?.merged || 0`
- Inclure `merged: totalMerged` dans le resultat agrege (ligne ~1212)

### 3. Verification de coherence

- Afficher un indicateur visuel si `inserted + updated + skipped + merged + errors != totalRows`
- Cela garantit que 100% des lignes sont comptabilisees

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| `src/pages/ReportImport.tsx` | Accumuler `merged` dans le chunking + afficher la carte "Fusionnees" dans l'ecran de resultats |

## Resultat attendu

L'ecran affichera :
- 212 418 Lignes totales
- 99 540 Inserees
- 99 521 Mises a jour
- ~12 642 Fusionnees
- 715 Ignorees
- 0 Erreurs

Total = 212 418 (coherent)

