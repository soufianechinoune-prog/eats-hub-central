

# Corriger la detection du header CSV (cause racine des erreurs chunks 2+)

## Probleme identifie

La fonction `findHeaderLineIndex` dans `ReportImport.tsx` detecte la **ligne de description** (ligne 1 du CSV) comme le header, parce que le texte descriptif "Date du versement effectue par Uber" contient le marqueur "Date du versement".

Resultat : `headerIndex = 0` au lieu de `1`. Les chunks 2+ ne recoivent que la description sans le vrai header, et l'edge function echoue avec "Could not find header row".

## Pourquoi chunk 1 marche

Quand `headerIndex = 0` :
- `preHeaderLines = [description]` (une seule ligne)
- `dataLines = allRecords.slice(1)` = [header, data1, data2, ...]
- Chunk 1 = [description, header, data1...data14999] -- le header est inclus par hasard
- Chunk 2 = [description, data15000...data29999] -- PAS de header

## Correctif

### Fichier : `src/pages/ReportImport.tsx` - fonction `findHeaderLineIndex`

Remplacer la logique "premier match unique" par une logique "meilleur match" qui compte le nombre de marqueurs trouves par ligne et retourne celle qui en a le plus. La vraie ligne de header contient 4+ marqueurs ("Id. de la commande", "Id. du flux", "Nom du restaurant", "Date de la commande"), tandis que la description n'en contient qu'un seul.

```text
Avant : premiere ligne qui contient au moins 1 marqueur -> return
Apres : parcourir les 20 premieres lignes, compter les marqueurs par ligne, retourner celle avec le plus de matches (minimum 2)
```

De plus, ajouter un fallback : si aucune ligne n'a 2+ marqueurs, prendre le premier match comme avant.

## Resultat attendu

- `headerIndex = 1` (la vraie ligne de header)
- `preHeaderLines = [description, header]` pour tous les chunks
- Tous les chunks contiennent le header et sont correctement parses
- Les 387 445 lignes sont importees sans erreur

## Fichier modifie

| Fichier | Changement |
|---------|-----------|
| `src/pages/ReportImport.tsx` | `findHeaderLineIndex` : utiliser le meilleur match (plus de marqueurs) au lieu du premier match |

