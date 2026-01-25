
# Plan : Déplacer l'import Score de Réussite vers la page Import centralisée

## Objectif

Intégrer l'import du fichier CSV "Score de Réussite" (quality-score-stores_X.csv) dans la page `/report-import` existante, au lieu d'avoir un formulaire d'import séparé sur la page `/success-score`.

---

## Modifications à effectuer

### 1. Configuration du type de rapport

**Fichier** : `src/lib/reportImportConfig.ts`

Ajouter un nouveau type de rapport :

```typescript
success_score: {
  label: "Score de Réussite",
  description: "Indicateurs mensuels de performance Uber Eats",
  requiresRestaurant: false,  // Le CSV contient plusieurs restaurants
  edgeFunctionName: "parse-success-score",
  targetTables: ["success_scores"],
  requiredColumns: ["Store name", "Status", "Operational excellence"],
}
```

---

### 2. Thème de rapport dans ReportImport.tsx

**Fichier** : `src/pages/ReportImport.tsx`

Ajouter dans un thème existant (ex: "Pilotage") ou créer un nouveau thème "Performance" :

```typescript
{
  id: "performance",
  label: "Performance",
  icon: Award,
  types: [
    { 
      value: "success_score", 
      label: "Score de Réussite", 
      description: "Indicateurs mensuels Uber Eats (Excellence opé., Notes, Menu)", 
      icon: Award 
    },
  ]
}
```

---

### 3. Gestion spéciale pour le mois du score

Le fichier CSV ne contient pas de date - il faut demander à l'utilisateur de sélectionner le mois du score.

**Modifications UI** :

Quand `reportType === "success_score"` :
- Afficher un sélecteur de mois (type `<input type="month">`) en plus du fichier
- Passer `scoreMonth` au edge function lors de l'import

---

### 4. Détection automatique du type

Ajouter dans la fonction `detectReportType()` :

```typescript
// Success Score
if (headerLine.includes("Store name") && 
    headerLine.includes("Operational excellence") && 
    headerLine.includes("Status")) {
  return "success_score";
}
```

---

### 5. Simplifier la page SuccessScore

**Fichier** : `src/pages/SuccessScore.tsx`

Retirer complètement la section d'import (Card avec sélecteur de mois + input file + bouton Importer).

Ajouter un bouton "Importer des données" qui redirige vers `/report-import?type=success_score`.

---

## Récapitulatif des fichiers

| Fichier | Action |
|---------|--------|
| `src/lib/reportImportConfig.ts` | Ajouter config `success_score` |
| `src/pages/ReportImport.tsx` | Ajouter thème + type + sélecteur mois + détection auto |
| `src/pages/SuccessScore.tsx` | Supprimer l'import, ajouter lien vers ReportImport |

---

## Flux utilisateur après modification

1. L'utilisateur va sur `/report-import`
2. Il sélectionne "Score de Réussite" (ou le système le détecte automatiquement)
3. Il choisit le mois du score (sélecteur de mois)
4. Il dépose le fichier CSV
5. L'import est traité par `parse-success-score`
6. Il peut ensuite visualiser les résultats sur `/success-score`
