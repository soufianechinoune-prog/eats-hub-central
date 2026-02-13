

## Export Food Cost de la Mercuriale (Excel + PDF)

L'onglet "Catalogue" dispose deja de boutons Excel et PDF, mais les exports actuels sont basiques. Je propose d'ameliorer ces exports pour qu'ils soient centres sur le Food Cost avec un format professionnel, et de s'assurer qu'ils exportent bien **tous** les produits (pas seulement les filtres actifs).

### Ameliorations prevues

**Export Excel :**
- Exporter **tous les produits actifs** (ignorer les filtres de recherche/categorie pour avoir la mercuriale complete)
- Colonnes : Produit, Categorie, Food Cost HT, TVA (%), Statut du renseignement (Renseigne / A completer)
- Headers stylises en vert emeraude (via xlsx-js-style deja installe)
- Lignes alternees pour la lisibilite
- Resume en bas : nombre total, nombre renseigne, taux de completion
- Nom du fichier : `mercuriale_food_cost_YYYY-MM-DD.xlsx`

**Export PDF :**
- En-tete avec logo CS et titre "Mercuriale - Food Cost"
- KPIs en haut : produits analyses, taux de completion, food cost moyen
- Tableau complet avec code couleur (vert = renseigne, orange = manquant)
- Groupement par categorie avec sous-totaux
- Pagination automatique
- Legende et pied de page

### Modifications techniques

**Fichier modifie : `src/pages/MenuItems.tsx`**
- Remplacement des fonctions `exportToExcel()` et `exportToPdf()` existantes
- Utilisation de `menuItems` (tous les produits) au lieu de `filteredItems` pour la mercuriale complete
- Ajout du logo CS (`csLogoBase64`) deja utilise dans d'autres exports
- Utilisation de `xlsx-js-style` (deja installe) pour le style Excel professionnel
- Respect des standards PDF existants (pas d'emojis, pas de `toLocaleString()`)

Aucune nouvelle table ni dependance necessaire.

