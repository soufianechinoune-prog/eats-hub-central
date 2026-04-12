

# Fix : limite de 10 fichiers pour l'import tunnel de conversion

## Probleme

Dans `src/pages/ReportImport.tsx`, ligne 511 :
```js
const fileArray = Array.from(files).slice(0, 10); // Max 10 files
```

Le code coupe arbitrairement la selection a 10 fichiers. Quand tu selectionnes 31 fichiers CSV, seuls les 10 premiers sont pris en compte.

## Solution

Supprimer la limite de 10 et accepter tous les fichiers selectionnes. La limite de 10 n'a pas de justification technique : le traitement se fait fichier par fichier cote client et les imports sont chunkes cote serveur.

## Modification

**`src/pages/ReportImport.tsx`** (ligne 511) :
- Remplacer `Array.from(files).slice(0, 10)` par `Array.from(files)`
- Mettre a jour les messages/labels qui mentionnent eventuellement une limite de 10

