
# Plan : Saisie manuelle des données Success Score + Corrections

## Problèmes identifiés

### 1. Tooltips non visibles
Les tooltips ont été ajoutés au code mais peuvent ne pas apparaître correctement. Il faut vérifier que les styles sont corrects.

### 2. Données détaillées manquantes
Le CSV exporté par Uber ne contient que le statut (tier) et l'excellence opérationnelle. Les autres métriques (Notes, Détails Menu, Emballages) sont uniquement visibles dans l'interface Uber Eats et doivent être saisies manuellement.

---

## Solution proposée

### Nouvelle fonctionnalité : Formulaire de saisie manuelle

Ajouter un mode de saisie manuelle sur la page `/report-import` ou directement sur `/success-score` pour permettre d'entrer les données par restaurant.

### Architecture

```text
┌───────────────────────────────────────────────────────────────┐
│              Score de Réussite - Import des données           │
├───────────────────────────────────────────────────────────────┤
│  [Onglet CSV]  [Onglet Saisie Manuelle]                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Mois concerné :  [Janvier 2026 ▼]                           │
│                                                               │
│  Restaurant :     [Chicken Street - Juvisy ▼]                │
│                                                               │
│  ┌─────────────────┬─────────────────────────┐               │
│  │ Niveau          │ [Correct ▼]             │               │
│  ├─────────────────┼─────────────────────────┤               │
│  │ Excellence Op.  │ [97.0] %                │               │
│  ├─────────────────┼─────────────────────────┤               │
│  │ Détails Menu    │ [81] %                  │               │
│  ├─────────────────┼─────────────────────────┤               │
│  │ Note            │ [4.4]                   │               │
│  ├─────────────────┼─────────────────────────┤               │
│  │ Emballages      │ [100] %                 │               │
│  ├─────────────────┼─────────────────────────┤               │
│  │ CA mensuel      │ [119084] €              │               │
│  └─────────────────┴─────────────────────────┘               │
│                                                               │
│  [Enregistrer] [Enregistrer et suivant →]                    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Fichiers à modifier

### 1. `src/pages/SuccessScore.tsx`

**Corrections tooltips :**
- Vérifier que les tooltips utilisent `asChild` correctement
- S'assurer que le délai d'apparition n'est pas trop long

**Ajout bouton saisie manuelle :**
- Ajouter un bouton "Saisie manuelle" à côté de "Importer des données"
- Ouvre un Dialog/Sheet pour saisir les données d'un restaurant

### 2. Nouveau composant : `src/components/success-score/ManualEntryDialog.tsx`

Formulaire de saisie avec :
- Sélecteur de mois
- Sélecteur de restaurant
- Champs pour chaque métrique :
  - Niveau (select : Excellent, Très Bon, Bon, Correct, Insuffisant)
  - Excellence Opérationnelle (number, 0-100)
  - Détails Menu (number, 0-100)
  - Note (number, 0-5, step 0.1)
  - Emballages durables (number, 0-100)
  - CA mensuel (number)
- Boutons : Enregistrer / Enregistrer et suivant

### 3. Base de données

La table `success_scores` a déjà toutes les colonnes nécessaires :
- `operational_excellence` (numeric)
- `menu_details` (numeric)
- `ratings` (numeric)
- `sustainable_packaging` (numeric)
- `sales_amount` (numeric)

Aucune migration nécessaire.

---

## Détails techniques

### Composant ManualEntryDialog

```typescript
interface ManualEntryFormData {
  restaurantId: string;
  scoreMonth: string;
  scoreTier: 'Excellent' | 'Great' | 'Good' | 'Fair' | 'Poor';
  operationalExcellence: number | null;
  menuDetails: number | null;
  ratings: number | null;
  sustainablePackaging: number | null;
  salesAmount: number | null;
}
```

### Logique d'enregistrement

```typescript
// Upsert: update si existe, sinon insert
const { error } = await supabase
  .from('success_scores')
  .upsert({
    restaurant_id: formData.restaurantId,
    score_month: formData.scoreMonth,
    score_tier: formData.scoreTier,
    operational_excellence: formData.operationalExcellence,
    menu_details: formData.menuDetails,
    ratings: formData.ratings,
    sustainable_packaging: formData.sustainablePackaging,
    sales_amount: formData.salesAmount,
  }, {
    onConflict: 'restaurant_id,score_month'
  });
```

### Workflow utilisateur

1. Clic sur "Saisie manuelle" sur la page Success Score
2. Dialog s'ouvre avec le mois actuel pré-sélectionné
3. Sélection du restaurant
4. Saisie des valeurs depuis le screenshot Uber
5. "Enregistrer et suivant" → garde le dialog ouvert, passe au restaurant suivant
6. "Enregistrer" → ferme et rafraîchit la page

---

## Récapitulatif des modifications

| Fichier | Modification |
|---------|--------------|
| `src/pages/SuccessScore.tsx` | Fix tooltips + ajout bouton saisie manuelle |
| `src/components/success-score/ManualEntryDialog.tsx` | Nouveau composant formulaire |

---

## Résultat attendu

- Tooltips visibles au survol des badges de niveau
- Bouton "Saisie manuelle" permettant d'ajouter les données détaillées par restaurant
- Possibilité de compléter les données CSV avec les métriques manquantes (Notes, Menu, Emballages)
