
# Correction de l'affichage de la période de ventes dans l'import Payout

## Problème identifié

L'interface d'import affiche **"Période des données : Du 26/01/2026 au 26/01/2026"**, mais c'est la **date de versement**, pas la période de ventes réelle.

Le fichier du 26/01 contient en fait les ventes de la semaine du **19/01 au 25/01/2026**.

## Solution

Modifier le parser pour calculer et retourner la **période de ventes réelle** en plus de la date de versement :

- **Période de ventes** = 7 jours avant la date de versement (typiquement Lundi-Dimanche)
- Afficher les deux informations dans l'interface

## Modifications techniques

| Fichier | Action |
|---------|--------|
| `supabase/functions/parse-payout-summary/index.ts` | Calculer `salesPeriod` (start/end) basé sur payout_date - 7 jours |
| `src/pages/ReportImport.tsx` | Afficher "Période de ventes" (salesPeriod) et "Date de versement" (payoutDate) |

### 1. Edge Function - Calcul de la période de ventes

```typescript
// Après la ligne 359 (maxDate), ajouter le calcul de la période de ventes
// La période de ventes est typiquement les 7 jours précédant le versement
// Ex: versement 26/01 = ventes du 19/01 au 25/01

// Dans la réponse, ajouter :
validation: {
  dateRange: {
    start: minDate,  // Date de versement min
    end: maxDate,    // Date de versement max
  },
  salesPeriod: {
    start: salesStartDate,  // minDate - 7 jours
    end: salesEndDate,      // maxDate - 1 jour (veille du versement)
  },
  // ...
}
```

### 2. Interface - Affichage amélioré

Remplacer l'affichage actuel :
```
Période des données
Du 26/01/2026 au 26/01/2026
```

Par :
```
Période de ventes
Du 19/01/2026 au 25/01/2026

Date de versement : 26/01/2026
```

## Résultat attendu

L'utilisateur verra clairement :
- La **période de ventes** (ce qui l'intéresse pour l'analyse)
- La **date de versement** (pour référence)

Cela élimine la confusion entre date de versement Uber et période réelle des ventes.
