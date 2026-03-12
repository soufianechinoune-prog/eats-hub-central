

## Analyse des fichiers uploadés

Le format CSV/Excel est parfait. La structure est claire :
- Colonnes : Produit, Catégorie, puis une colonne par restaurant avec le prix
- Cases vides = pas de tarif trouvé

Les deux fichiers (Excel et CSV) contiennent exactement les mêmes données : 135 produits × 8 restaurants (Bonneuil, Antony, Reims, Lille Wazemmes, Toulouse, Lyon Ste Catherine, Marseille, Nantes).

## Ce que je propose

Le **CSV** est le format idéal — plus léger, plus simple à parser. Le format actuel avec `;` comme séparateur et `,` pour les décimales est parfait.

### Import en masse via CSV

Créer une fonctionnalité d'import CSV multi-restaurants sur la page Menu Items qui :

1. **Parse le CSV** en détectant automatiquement les noms de restaurants dans les en-têtes de colonnes
2. **Match les noms de restaurants** du CSV avec ceux en base (fuzzy matching sur la ville : "Bonneuil" → "CS Bonneuil", "Antony" → "CS Antony", etc.)
3. **Match les noms de produits** du CSV avec les `menu_items` existants (même fuzzy matching qu'aujourd'hui)
4. **Affiche un récapitulatif** avant import : nombre de produits matchés, restaurants reconnus, cases vides ignorées
5. **Insère/met à jour** les prix dans `restaurant_menu_prices` pour chaque couple restaurant × produit

### Format CSV attendu

```text
Produit;Catégorie;NomVille1;NomVille2;...
Frites;À la carte;3,75;3,57;...
```

- Séparateur `;`
- Décimales avec `,`
- Cases vides = produit non disponible dans ce restaurant
- Colonnes "Écart %" et "Écart €" ignorées à l'import

### Fichiers à modifier

- **Nouveau** : `src/components/menu/BulkPriceImportDialog.tsx` — Dialog d'import CSV multi-restaurants avec :
  - Upload fichier CSV
  - Détection auto des restaurants en en-têtes
  - Interface de mapping restaurant CSV ↔ restaurant en base
  - Aperçu des données parsées
  - Bouton d'import avec upsert en base
- **Modifier** : `src/components/menu/RestaurantPriceComparison.tsx` — Ajouter le bouton "Import CSV multi-restaurants" à côté du bouton existant
- **Plateforme** : L'import sera pour Uber Eats par défaut (puisque les données viennent de là), avec option de choisir Deliveroo

