

# Plan : Corrections page Success Score

## Problèmes identifiés

D'après les captures d'écran et l'analyse du code :

### 1. Colonne "Prochain Objectif" à remplacer par "Emballages"
Le tableau affiche actuellement une colonne "Prochain Objectif" qui doit être remplacée par le taux d'emballages durables ("Emballages").

### 2. Boutons "Saisie manuelle" et "Importer CSV" à supprimer
Ces boutons sont maintenant redondants puisque l'import se fait via la page centralisée `/report-import`.

### 3. Marges trop larges
La page Success Score utilise `container mx-auto py-6` alors que Overview utilise une structure différente avec moins de padding, ce qui crée une incohérence visuelle.

---

## Modifications à apporter

### Fichier : `src/pages/SuccessScore.tsx`

#### 1. Supprimer les boutons d'action (lignes 296-307)

**Avant** :
```typescript
{/* Actions */}
<div className="flex gap-2">
  <ManualEntryDialog onSuccess={() => refetch()} />
  <Button 
    onClick={() => navigate('/report-import?type=success_score')} 
    variant="outline"
    className="gap-2"
  >
    <Upload className="h-4 w-4" />
    Importer CSV
  </Button>
</div>
```

**Après** :
Supprimer cette section complètement ou remplacer par un lien discret si nécessaire.

#### 2. Remplacer la colonne "Prochain objectif" par "Emballages"

**Modifications dans le TableHeader (ligne 498)** :
```typescript
// Avant
<TableHead>Prochain objectif</TableHead>

// Après
<TableHead className="text-center">Emballages</TableHead>
```

**Modifications dans le TableBody (lignes 537-570)** :
```typescript
// Avant : bloc "Prochain objectif" complexe

// Après : simple affichage du taux d'emballage
<TableCell className="text-center">
  {score.sustainable_packaging != null 
    ? `${score.sustainable_packaging.toFixed(0)}%` 
    : 'Non renseigné'}
</TableCell>
```

#### 3. Réduire les marges pour correspondre à Vue d'ensemble

**Avant (ligne 283)** :
```typescript
<div className="container mx-auto py-6 space-y-6">
```

**Après** :
```typescript
<div className="space-y-6">
```

Le conteneur `container mx-auto` ajoute des marges latérales importantes. La page Overview n'utilise pas cette classe, ce qui explique la différence de largeur.

#### 4. Nettoyage des imports

Supprimer l'import du composant `ManualEntryDialog` qui n'est plus utilisé :
```typescript
// Supprimer cette ligne
import { ManualEntryDialog } from "@/components/success-score/ManualEntryDialog";
```

---

## Résumé des modifications

| Localisation | Modification |
|--------------|--------------|
| Ligne 44 | Supprimer import `ManualEntryDialog` |
| Lignes 283 | Changer `container mx-auto py-6 space-y-6` → `space-y-6` |
| Lignes 296-307 | Supprimer le bloc des boutons d'action |
| Ligne 498 | Changer `Prochain objectif` → `Emballages` (centré) |
| Lignes 537-570 | Remplacer le bloc complexe par l'affichage simple du % emballages |

---

## Résultat attendu

- La page aura les mêmes marges que "Vue d'ensemble"
- Le tableau affichera : Restaurant | Score | Excellence Op. | Notes | Détails Menu | CA | **Emballages**
- Les boutons "Saisie manuelle" et "Importer CSV" ne seront plus visibles
- L'import des données se fera exclusivement via `/report-import`

