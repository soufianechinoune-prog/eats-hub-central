

# Exploiter le type de commande (Livraison / Emporté) — design épuré

## Approche : 3 intégrations légères, zéro colonne supplémentaire

Le tableau "Par Commande" a déjà 13 colonnes. Ajouter une colonne "Type" alourdirait la lecture. Voici une approche plus élégante :

### 1. Icône discrète sur chaque ligne commande

À côté du numéro de commande (là où se trouve déjà le badge "Offre"), ajouter une petite icône :
- 🚴 `Truck` icon (bleu) pour Livraison
- 🛍️ `ShoppingBag` icon (violet) pour Emporté

Avec un tooltip au survol qui affiche le type complet. Pas de texte, juste l'icône — ça ne prend aucune place.

### 2. Filtre toggle dans la barre de filtres existante

À côté du filtre "Avec offre" qui existe déjà, ajouter un `Select` compact :
- "Tous types" (défaut)
- "Livraison uniquement"
- "Emporté uniquement"

Permet d'isoler un type sans surcharger le tableau.

### 3. Mini KPI résumé au-dessus du tableau

Dans la zone d'en-tête de l'onglet "Par Commande", afficher 2 petits badges :
- `🚴 Livraison : 245 (78%) — 4 520 € CA TTC`
- `🛍️ Emporté : 68 (22%) — 1 180 € CA TTC`

Ça donne la répartition d'un coup d'œil sans toucher au tableau.

## Fichiers modifiés

### `src/hooks/useFinancesDrilldown.ts`
- Ajouter `fulfillment_type` au `select` de `fetchUberIndividualOrders`
- Ajouter le champ à l'interface `OrderFinanceData`
- Exposer un `fulfillmentFilter` optionnel dans les paramètres du hook

### `src/components/analytics/OrdersAnalysisSection.tsx`
- **Ligne commande** (~966) : ajouter l'icône Truck/ShoppingBag à côté du `#order_id`
- **Barre de filtres** (~810-840) : ajouter un `Select` "Type de commande"
- **KPI résumé** (~845) : calculer et afficher la répartition Livraison/Emporté via un `useMemo` sur `filteredOrderData`

### Mapping des valeurs
- `fulfillment_type` contenant "Livraison" ou "Delivery" → icône Truck + label "Livraison"
- `fulfillment_type` contenant "emporter" ou "Pickup" → icône ShoppingBag + label "Emporté"
- `null` ou autre → pas d'icône

## Résultat

```text
┌─────────────────────────────────────────────────┐
│  🚴 Livraison: 245 (78%) — 4 520 €  │  🛍️ Emporté: 68 (22%) — 1 180 €  │
├─────────────────────────────────────────────────┤
│ Filtres: [Tous types ▾]  [☐ Avec offre]  245/313 commandes │
├────┬──────────────────┬──────────┬───────┬──────┤
│    │ N° Commande      │ Date     │ CA HT │ ...  │
│ ▶  │ 🚴 #A1B2C3 Offre │ 01/04    │ 11,27 │ ...  │
│ ▶  │ 🛍️ #D4E5F6       │ 01/04    │ 8,50  │ ...  │
└────┴──────────────────┴──────────┴───────┴──────┘
```

Léger, informatif, sans ajouter de colonne.

