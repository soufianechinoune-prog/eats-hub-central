
# Fusionner l'onglet Food Cost dans Catalogue

## Objectif
Supprimer l'onglet "Food Cost" redondant en intégrant toutes ses fonctionnalités utiles directement dans l'onglet "Catalogue".

## Analyse de la situation actuelle

L'onglet **Food Cost** propose :
- Édition inline du food cost (clic → input → Enter)
- KPIs : Avec Food Cost, À compléter, % Complétion
- Export Excel et PDF
- Ajout de produit

L'onglet **Catalogue** propose déjà :
- Affichage du Food Cost dans le tableau
- Édition via dialog (avec le champ Food Cost)
- Ajout de produit complet
- Vue par catégorie collapsible

## Modifications à apporter

### 1. Ajouter l'édition inline du Food Cost dans le Catalogue

**Fichier : `src/pages/MenuItems.tsx`**

Dans le tableau du Catalogue, transformer la cellule "Food Cost" en champ éditable :
- Clic sur la cellule → Input number
- Touche Enter → Sauvegarde
- Touche Escape → Annulation
- Auto-save on blur (perte de focus)

```text
Avant: <TableCell>3,11 €</TableCell>
Après: <TableCell onClick=startEdit> <Input value="3.11" /> ou "3,11 €"</TableCell>
```

### 2. Enrichir les KPIs du Catalogue

Ajouter une carte KPI supplémentaire :
- **"Avec Food Cost"** : nombre de produits ayant un food cost renseigné
- Ou un indicateur de complétion sous la carte "Produits total"

### 3. Ajouter les exports Excel/PDF

Récupérer la logique d'export depuis `FoodCostManager.tsx` :
- Bouton "Excel" et "PDF" dans la barre de filtres du Catalogue
- Export adapté aux colonnes du Catalogue (Nom, Catégorie, Description, Food Cost, Statut)

### 4. Simplifier le dialog de création/édition

Retirer les champs devenus obsolètes :
- "Prix Uber Eats" et "Prix Deliveroo" (lignes 1433-1471)
- Les descriptions par plateforme peuvent rester (optionnel)

Le dialog devient :
- Nom du produit *
- Catégorie
- Description (unique, pas par plateforme)
- Food Cost (€)
- Produit actif

### 5. Supprimer l'onglet Food Cost

**Fichier : `src/pages/MenuItems.tsx`**
- Retirer "foodcost" de `tabConfig`
- Retirer le `TabsContent` pour "foodcost"
- Supprimer l'import de `FoodCostManager`

**Fichier à supprimer : `src/components/menu/FoodCostManager.tsx`**

### 6. Mettre à jour le type activeTab

```typescript
// Avant
const [activeTab, setActiveTab] = useState<"catalog" | "foodcost" | "simulator" | "prices" | "profitability">("catalog");

// Après
const [activeTab, setActiveTab] = useState<"catalog" | "simulator" | "prices" | "profitability">("catalog");
```

## Résultat attendu

**Onglets après fusion :**
- ✅ **Catalogue** (annuaire complet avec édition inline du Food Cost)
- ✅ **Prix Restaurants** 
- ✅ **Rentabilité**
- ✅ **Simulateur**

**Fonctionnalités du Catalogue après fusion :**
| Fonctionnalité | Avant | Après |
|----------------|-------|-------|
| Vue par catégorie | ✅ | ✅ |
| Édition Food Cost | Via dialog | ✅ Inline + Dialog |
| KPIs Food Cost | ❌ | ✅ |
| Export Excel/PDF | ❌ | ✅ |
| Ajout produit | ✅ | ✅ (simplifié) |

## Fichiers impactés

1. **`src/pages/MenuItems.tsx`** - Modifications principales
2. **`src/components/menu/FoodCostManager.tsx`** - À supprimer
