

# Fix: 7 fichiers sur 66 echouent a la lecture

## Cause racine

Le code lit les fichiers **sequentiellement** : pour chaque fichier, il appelle `readFileAsText()` puis fait un appel reseau `parse-deliveroo-statement` (dry-run). Avec 66 fichiers, le traitement prend plusieurs minutes. Les references aux derniers fichiers (`File` objects) deviennent invalides car le navigateur peut les garbage-collecter ou invalider les handles apres un certain temps/nombre de lectures.

Les 7 fichiers en echec sont les derniers (dates 20251229 a 20260209) -- ils ne sont pas corrompus, ils sont simplement lus trop tard.

## Fix

### `src/components/reports/DeliverooImportTab.tsx`

**Lire TOUS les fichiers en memoire d'abord, PUIS traiter les dry-runs.**

1. Ajouter une premiere boucle qui lit tous les fichiers (`readFileAsText`) immediatement et stocke leur contenu dans un `Map<File, string>`
2. Dans la seconde boucle (dry-run), utiliser le contenu deja lu depuis la Map au lieu de relire le fichier
3. Cela garantit que les File handles sont consommes immediatement avant qu'ils ne deviennent invalides

```text
AVANT:
  for file in csvFiles:
    content = readFileAsText(file)     // peut echouer apres 5min
    dryRun(content)                     // appel reseau ~1s

APRES:
  // Phase 1: lecture immediate de tous les fichiers
  fileContents = new Map()
  for file in csvFiles:
    fileContents.set(file, readFileAsText(file))  // rapide, tout en memoire

  // Phase 2: dry-runs avec le contenu deja lu
  for file in csvFiles:
    content = fileContents.get(file)
    dryRun(content)
```

Un seul fichier modifie, une seule zone de code changee (la fonction `handleFileChange`).

