

# Ajouter la TVA au Catalogue Produits

## Contexte
Lors de la fusion Food Cost → Catalogue, la TVA par produit n'a pas été incluse car elle n'existait pas dans la table `menu_items`. Or, pour calculer correctement la marge nette (Prix TTC → HT → déductions), il est nécessaire de connaître le taux de TVA applicable à chaque produit.

## Modifications à apporter

### 1. Migration base de données

Ajouter une colonne `vat_rate` à la table `menu_items` :

```sql
ALTER TABLE menu_items 
ADD COLUMN vat_rate NUMERIC(5,2) DEFAULT 10.00;

COMMENT ON COLUMN menu_items.vat_rate IS 'Taux de TVA applicable au produit (en %)';
```

- Valeur par défaut : **10%** (taux standard restauration)
- Permet des taux différents pour certains produits (boissons alcoolisées 20%, etc.)

### 2. Mise à jour du tableau Catalogue

**Fichier : `src/pages/MenuItems.tsx`**

Ajouter une nouvelle colonne "TVA" après "Food Cost" :

| Nom | Description | Food Cost | TVA | Statut | Actions |
|-----|-------------|-----------|-----|--------|---------|
| Burger Classic | ... | 3,11 € | 10% | ✓ | ... |

- **Affichage** : Format `XX%`
- **Édition inline** : Clic → Select dropdown (5.5%, 10%, 20%) ou Input
- **Sauvegarde** : Même logique que Food Cost (blur/Enter)

### 3. Interface MenuItem

```typescript
interface MenuItem {
  // ... champs existants
  food_cost: number | null;
  vat_rate: number | null;  // Nouveau champ
  is_active: boolean;
}
```

### 4. Formulaire de création/édition

Ajouter un champ "Taux de TVA" dans le dialogue :

```text
┌─────────────────────────────────────┐
│ Food Cost HT (€)                    │
│ [_____3.11_____]                    │
│                                     │
│ Taux de TVA (%)                     │
│ [▼ 10% ▼]  (Dropdown: 5.5%, 10%, 20%)│
└─────────────────────────────────────┘
```

### 5. Exports Excel/PDF

Ajouter la colonne TVA dans les exports :
- Excel : `"TVA (%)": item.vat_rate ? item.vat_rate + "%" : "10%"`
- PDF : Idem

### 6. KPIs (optionnel)

Ajouter une info sur la complétion TVA ou simplement afficher "10% par défaut" dans l'interface.

## Résultat attendu

**Tableau Catalogue enrichi :**

| Produit | Catégorie | Description | Food Cost | TVA | Statut |
|---------|-----------|-------------|-----------|-----|--------|
| Burger Classic | Burgers | Le classique... | 3,11 € | 10% | ✅ |
| Coca-Cola | Boissons | 33cl | 0,45 € | 5.5% | ✅ |
| Mojito | Boissons | Cocktail... | 2,10 € | 20% | ✅ |

## Fichiers impactés

1. **Migration SQL** - Ajout colonne `vat_rate`
2. **`src/pages/MenuItems.tsx`** - Interface, tableau, édition inline, formulaire, exports

