
# Plan : Corriger la détection du rapport Success Score

## Problème identifié

Le fichier CSV "quality-score-stores.csv" n'est pas reconnu car :

1. **Manque la détection d'en-tête** : La fonction `parsePreview()` vérifie les en-têtes de tous les types de rapport SAUF le Success Score. Elle ne cherche jamais les colonnes "Store name", "Status", "Operational excellence".

2. **BOM UTF-8** : Le fichier commence par un BOM (`﻿Store name`) qui peut interférer avec la comparaison de chaînes.

---

## Correction à apporter

### Fichier : `src/pages/ReportImport.tsx`

#### 1. Ajouter la détection d'en-tête Success Score dans `parsePreview()`

Après la ligne 595 (vérification payout summary), ajouter :

```typescript
// Check for Success Score headers
if (lines[i].includes("Store name") && 
    lines[i].includes("Operational excellence") && 
    lines[i].includes("Status")) {
  headerRowIndex = i;
  break;
}
```

#### 2. Nettoyer le BOM UTF-8 en début de fichier

Au début de `parsePreview()` (ligne 505-506), ajouter le nettoyage du BOM :

```typescript
const parsePreview = (content: string) => {
  // Remove BOM if present
  const cleanedContent = content.replace(/^\uFEFF/, '');
  const lines = cleanedContent.split("\n").filter((line) => line.trim());
  // ...
}
```

---

## Résumé des modifications

| Fichier | Modification |
|---------|--------------|
| `src/pages/ReportImport.tsx` | Ajouter nettoyage BOM + détection en-têtes Success Score dans `parsePreview()` |

---

## Résultat attendu

Après correction, le fichier `quality-score-stores.csv` sera automatiquement :
1. Reconnu comme un rapport "Score de Réussite"
2. Parsé correctement pour l'aperçu
3. Importable via le workflow standard
